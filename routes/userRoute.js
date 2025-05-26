const express = require('express');
const User = require('../models/userModel');
const { getToken, isAuth } = require('../util');
const { sendPasswordResetEmail, sendPasswordChangeConfirmation } = require('../utils/emailService');
const crypto = require('crypto');

const router = express.Router();

// Actualizar usuario por ID
router.put('/:id', isAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    
    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      if (req.body.password) {
        user.password = req.body.password; // Se hasheará automáticamente
      }
      
      const updatedUser = await user.save();
      res.send({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
        token: getToken(updatedUser),
      });
    } else {
      res.status(404).send({ message: 'User Not Found' });
    }
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

// Iniciar sesión
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Buscar usuario por email
    const user = await User.findByEmail(email);
    
    if (user && await user.matchPassword(password)) {
      res.send({
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        token: getToken(user),
      });
    } else {
      res.status(401).send({ message: 'Invalid Email or Password.' });
    }
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Registrar usuario
router.post('/register', async (req, res) => {
  try {
    // Verificar si el usuario ya existe
    const existingUser = await User.findByEmail(req.body.email);
    if (existingUser) {
      return res.status(400).send({ message: 'User already exists with this email' });
    }

    const user = new User({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
    });
    
    const newUser = await user.save();
    
    if (newUser) {
      res.status(201).send({
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        isAdmin: newUser.isAdmin,
        token: getToken(newUser),
      });
    } else {
      res.status(400).send({ message: 'Invalid User Data.' });
    }
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

// Solicitar reset de password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).send({ 
        message: 'El email es requerido' 
      });
    }

    // Buscar usuario por email
    const user = await User.findByEmail(email);
    
    if (!user) {
      // Por seguridad, no revelamos si el email existe o no
      return res.status(200).send({
        message: 'Si el email existe en nuestro sistema, recibirás un enlace de recuperación.',
        success: true
      });
    }

    // Verificar rate limiting
    const canRequest = user.canRequestPasswordReset();
    if (!canRequest.canRequest) {
      return res.status(429).send({
        message: canRequest.reason,
        waitTime: Math.ceil(canRequest.waitTime / (1000 * 60)), // en minutos
        success: false
      });
    }

    // Generar token de reset
    const resetToken = user.createPasswordResetToken();
    
    // Guardar usuario con el token
    await user.save();

    try {
      // Enviar email
      await sendPasswordResetEmail(user.email, resetToken, user.name);
      
      res.status(200).send({
        message: 'Se ha enviado un enlace de recuperación a tu email.',
        success: true
      });
    } catch (emailError) {
      console.error('Error enviando email:', emailError);
      
      // Limpiar el token si el email falla
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save();
      
      res.status(500).send({
        message: 'Error enviando el email. Intenta nuevamente.',
        success: false
      });
    }
  } catch (error) {
    console.error('Error en forgot-password:', error);
    res.status(500).send({ 
      message: 'Error interno del servidor',
      success: false
    });
  }
});

// Validar token de reset
router.get('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).send({
        message: 'Token es requerido',
        valid: false
      });
    }

    // Hashear el token para comparar
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Buscar usuario con el token válido y no expirado
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).send({
        message: 'Token inválido o expirado',
        valid: false
      });
    }

    res.status(200).send({
      message: 'Token válido',
      valid: true,
      email: user.email,
      userName: user.name
    });
  } catch (error) {
    console.error('Error validando token:', error);
    res.status(500).send({
      message: 'Error interno del servidor',
      valid: false
    });
  }
});

// Resetear password con token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    // Validaciones básicas
    if (!token || !password || !confirmPassword) {
      return res.status(400).send({
        message: 'Token, contraseña y confirmación son requeridos',
        success: false
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).send({
        message: 'Las contraseñas no coinciden',
        success: false
      });
    }

    if (password.length < 4) {
      return res.status(400).send({
        message: 'La contraseña debe tener al menos 4 caracteres',
        success: false
      });
    }

    // Hashear el token para comparar
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Buscar usuario con el token válido y no expirado
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).send({
        message: 'Token inválido o expirado',
        success: false
      });
    }

    // Resetear password
    user.resetPassword(password);
    await user.save();

    try {
      // Enviar email de confirmación
      await sendPasswordChangeConfirmation(user.email, user.name);
    } catch (emailError) {
      console.error('Error enviando confirmación:', emailError);
      // No fallar la operación si el email de confirmación falla
    }

    res.status(200).send({
      message: 'Contraseña cambiada exitosamente',
      success: true
    });
  } catch (error) {
    console.error('Error en reset password:', error);
    res.status(500).send({
      message: 'Error interno del servidor',
      success: false
    });
  }
});

// Cambiar password (usuario autenticado)
router.put('/change-password', isAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validaciones
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).send({
        message: 'Todos los campos son requeridos',
        success: false
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).send({
        message: 'Las contraseñas nuevas no coinciden',
        success: false
      });
    }

    if (newPassword.length < 4) {
      return res.status(400).send({
        message: 'La nueva contraseña debe tener al menos 4 caracteres',
        success: false
      });
    }

    // Buscar usuario
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).send({
        message: 'Usuario no encontrado',
        success: false
      });
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await user.matchPassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).send({
        message: 'La contraseña actual es incorrecta',
        success: false
      });
    }

    // Cambiar contraseña
    user.password = newPassword; // Se hasheará automáticamente
    await user.save();

    try {
      // Enviar email de confirmación
      await sendPasswordChangeConfirmation(user.email, user.name);
    } catch (emailError) {
      console.error('Error enviando confirmación:', emailError);
    }

    res.status(200).send({
      message: 'Contraseña cambiada exitosamente',
      success: true
    });
  } catch (error) {
    console.error('Error en change password:', error);
    res.status(500).send({
      message: 'Error interno del servidor',
      success: false
    });
  }
});

// Crear admin (solo para desarrollo)
router.get('/createadmin', async (req, res) => {
  try {
    // Verificar si ya existe un admin
    const adminExists = await User.findOne({ isAdmin: true });
    if (adminExists) {
      return res.status(400).send({ message: 'Admin user already exists' });
    }

    const user = new User({
      name: 'Admin',
      email: 'admin@example.com',
      password: '1234',
      isAdmin: true,
    });
    
    const newUser = await user.save();
    res.send({
      message: 'Admin user created successfully',
      user: newUser.toPublicJSON()
    });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

module.exports = router;