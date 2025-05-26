const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'El nombre es requerido'],
    trim: true,
    minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    maxlength: [50, 'El nombre no puede tener más de 50 caracteres']
  },
  email: {
    type: String, 
    required: [true, 'El email es requerido'], 
    unique: true, 
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Por favor ingresa un email válido']
  },
  password: { 
    type: String, 
    required: [true, 'La contraseña es requerida'],
    minlength: [4, 'La contraseña debe tener al menos 4 caracteres']
  },
  isAdmin: { 
    type: Boolean, 
    required: true, 
    default: false 
  },
  avatar: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    default: null
  },
  address: {
    street: String,
    city: String,
    postalCode: String,
    country: String
  },
  // Campos para reset de password
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  // Campo para tracking de intentos de reset
  passwordResetAttempts: {
    type: Number,
    default: 0
  },
  lastPasswordResetRequest: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Esto añade createdAt y updatedAt automáticamente
});

// Índices para mejorar las consultas
userSchema.index({ email: 1 });
userSchema.index({ passwordResetToken: 1 });

// Middleware para hashear la contraseña antes de guardar
userSchema.pre('save', async function(next) {
  // Solo hashear la contraseña si ha sido modificada (o es nueva)
  if (!this.isModified('password')) return next();
  
  try {
    // Hashear la contraseña con un salt de 10 rounds
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar contraseñas
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Método para obtener datos públicos del usuario (sin contraseña)
userSchema.methods.toPublicJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  delete user.passwordResetAttempts;
  return user;
};

// Método estático para encontrar usuario por email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Método para generar token de reset de password
userSchema.methods.createPasswordResetToken = function() {
  // Generar token aleatorio
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hashear el token y guardarlo en la base de datos
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Configurar expiración (1 hora)
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hora en milisegundos
  
  // Tracking de intentos
  this.passwordResetAttempts = (this.passwordResetAttempts || 0) + 1;
  this.lastPasswordResetRequest = Date.now();
  
  // Retornar el token sin hashear (este se enviará por email)
  return resetToken;
};

// Método para validar token de reset
userSchema.methods.validatePasswordResetToken = function(token) {
  // Hashear el token recibido
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  // Verificar si el token coincide y no ha expirado
  return (
    this.passwordResetToken === hashedToken &&
    this.passwordResetExpires > Date.now()
  );
};

// Método para resetear password
userSchema.methods.resetPassword = function(newPassword) {
  this.password = newPassword; // Se hasheará automáticamente por el middleware
  this.passwordResetToken = null;
  this.passwordResetExpires = null;
  // No reseteamos passwordResetAttempts para mantener el historial
};

// Método para verificar si puede solicitar reset (rate limiting)
userSchema.methods.canRequestPasswordReset = function() {
  const now = Date.now();
  const lastRequest = this.lastPasswordResetRequest;
  const attempts = this.passwordResetAttempts || 0;
  
  // Si es el primer intento, permitir
  if (!lastRequest) return { canRequest: true };
  
  const timeSinceLastRequest = now - lastRequest;
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;
  
  // Si han pasado más de 24 horas, resetear contador
  if (timeSinceLastRequest > oneDay) {
    this.passwordResetAttempts = 0;
    return { canRequest: true };
  }
  
  // Limitar intentos: máximo 3 por hora, 5 por día
  if (timeSinceLastRequest < oneHour && attempts >= 3) {
    return {
      canRequest: false,
      reason: 'Demasiados intentos por hora. Intenta en 1 hora.',
      waitTime: oneHour - timeSinceLastRequest
    };
  }
  
  if (attempts >= 5) {
    return {
      canRequest: false,
      reason: 'Demasiados intentos por día. Intenta mañana.',
      waitTime: oneDay - timeSinceLastRequest
    };
  }
  
  return { canRequest: true };
};

const User = mongoose.model('User', userSchema);

module.exports = User;