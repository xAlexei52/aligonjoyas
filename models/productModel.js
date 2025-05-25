const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: { 
    type: String, 
    required: [true, 'El nombre del reviewer es requerido'] 
  },
  rating: { 
    type: Number, 
    required: [true, 'La calificación es requerida'],
    min: [1, 'La calificación mínima es 1'],
    max: [5, 'La calificación máxima es 5']
  },
  comment: { 
    type: String, 
    required: [true, 'El comentario es requerido'],
    maxlength: [500, 'El comentario no puede exceder los 500 caracteres']
  },
}, {
  timestamps: true
});

const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'El nombre del producto es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder los 100 caracteres']
  },
  image: { 
    type: String, 
    required: [true, 'La imagen del producto es requerida']
  },
  brand: { 
    type: String, 
    required: [true, 'La marca es requerida'],
    trim: true
  },
  price: { 
    type: Number, 
    required: [true, 'El precio es requerido'],
    min: [0, 'El precio no puede ser negativo']
  },
  category: { 
    type: String, 
    required: [true, 'La categoría es requerida'],
    trim: true
  },
  countInStock: { 
    type: Number, 
    required: [true, 'La cantidad en stock es requerida'],
    min: [0, 'El stock no puede ser negativo'],
    default: 0
  },
  description: { 
    type: String, 
    required: [true, 'La descripción es requerida'],
    maxlength: [2000, 'La descripción no puede exceder los 2000 caracteres']
  },
  rating: { 
    type: Number, 
    required: true,
    default: 0,
    min: 0,
    max: 5
  },
  numReviews: { 
    type: Number, 
    required: true,
    default: 0,
    min: 0
  },
  reviews: [reviewSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índices para mejorar las consultas
productSchema.index({ category: 1 });
productSchema.index({ name: 'text', description: 'text' }); // Para búsqueda de texto
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });

// Método para actualizar el rating promedio cuando se añade una review
productSchema.methods.updateRating = function() {
  if (this.reviews.length > 0) {
    const totalRating = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    this.rating = Math.round((totalRating / this.reviews.length) * 10) / 10;
    this.numReviews = this.reviews.length;
  } else {
    this.rating = 0;
    this.numReviews = 0;
  }
};

// Método para verificar si hay stock disponible
productSchema.methods.hasStock = function(quantity = 1) {
  return this.countInStock >= quantity;
};

// Método para reducir stock
productSchema.methods.reduceStock = function(quantity) {
  if (this.hasStock(quantity)) {
    this.countInStock -= quantity;
    return true;
  }
  return false;
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;