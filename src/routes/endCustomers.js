import express from 'express';
import EndCustomer from '../models/EndCustomer.js';
import Reseller from '../models/Reseller.js';
import { authenticateToken, requireAdmin, requireAdminOrReseller, resellerScopeId } from '../middleware/auth.js';
import { handleValidation, handleError } from '../middleware/helpers.js';
import {
  validateCreateEndCustomer,
  validateUpdateEndCustomer,
  validateMongoId
} from '../validators/endCustomerValidators.js';

const router = express.Router();

router.use(authenticateToken);

// Lectura: admin o reseller (reseller ve solo lo suyo). Escritura: solo admin.
router.get('/', requireAdminOrReseller, async (req, res) => {
  try {
    const { reseller, active, search } = req.query;
    const query = {};
    const scope = resellerScopeId(req);
    if (scope) query.reseller = scope;          // aislamiento: fuerza su reseller
    else if (reseller) query.reseller = reseller;
    if (active !== undefined) query.active = active === 'true';
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    const customers = await EndCustomer.find(query)
      .populate('reseller', 'firstName lastName businessName isOwner')
      .sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    handleError(res, error, 'Error al listar clientes finales');
  }
});

router.get('/:id', requireAdminOrReseller, validateMongoId, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const customer = await EndCustomer.findById(req.params.id)
      .populate('reseller', 'firstName lastName businessName isOwner');
    if (!customer) return res.status(404).json({ error: 'Cliente final no encontrado' });

    const scope = resellerScopeId(req);
    if (scope && String(customer.reseller?._id ?? customer.reseller) !== scope) {
      return res.status(403).json({ error: 'No autorizado para ver este cliente' });
    }
    res.json(customer);
  } catch (error) {
    handleError(res, error, 'Error al obtener cliente final');
  }
});

router.post('/', requireAdmin, validateCreateEndCustomer, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const reseller = await Reseller.findById(req.body.reseller);
    if (!reseller) return res.status(400).json({ error: 'Reseller no existe' });

    const customer = new EndCustomer(req.body);
    await customer.save();
    await customer.populate('reseller', 'firstName lastName businessName isOwner');
    res.status(201).json(customer);
  } catch (error) {
    handleError(res, error, 'Error al crear cliente final');
  }
});

router.put('/:id', requireAdmin, validateMongoId, validateUpdateEndCustomer, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    if (req.body.reseller) {
      const r = await Reseller.findById(req.body.reseller);
      if (!r) return res.status(400).json({ error: 'Reseller no existe' });
    }
    const customer = await EndCustomer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('reseller', 'firstName lastName businessName isOwner');
    if (!customer) return res.status(404).json({ error: 'Cliente final no encontrado' });
    res.json(customer);
  } catch (error) {
    handleError(res, error, 'Error al actualizar cliente final');
  }
});

router.delete('/:id', requireAdmin, validateMongoId, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const customer = await EndCustomer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Cliente final no encontrado' });
    res.json({ message: 'Cliente final eliminado correctamente' });
  } catch (error) {
    handleError(res, error, 'Error al eliminar cliente final');
  }
});

export default router;
