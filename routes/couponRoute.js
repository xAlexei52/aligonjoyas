const express = require('express');
const Coupon = require('../models/couponModel');
const { isAuth, isAdmin } = require('../util');

const router = express.Router();

// Obtener cupones del usuario autenticado
router.get('/mine', isAuth, async (req, res) => {
  try {
    const coupons = await Coupon.find({ 
      createdFor: req.user._id 
    })
    .populate('orderTrigger', 'totalPrice createdAt')
    .sort({ createdAt: -1 });

    // Separar cupones válidos y usados/expirados
    const validCoupons = coupons.filter(coupon => coupon.isValid());
    const expiredCoupons = coupons.filter(coupon => !coupon.isValid());

    res.send({
      valid: validCoupons,
      expired: expiredCoupons,
      total: coupons.length,
      validCount: validCoupons.length
    });
  } catch (error) {
    res.status(500).send({ 
      message: 'Error obteniendo cupones', 
      error: error.message 
    });
  }
});

// Validar cupón por código
router.get('/validate/:code', isAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const { orderTotal } = req.query;

    if (!code) {
      return res.status(400).send({
        message: 'Código de cupón requerido',
        valid: false
      });
    }

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase().trim()
    }).populate('createdFor', 'name email');

    if (!coupon) {
      return res.status(404).send({
        message: 'Cupón no encontrado',
        valid: false
      });
    }

    // Verificar que el cupón pertenece al usuario (o es admin)
    if (coupon.createdFor._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).send({
        message: 'Este cupón no te pertenece',
        valid: false
      });
    }

    // Verificar validez básica
    if (!coupon.isValid()) {
      let reason = 'Cupón inválido';
      if (coupon.isUsed) reason = 'Cupón ya utilizado';
      else if (coupon.expiresAt < new Date()) reason = 'Cupón expirado';
      else if (!coupon.isActive) reason = 'Cupón desactivado';

      return res.status(400).send({
        message: reason,
        valid: false,
        coupon: {
          code: coupon.code,
          isUsed: coupon.isUsed,
          expiresAt: coupon.expiresAt,
          usedAt: coupon.usedAt
        }
      });
    }

    // Si se proporciona orderTotal, calcular el descuento
    let discountInfo = null;
    if (orderTotal) {
      discountInfo = coupon.calculateDiscount(parseFloat(orderTotal));
    }

    res.send({
      message: 'Cupón válido',
      valid: true,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minPurchase: coupon.minPurchase,
        maxDiscount: coupon.maxDiscount,
        expiresAt: coupon.expiresAt,
        description: coupon.description
      },
      ...(discountInfo && { discount: discountInfo })
    });
  } catch (error) {
    console.error('Error validando cupón:', error);
    res.status(500).send({
      message: 'Error validando cupón',
      valid: false,
      error: error.message
    });
  }
});

// Aplicar cupón (calcular descuento para una orden)
router.post('/apply', isAuth, async (req, res) => {
  try {
    const { code, orderTotal } = req.body;

    if (!code || !orderTotal) {
      return res.status(400).send({
        message: 'Código de cupón y total de orden requeridos',
        success: false
      });
    }

    if (orderTotal <= 0) {
      return res.status(400).send({
        message: 'Total de orden inválido',
        success: false
      });
    }

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase().trim()
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

    // Calcular descuento
    const discountResult = coupon.calculateDiscount(orderTotal);

    if (!discountResult.isValid) {
      return res.status(400).send({
        message: discountResult.reason,
        success: false
      });
    }

    res.send({
      message: 'Cupón aplicado exitosamente',
      success: true,
      coupon: {
        code: coupon.code,
        description: coupon.description
      },
      calculation: {
        originalTotal: orderTotal,
        discount: discountResult.discount,
        finalTotal: discountResult.finalTotal,
        discountPercentage: coupon.discountValue
      }
    });
  } catch (error) {
    console.error('Error aplicando cupón:', error);
    res.status(500).send({
      message: 'Error aplicando cupón',
      success: false,
      error: error.message
    });
  }
});

// Marcar cupón como usado (interno, se llama desde orderRoute)
router.put('/:id/use', isAuth, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

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

    if (!coupon.isValid()) {
      return res.status(400).send({
        message: 'Cupón no válido',
        success: false
      });
    }

    await coupon.markAsUsed(req.user._id);

    res.send({
      message: 'Cupón marcado como usado',
      success: true
    });
  } catch (error) {
    console.error('Error marcando cupón como usado:', error);
    res.status(500).send({
      message: 'Error procesando cupón',
      success: false,
      error: error.message
    });
  }
});

// Obtener estadísticas de cupones (solo admin)
router.get('/stats', isAuth, isAdmin, async (req, res) => {
  try {
    const totalCoupons = await Coupon.countDocuments();
    const usedCoupons = await Coupon.countDocuments({ isUsed: true });
    const activeCoupons = await Coupon.countDocuments({ 
      isActive: true, 
      isUsed: false, 
      expiresAt: { $gt: new Date() } 
    });
    const expiredCoupons = await Coupon.countDocuments({ 
      expiresAt: { $lt: new Date() }, 
      isUsed: false 
    });

    // Estadísticas por tier
    const tierStats = await Coupon.aggregate([
      {
        $group: {
          _id: '$metadata.triggerTier',
          count: { $sum: 1 },
          used: { $sum: { $cond: ['$isUsed', 1, 0] } },
          avgTriggerAmount: { $avg: '$metadata.triggerAmount' }
        }
      }
    ]);

    res.send({
      overview: {
        total: totalCoupons,
        used: usedCoupons,
        active: activeCoupons,
        expired: expiredCoupons,
        usageRate: totalCoupons > 0 ? ((usedCoupons / totalCoupons) * 100).toFixed(2) : 0
      },
      byTier: tierStats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).send({
      message: 'Error obteniendo estadísticas',
      error: error.message
    });
  }
});

// Listar todos los cupones (solo admin)
router.get('/all', isAuth, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    
    // Filtros opcionales
    if (req.query.isUsed !== undefined) {
      filter.isUsed = req.query.isUsed === 'true';
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    if (req.query.tier) {
      filter['metadata.triggerTier'] = req.query.tier;
    }

    const coupons = await Coupon.find(filter)
      .populate('createdFor', 'name email')
      .populate('usedBy', 'name email')
      .populate('orderTrigger', 'totalPrice createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Coupon.countDocuments(filter);

    res.send({
      coupons,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error listando cupones:', error);
    res.status(500).send({
      message: 'Error listando cupones',
      error: error.message
    });
  }
});

module.exports = router;