import express from 'express';
import Client from '../models/Client.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Obtener todos los clientes
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const clients = await Client.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Client.countDocuments(query);
    
    res.json({
      clients,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener cliente por ID
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear nuevo cliente
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, email, birthdate } = req.body;
    
    const existingClient = await Client.findOne({ email });
    if (existingClient) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // Generar token simple
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const client = new Client({
      firstName,
      lastName,
      email,
      birthdate,
      token
    });

    await client.save();
    res.status(201).json(client);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Actualizar cliente
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json(client);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar cliente
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json({ message: 'Cliente eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;