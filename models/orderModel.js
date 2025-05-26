const mongoose = require('mongoose');

const shippingSchema = new mongoose.Schema({
  address: { type: String, required: true },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true },
});

const paymentSchema = new mongoose.Schema({
  paymentMethod: { type: String, required: true },
  paymentResult: {
    id: String,
    status: String,
    update_time: String,
    email_address: String,
    payerID: String,
    orderID: String,
    paymentID: String
  }
});

const orderItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qty: { type: Number, required: true },
  image: { type: String, required: true },
  price: { type: Number, required: true },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
});

// Nuevo schema para cupón aplicado
const appliedCouponSchema = new mongoose.Schema({
  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true
  },
  code: {
    type: String,
    required: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    required: true,
    min: 0
  }
});

const orderSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  orderItems: [orderItemSchema],
  shipping: shippingSchema,
  payment: paymentSchema,
  itemsPrice: { 
    type: Number,
    required: true,
    default: 0.0
  },
  taxPrice: { 
    type: Number,
    required: true,
    default: 0.0
  },
  shippingPrice: { 
    type: Number,
    required: true,
    default: 0.0
  },
  // Nuevos campos para cupones
  appliedCoupon: {
    type: appliedCouponSchema,
    default: null
  },
  discountAmount: {
    type: Number,
    default: 0.0,
    min: 0
  },
  subtotal: {
    type: Number,
    required: true,
    default: 0.0
  },
  totalPrice: { 
    type: Number,
    required: true,
    default: 0.0
  },
  isPaid: { 
    type: Boolean, 
    default: false 
  },
  paidAt: { 
    type: Date 
  },
  isDelivered: { 
    type: Boolean, 
    default: false 
  },
  deliveredAt: { 
    type: Date 
  },
  orderStatus: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  // Campo para rastrear si se generó cupón
  couponGenerated: {
    type: Boolean,
    default: false
  },
  generatedCouponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    default: null
  }
}, {
  timestamps: true
});

// Índices para mejorar las consultas
orderSchema.index({ user: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ 'appliedCoupon.code': 1 });

// Método para calcular el total de la orden (con o sin cupón)
orderSchema.methods.calculateTotal = function(couponDiscount = 0) {
  // Calcular subtotal de items
  this.itemsPrice = this.orderItems.reduce((acc, item) => acc + item.qty * item.price, 0);
  
  // Calcular subtotal (items + shipping)
  this.subtotal = this.itemsPrice + this.shippingPrice;
  
  // Aplicar descuento si existe
  this.discountAmount = couponDiscount;
  
  // Calcular impuestos sobre el subtotal después del descuento
  const taxableAmount = Math.max(0, this.subtotal - this.discountAmount);
  this.taxPrice = Number((0.15 * taxableAmount).toFixed(2)); // 15% tax
  
  // Calcular total final
  this.totalPrice = Number((this.subtotal - this.discountAmount + this.taxPrice).toFixed(2));
  
  // Asegurar que el total no sea negativo
  if (this.totalPrice < 0) {
    this.totalPrice = 0;
  }
};

// Método para aplicar cupón
orderSchema.methods.applyCoupon = function(coupon, discountAmount) {
  this.appliedCoupon = {
    couponId: coupon._id,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discountAmount: discountAmount
  };
  
  // Recalcular totales con el descuento
  this.calculateTotal(discountAmount);
};

// Método para marcar como pagado
orderSchema.methods.markAsPaid = function(paymentResult) {
  this.isPaid = true;
  this.paidAt = Date.now();
  this.payment.paymentResult = paymentResult;
  return this.save();
};

// Método para marcar como entregado
orderSchema.methods.markAsDelivered = function() {
  this.isDelivered = true;
  this.deliveredAt = Date.now();
  this.orderStatus = 'Delivered';
  return this.save();
};

// Método para determinar si califica para cupón
orderSchema.methods.qualifiesForCoupon = function() {
  // Solo órdenes pagadas califican
  if (!this.isPaid) return false;
  
  // No generar cupón si ya se generó uno
  if (this.couponGenerated) return false;
  
  // Verificar monto mínimo (sin incluir impuestos y descuentos previos)
  const baseAmount = this.itemsPrice + this.shippingPrice;
  
  return baseAmount >= 200; // Mínimo $200 para cualquier cupón
};

// Método para obtener el monto base para cupones
orderSchema.methods.getCouponBaseAmount = function() {
  return this.itemsPrice + this.shippingPrice;
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;