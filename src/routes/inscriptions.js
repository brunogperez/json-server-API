import express from 'express';
import Inscription from '../models/Inscription.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Obtener todas las inscripciones
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, clientId, courseId } = req.query;
    
    let query = {};
    if (status) query.status = status;
    if (clientId) query.client = clientId;
    if (courseId) query.course = courseId;

    const inscriptions = await Inscription.find(query)
      .populate('client', 'firstName lastName email')
      .populate('course', 'name duration level')
      .sort({ createdAt: -1 });
    
    res.json(inscriptions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener inscripción por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const inscription = await Inscription.findById(req.params.id)
      .populate('client')
      .populate('course');
    
    if (!inscription) {
      return res.status(404).json({ error: 'Inscripción no encontrada' });
    }
    
    res.json(inscription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear nueva inscripción
router.post('/', async (req, res) => {
  try {
    const { client, course } = req.body;
    
    // Verificar si ya existe una inscripción activa
    const existingInscription = await Inscription.findOne({
      client,
      course,
      status: 'active'
    });
    
    if (existingInscription) {
      return res.status(400).json({ 
        error: 'El cliente ya está inscrito en este curso' 
      });
    }

    const inscription = new Inscription(req.body);
    await inscription.save();
    
    const populatedInscription = await Inscription.findById(inscription._id)
      .populate('client', 'firstName lastName email')
      .populate('course', 'name duration level');
    
    res.status(201).json(populatedInscription);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Actualizar inscripción
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const inscription = await Inscription.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('client', 'firstName lastName email')
     .populate('course', 'name duration level');
    
    if (!inscription) {
      return res.status(404).json({ error: 'Inscripción no encontrada' });
    }
    
    res.json(inscription);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Actualizar progreso de inscripción
router.patch('/:id/progress', authenticateToken, async (req, res) => {
  try {
    const { progress } = req.body;
    
    if (progress < 0 || progress > 100) {
      return res.status(400).json({ 
        error: 'El progreso debe estar entre 0 y 100' 
      });
    }

    const updateData = { progress };
    if (progress === 100) {
      updateData.status = 'completed';
      updateData.completionDate = new Date();
    }

    const inscription = await Inscription.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('client', 'firstName lastName email')
     .populate('course', 'name duration level');
    
    if (!inscription) {
      return res.status(404).json({ error: 'Inscripción no encontrada' });
    }
    
    res.json(inscription);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar inscripción
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const inscription = await Inscription.findByIdAndDelete(req.params.id);
    if (!inscription) {
      return res.status(404).json({ error: 'Inscripción no encontrada' });
    }
    res.json({ message: 'Inscripción eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener estadísticas de inscripciones
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const stats = await Inscription.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const totalInscriptions = await Inscription.countDocuments();
    const averageProgress = await Inscription.aggregate([
      {
        $group: {
          _id: null,
          averageProgress: { $avg: '$progress' }
        }
      }
    ]);

    res.json({
      totalInscriptions,
      statusDistribution: stats,
      averageProgress: averageProgress[0]?.averageProgress || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;