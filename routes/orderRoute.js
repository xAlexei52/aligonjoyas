const express = require('express');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const Coupon = require('../models/couponModel');
const User = require('../models/userModel');
const { isAuth, isAdmin } = require('../util');
const { sendCouponEmail } = require('../utils/emailService');

const router = express.Router();

// Obtener todas las órdenes (solo admin)
router.get("/", isAuth, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('user', 'name email')
      .populate('appliedCoupon.couponId', 'code')
      .sort({ createdAt: -1 });
    res.send(orders);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Obtener órdenes del usuario autenticado
router.get("/mine", isAuth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('appliedCoupon.couponId', 'code description')
      .sort({ createdAt: -1 });
    res.send(orders);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Obtener orden por ID
router.get("/:id", isAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('orderItems.product', 'name')
      .populate('appliedCoupon.couponId', 'code description')
      .populate('generatedCouponId', 'code discountValue expiresAt');
    
    if (order) {
      // Verificar que el usuario puede ver esta orden
      if (order.user._id.toString() === req.user._id.toString() || req.user.isAdmin) {
        res.send(order);
      } else {
        res.status(403).send({ message: 'Not authorized to view this order' });
      }
    } else {
      res.status(404).send({ message: "Order Not Found." });
    }
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Eliminar orden (solo admin)
router.delete("/:id", isAuth, isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (order) {
      await Order.findByIdAndDelete(req.params.id);
      res.send({ message: "Order deleted successfully" });
    } else {
      res.status(404).send({ message: "Order Not Found." });
    }
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Crear nueva orden
router.post("/", isAuth, async (req, res) => {
  try {
    const {
      orderItems,
      shipping,
      payment,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
      couponCode // Nuevo campo para cupón
    } = req.body;

    if (orderItems && orderItems.length === 0) {
      return res.status(400).send({ message: 'No order items' });
    }

    // Verificar que los productos existen y hay stock
    for (let item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).send({ 
          message: `Product not found: ${item.name}` 
        });
      }
      if (!product.hasStock(item.qty)) {
        return res.status(400).send({ 
          message: `Not enough stock for: ${item.name}` 
        });
      }
    }

    // Crear orden inicial
    const newOrder = new Order({
      orderItems,
      user: req.user._id,
      shipping,
      payment,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
    });

    // Aplicar cupón si se proporciona
    let couponDiscount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({ 
        code: couponCode.toUpperCase().trim()
      });

      if (!coupon) {
        return res.status(404).send({
          message: 'Cupón no encontrado',
          success: false
        });
      }

      // Verificar que el cupón pertenece al usuario
      if (coupon.createdFor.toString() !== req.user._id.toString()) {
        return res.status(403).send({
          message: 'Este cupón no te pertenece',
          success: false
        });
      }

      // Calcular subtotal temporal para validar cupón
      const tempSubtotal = itemsPrice + shippingPrice;
      const discountResult = coupon.calculateDiscount(tempSubtotal);

      if (!discountResult.isValid) {
        return res.status(400).send({
          message: discountResult.reason,
          success: false
        });
      }

      // Aplicar cupón a la orden
      couponDiscount = discountResult.discount;
      newOrder.applyCoupon(coupon, couponDiscount);

      // Marcar cupón como usado
      await coupon.markAsUsed(req.user._id);
    } else {
      // Calcular total sin cupón
      newOrder.calculateTotal(0);
    }

    const savedOrder = await newOrder.save();

    // Reducir stock de los productos
    for (let item of orderItems) {
      const product = await Product.findById(item.product);
      product.reduceStock(item.qty);
      await product.save();
    }

    res.status(201).send({ 
      message: "New Order Created", 
      data: savedOrder,
      couponApplied: !!couponCode,
      discountAmount: couponDiscount
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(400).send({ 
      message: "Error creating order", 
      error: error.message 
    });
  }
});

// Marcar orden como pagada
router.put("/:id/pay", isAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email');
    
    if (order) {
      // Verificar que el usuario puede pagar esta orden
      if (order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        return res.status(403).send({ message: 'Not authorized to pay this order' });
      }

      const paymentResult = {
        id: req.body.id,
        status: req.body.status,
        update_time: req.body.update_time,
        email_address: req.body.email_address,
        payerID: req.body.payerID,
        orderID: req.body.orderID,
        paymentID: req.body.paymentID
      };

      await order.markAsPaid(paymentResult);
      
      // Generar cupón si califica
      await generateCouponForOrder(order);
      
      res.send({ 
        message: 'Order Paid Successfully.', 
        order: order 
      });
    } else {
      res.status(404).send({ message: 'Order not found.' });
    }
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).send({ message: error.message });
  }
});

// Función auxiliar para generar cupón
const generateCouponForOrder = async (order) => {
  try {
    // Verificar si califica y no se ha generado ya
    if (!order.qualifiesForCoupon()) {
      return null;
    }

    const baseAmount = order.getCouponBaseAmount();
    const user = await User.findById(order.user._id || order.user);

    // Crear cupón automático
    const coupon = await Coupon.createAutomaticCoupon(
      user._id,
      order._id,
      baseAmount
    );

    if (coupon) {
      // Actualizar orden para marcar que se generó cupón
      order.couponGenerated = true;
      order.generatedCouponId = coupon._id;
      await order.save();

      // Enviar email con cupón
      try {
        await sendCouponEmail(user.email, coupon, user.name, baseAmount);
        console.log(`✅ Cupón ${coupon.code} enviado a ${user.email}`);
      } catch (emailError) {
        console.error('❌ Error enviando email de cupón:', emailError);
        // No fallar la operación si falla el email
      }

      return coupon;
    }
  } catch (error) {
    console.error('❌ Error generando cupón:', error);
    // No fallar la operación principal si falla la generación del cupón
  }
  
  return null;
};

// Endpoint para regenerar cupón manualmente (admin)
router.post("/:id/generate-coupon", isAuth, isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email');

    if (!order) {
      return res.status(404).send({ message: 'Order not found' });
    }

    if (!order.isPaid) {
      return res.status(400).send({ 
        message: 'Order must be paid to generate coupon' 
      });
    }

    // Forzar generación de cupón
    const baseAmount = order.getCouponBaseAmount();
    
    if (baseAmount < 200) {
      return res.status(400).send({
        message: 'Order amount too low for coupon generation'
      });
    }

    const coupon = await Coupon.createAutomaticCoupon(
      order.user._id,
      order._id,
      baseAmount
    );

    if (coupon) {
      // Actualizar orden
      order.couponGenerated = true;
      order.generatedCouponId = coupon._id;
      await order.save();

      // Enviar email
      try {
        await sendCouponEmail(order.user.email, coupon, order.user.name, baseAmount);
      } catch (emailError) {
        console.error('Error enviando email:', emailError);
      }

      res.send({
        message: 'Coupon generated successfully',
        coupon: {
          code: coupon.code,
          discountValue: coupon.discountValue,
          expiresAt: coupon.expiresAt
        }
      });
    } else {
      res.status(400).send({
        message: 'Unable to generate coupon for this order'
      });
    }
  } catch (error) {
    console.error('Error generating coupon:', error);
    res.status(500).send({ message: error.message });
  }
});

// Marcar orden como entregada (solo admin)
router.put("/:id/deliver", isAuth, isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (order) {
      await order.markAsDelivered();
      
      res.send({ 
        message: 'Order Delivered Successfully.', 
        order: order 
      });
    } else {
      res.status(404).send({ message: 'Order not found.' });
    }
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

module.exports = router;