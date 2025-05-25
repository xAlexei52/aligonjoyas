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
  price: { type: Number, required: true }, // Cambiado de String a Number
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
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
  }
}, {
  timestamps: true
});

// Índices para mejorar las consultas
orderSchema.index({ user: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderStatus: 1 });

// Método para calcular el total de la orden
orderSchema.methods.calculateTotal = function() {
  this.itemsPrice = this.orderItems.reduce((acc, item) => acc + item.qty * item.price, 0);
  this.taxPrice = Number((0.15 * this.itemsPrice).toFixed(2)); // 15% tax
  this.totalPrice = Number((this.itemsPrice + this.taxPrice + this.shippingPrice).toFixed(2));
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

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;