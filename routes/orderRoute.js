const express = require('express');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const { isAuth, isAdmin } = require('../util');

const router = express.Router();

// Obtener todas las órdenes (solo admin)
router.get("/", isAuth, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('user', 'name email')
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
      .populate('orderItems.product', 'name');
    
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

    // Calcular total para verificar
    newOrder.calculateTotal();

    const savedOrder = await newOrder.save();

    // Reducir stock de los productos
    for (let item of orderItems) {
      const product = await Product.findById(item.product);
      product.reduceStock(item.qty);
      await product.save();
    }

    res.status(201).send({ 
      message: "New Order Created", 
      data: savedOrder 
    });
  } catch (error) {
    res.status(400).send({ 
      message: "Error creating order", 
      error: error.message 
    });
  }
});

// Marcar orden como pagada
router.put("/:id/pay", isAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (order) {
      // Verificar que el usuario puede pagar esta orden
      if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
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
      
      res.send({ 
        message: 'Order Paid Successfully.', 
        order: order 
      });
    } else {
      res.status(404).send({ message: 'Order not found.' });
    }
  } catch (error) {
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