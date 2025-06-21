import express from 'express';
import Product from '../models/Product.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Obtener todos los productos
router.get('/', async (req, res) => {
  try {
    const { level, search } = req.query;
    
    let query = {};
    if (level) {
      query.level = level;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener producto por ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear nuevo producto
router.post('/', authenticateToken, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Actualizar producto
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar producto
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregar clase a un producto
router.post('/:id/classes', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    product.classes.push(req.body);
    await product.save();
    
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Actualizar clase de un producto
router.put('/:id/classes/:classId', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const classIndex = product.classes.findIndex(
      c => c._id.toString() === req.params.classId
    );

    if (classIndex === -1) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    Object.assign(product.classes[classIndex], req.body);
    await product.save();
    
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar clase de un producto
router.delete('/:id/classes/:classId', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const classIndex = product.classes.findIndex(
      c => c._id.toString() === req.params.classId
    );

    if (classIndex === -1) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    product.classes.splice(classIndex, 1);
    await product.save();
    
    res.json({ message: 'Clase eliminada correctamente' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;