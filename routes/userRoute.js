const express = require('express');
const User = require('../models/userModel');
const { getToken, isAuth } = require('../util');

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