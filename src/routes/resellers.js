import express from 'express';
import mongoose from 'mongoose';
import Reseller from '../models/Reseller.js';
import CreditTransaction from '../models/CreditTransaction.js';
import { authenticateToken, requireAdmin, requireAdminOrReseller, resellerScopeId } from '../middleware/auth.js';
import { handleValidation, handleError, searchPattern } from '../middleware/helpers.js';
import {
  validateCreateReseller,
  validateUpdateReseller,
  validateTopup,
  validateAdjust,
  validateMongoId
} from '../validators/resellerValidators.js';

const router = express.Router();

router.use(authenticateToken);

// Listar resellers (excluye owner por defecto, ?includeOwner=true lo incluye)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { includeOwner, active, search } = req.query;
    const query = {};
    if (includeOwner !== 'true') query.isOwner = { $ne: true };
    if (active !== undefined) query.active = active === 'true';
    const pattern = searchPattern(search);
    if (pattern) {
      query.$or = [
        { firstName: { $regex: pattern, $options: 'i' } },
        { lastName: { $regex: pattern, $options: 'i' } },
        { email: { $regex: pattern, $options: 'i' } },
        { businessName: { $regex: pattern, $options: 'i' } }
      ];
    }
    const resellers = await Reseller.find(query).sort({ createdAt: -1 });
    res.json(resellers);
  } catch (error) {
    handleError(res, error, 'Error al listar resellers');
  }
});

// Owner reseller (vos)
router.get('/owner', requireAdmin, async (req, res) => {
  try {
    const owner = await Reseller.findOne({ isOwner: true });
    if (!owner) return res.status(404).json({ error: 'Owner no configurado' });
    res.json(owner);
  } catch (error) {
    handleError(res, error, 'Error al obtener owner');
  }
});

router.get('/:id', requireAdminOrReseller, validateMongoId, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const scope = resellerScopeId(req);
    if (scope && req.params.id !== scope) {
      return res.status(403).json({ error: 'No autorizado para ver este reseller' });
    }
    const reseller = await Reseller.findById(req.params.id);
    if (!reseller) return res.status(404).json({ error: 'Reseller no encontrado' });
    res.json(reseller);
  } catch (error) {
    handleError(res, error, 'Error al obtener reseller');
  }
});

router.post('/', requireAdmin, validateCreateReseller, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const reseller = new Reseller({ ...req.body, isOwner: false });
    await reseller.save();

    if (reseller.credits > 0) {
      await CreditTransaction.create({
        reseller: reseller._id,
        type: 'topup',
        amount: reseller.credits,
        balanceAfter: reseller.credits,
        note: 'Saldo inicial',
        performedBy: req.user._id
      });
    }

    res.status(201).json(reseller);
  } catch (error) {
    handleError(res, error, 'Error al crear reseller');
  }
});

router.put('/:id', requireAdmin, validateMongoId, validateUpdateReseller, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const updates = { ...req.body };
    delete updates.credits;
    delete updates.isOwner;
    const reseller = await Reseller.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    if (!reseller) return res.status(404).json({ error: 'Reseller no encontrado' });
    res.json(reseller);
  } catch (error) {
    handleError(res, error, 'Error al actualizar reseller');
  }
});

router.delete('/:id', requireAdmin, validateMongoId, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const reseller = await Reseller.findById(req.params.id);
    if (!reseller) return res.status(404).json({ error: 'Reseller no encontrado' });
    if (reseller.isOwner) return res.status(400).json({ error: 'No se puede eliminar el owner' });
    await reseller.deleteOne();
    res.json({ message: 'Reseller eliminado correctamente' });
  } catch (error) {
    handleError(res, error, 'Error al eliminar reseller');
  }
});

// Topup: sumar créditos
router.post('/:id/credits/topup', requireAdmin, validateMongoId, validateTopup, async (req, res) => {
  if (!handleValidation(req, res)) return;
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const reseller = await Reseller.findById(req.params.id).session(session);
      if (!reseller) throw Object.assign(new Error('Reseller no encontrado'), { statusCode: 404 });
      if (reseller.isOwner) throw Object.assign(new Error('Owner no usa créditos'), { statusCode: 400 });

      reseller.credits += req.body.amount;
      await reseller.save({ session });

      const tx = await CreditTransaction.create([{
        reseller: reseller._id,
        type: 'topup',
        amount: req.body.amount,
        balanceAfter: reseller.credits,
        note: req.body.note || 'Carga de créditos',
        performedBy: req.user._id
      }], { session });

      result = { reseller, transaction: tx[0] };
    });
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Error en topup');
  } finally {
    session.endSession();
  }
});

// Adjust: ajuste manual (positivo o negativo)
router.post('/:id/credits/adjust', requireAdmin, validateMongoId, validateAdjust, async (req, res) => {
  if (!handleValidation(req, res)) return;
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const reseller = await Reseller.findById(req.params.id).session(session);
      if (!reseller) throw Object.assign(new Error('Reseller no encontrado'), { statusCode: 404 });
      if (reseller.isOwner) throw Object.assign(new Error('Owner no usa créditos'), { statusCode: 400 });

      const newBalance = reseller.credits + req.body.amount;
      if (newBalance < 0) throw Object.assign(new Error('Saldo no puede quedar negativo'), { statusCode: 400 });

      reseller.credits = newBalance;
      await reseller.save({ session });

      const tx = await CreditTransaction.create([{
        reseller: reseller._id,
        type: 'adjustment',
        amount: req.body.amount,
        balanceAfter: reseller.credits,
        note: req.body.note || 'Ajuste manual',
        performedBy: req.user._id
      }], { session });

      result = { reseller, transaction: tx[0] };
    });
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Error en ajuste');
  } finally {
    session.endSession();
  }
});

export default router;
