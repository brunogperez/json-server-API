import express from 'express';
import Plan from '../models/Plan.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { handleValidation, handleError, searchPattern } from '../middleware/helpers.js';
import {
  validateCreatePlan,
  validateUpdatePlan,
  validateMongoId
} from '../validators/planValidators.js';

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const { active, serviceType, search } = req.query;
    const query = {};
    if (active !== undefined) query.active = active === 'true';
    if (serviceType) query.serviceType = serviceType;
    const pattern = searchPattern(search);
    if (pattern) {
      query.$or = [
        { name: { $regex: pattern, $options: 'i' } },
        { description: { $regex: pattern, $options: 'i' } },
        { serviceType: { $regex: pattern, $options: 'i' } }
      ];
    }
    const plans = await Plan.find(query).sort({ serviceType: 1, creditCost: 1 });
    res.json(plans);
  } catch (error) {
    handleError(res, error, 'Error al listar planes');
  }
});

router.get('/service-types', async (req, res) => {
  try {
    const types = await Plan.distinct('serviceType', { active: true });
    res.json(types);
  } catch (error) {
    handleError(res, error, 'Error al listar tipos de servicio');
  }
});

router.get('/:id', validateMongoId, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json(plan);
  } catch (error) {
    handleError(res, error, 'Error al obtener plan');
  }
});

router.post('/', validateCreatePlan, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const plan = new Plan(req.body);
    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    handleError(res, error, 'Error al crear plan');
  }
});

router.put('/:id', validateMongoId, validateUpdatePlan, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json(plan);
  } catch (error) {
    handleError(res, error, 'Error al actualizar plan');
  }
});

router.delete('/:id', validateMongoId, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json({ message: 'Plan eliminado correctamente' });
  } catch (error) {
    handleError(res, error, 'Error al eliminar plan');
  }
});

export default router;
