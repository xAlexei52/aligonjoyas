const express = require('express');
const Product = require('../models/productModel');
const { isAuth, isAdmin } = require('../util');

const router = express.Router();

// Obtener todos los productos con filtros
router.get('/', async (req, res) => {
  try {
    const category = req.query.category ? { category: req.query.category } : {};
    const searchKeyword = req.query.searchKeyword
      ? {
          name: {
            $regex: req.query.searchKeyword,
            $options: 'i',
          },
        }
      : {};
    const sortOrder = req.query.sortOrder
      ? req.query.sortOrder === 'lowest'
        ? { price: 1 }
        : { price: -1 }
      : { _id: -1 };

    const products = await Product.find({ 
      ...category, 
      ...searchKeyword,
      isActive: true 
    }).sort(sortOrder);
    
    res.send(products);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Obtener producto por ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ 
      _id: req.params.id,
      isActive: true 
    }).populate('reviews.user', 'name');
    
    if (product) {
      res.send(product);
    } else {
      res.status(404).send({ message: 'Product Not Found.' });
    }
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Crear review para un producto
router.post('/:id/reviews', isAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (product) {
      // Verificar si el usuario ya hizo una review
      const alreadyReviewed = product.reviews.find(
        r => r.user.toString() === req.user._id.toString()
      );

      if (alreadyReviewed) {
        return res.status(400).send({ message: 'Product already reviewed' });
      }

      const review = {
        user: req.user._id,
        name: req.body.name || req.user.name,
        rating: Number(req.body.rating),
        comment: req.body.comment,
      };

      product.reviews.push(review);
      product.updateRating(); // Actualizar rating promedio
      
      const updatedProduct = await product.save();
      
      res.status(201).send({
        message: 'Review saved successfully.',
        data: updatedProduct.reviews[updatedProduct.reviews.length - 1],
      });
    } else {
      res.status(404).send({ message: 'Product Not Found' });
    }
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

// Actualizar producto (solo admin)
router.put('/:id', isAuth, isAdmin, async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    
    if (product) {
      product.name = req.body.name || product.name;
      product.price = req.body.price || product.price;
      product.image = req.body.image || product.image;
      product.brand = req.body.brand || product.brand;
      product.category = req.body.category || product.category;
      product.countInStock = req.body.countInStock !== undefined 
        ? req.body.countInStock 
        : product.countInStock;
      product.description = req.body.description || product.description;
      
      const updatedProduct = await product.save();
      
      if (updatedProduct) {
        return res.status(200).send({ 
          message: 'Product Updated', 
          data: updatedProduct 
        });
      }
    }
    return res.status(404).send({ message: 'Product Not Found.' });
  } catch (error) {
    return res.status(500).send({ message: 'Error in Updating Product.', error: error.message });
  }
});

// Eliminar producto (solo admin)
router.delete('/:id', isAuth, isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (product) {
      // En lugar de eliminar, marcamos como inactivo
      product.isActive = false;
      await product.save();
      res.send({ message: 'Product Deleted' });
    } else {
      res.status(404).send({ message: 'Product Not Found.' });
    }
  } catch (error) {
    res.status(500).send({ message: 'Error in Deletion.', error: error.message });
  }
});

// Crear producto (solo admin)
router.post('/', isAuth, isAdmin, async (req, res) => {
  try {
    const product = new Product({
      name: req.body.name,
      price: req.body.price,
      image: req.body.image,
      brand: req.body.brand,
      category: req.body.category,
      countInStock: req.body.countInStock,
      description: req.body.description,
      rating: req.body.rating || 0,
      numReviews: req.body.numReviews || 0,
    });
    
    const newProduct = await product.save();
    
    if (newProduct) {
      return res.status(201).send({ 
        message: 'New Product Created', 
        data: newProduct 
      });
    }
    return res.status(500).send({ message: 'Error in Creating Product.' });
  } catch (error) {
    return res.status(400).send({ 
      message: 'Error in Creating Product.', 
      error: error.message 
    });
  }
});

module.exports = router;