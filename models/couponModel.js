const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [6, 'El código debe tener al menos 6 caracteres'],
    maxlength: [20, 'El código no puede tener más de 20 caracteres']
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage',
    required: true
  },
  discountValue: {
    type: Number,
    required: [true, 'El valor del descuento es requerido'],
    min: [0, 'El descuento no puede ser negativo'],
    max: [100, 'El descuento porcentual no puede ser mayor al 100%']
  },
  minPurchase: {
    type: Number,
    required: [true, 'El mínimo de compra es requerido'],
    min: [0, 'El mínimo de compra no puede ser negativo'],
    default: 0
  },
  maxDiscount: {
    type: Number,
    min: [0, 'El descuento máximo no puede ser negativo'],
    default: null // null = sin límite
  },
  expiresAt: {
    type: Date,
    required: [true, 'La fecha de expiración es requerida']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  usedAt: {
    type: Date,
    default: null
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdFor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El cupón debe estar asignado a un usuario']
  },
  orderTrigger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'El cupón debe estar vinculado a una orden que lo generó']
  },
  generationType: {
    type: String,
    enum: ['automatic', 'manual'],
    default: 'automatic'
  },
  description: {
    type: String,
    default: ''
  },
  // Metadatos para analytics
  metadata: {
    triggerAmount: Number, // Monto que generó el cupón
    triggerTier: String // '5%', '10%', '15%'
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
couponSchema.index({ code: 1 });
couponSchema.index({ createdFor: 1 });
couponSchema.index({ expiresAt: 1 });
couponSchema.index({ isActive: 1, isUsed: 1 });

// Método para verificar si el cupón está válido
couponSchema.methods.isValid = function() {
  const now = new Date();
  return this.isActive && !this.isUsed && this.expiresAt > now;
};

// Método para calcular el descuento aplicable
couponSchema.methods.calculateDiscount = function(orderTotal) {
  if (!this.isValid()) {
    return {
      isValid: false,
      reason: 'Cupón inválido o expirado',
      discount: 0
    };
  }

  if (orderTotal < this.minPurchase) {
    return {
      isValid: false,
      reason: `Compra mínima requerida: $${this.minPurchase}`,
      discount: 0
    };
  }

  let discount = 0;
  
  if (this.discountType === 'percentage') {
    discount = (orderTotal * this.discountValue) / 100;
  } else {
    discount = this.discountValue;
  }

  // Aplicar límite máximo si existe
  if (this.maxDiscount && discount > this.maxDiscount) {
    discount = this.maxDiscount;
  }

  // No puede descontar más que el total de la orden
  if (discount > orderTotal) {
    discount = orderTotal;
  }

  return {
    isValid: true,
    discount: Math.round(discount * 100) / 100, // Redondear a 2 decimales
    discountType: this.discountType,
    discountValue: this.discountValue,
    finalTotal: Math.round((orderTotal - discount) * 100) / 100
  };
};

// Método para marcar como usado
couponSchema.methods.markAsUsed = function(userId) {
  this.isUsed = true;
  this.usedAt = new Date();
  this.usedBy = userId;
  return this.save();
};

// Método estático para generar código único
couponSchema.statics.generateUniqueCode = async function(prefix = '') {
  let code;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    // Generar código más corto: PREFIX + 4 dígitos aleatorios
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const timestamp = Date.now().toString().slice(-3); // Últimos 3 dígitos del timestamp
    
    if (prefix) {
      code = `${prefix}${randomPart}${timestamp}`;
    } else {
      code = `SAVE${randomPart}${timestamp}`;
    }

    attempts++;
    
    // Verificar si ya existe
    const existing = await this.findOne({ code });
    if (!existing) break;
    
  } while (attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    throw new Error('No se pudo generar un código único después de varios intentos');
  }

  return code;
};

// Método estático para determinar cupón por monto
couponSchema.statics.getCouponTierByAmount = function(amount) {
  if (amount >= 1000) {
    return {
      discountValue: 15,
      tier: '15%',
      minPurchase: 1000,
      maxDiscount: 150, // Límite de $150
      description: '¡Felicidades! Has ganado un 15% de descuento por tu gran compra'
    };
  } else if (amount >= 500) {
    return {
      discountValue: 10,
      tier: '10%',
      minPurchase: 500,
      maxDiscount: 50, // Límite de $50
      description: '¡Excelente! Has ganado un 10% de descuento'
    };
  } else if (amount >= 200) {
    return {
      discountValue: 5,
      tier: '5%',
      minPurchase: 200,
      maxDiscount: 25, // Límite de $25
      description: '¡Gracias por tu compra! Has ganado un 5% de descuento'
    };
  }
  
  return null; // No califica para cupón
};

// Método estático para crear cupón automático
couponSchema.statics.createAutomaticCoupon = async function(userId, orderId, orderTotal) {
  const tier = this.getCouponTierByAmount(orderTotal);
  
  if (!tier) {
    return null; // No califica
  }

  // Generar código personalizado más corto basado en el tier
  const prefix = `SAVE${tier.discountValue}`;
  const code = await this.generateUniqueCode(prefix);

  // Crear cupón con expiración de 10 días
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 10);

  const coupon = new this({
    code,
    discountType: 'percentage',
    discountValue: tier.discountValue,
    minPurchase: 0, // Pueden usarlo en cualquier compra futura
    maxDiscount: tier.maxDiscount,
    expiresAt,
    createdFor: userId,
    orderTrigger: orderId,
    description: tier.description,
    metadata: {
      triggerAmount: orderTotal,
      triggerTier: tier.tier
    }
  });

  return await coupon.save();
};

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;