import express from 'express';
import mongoose from 'mongoose';
import Subscription from '../models/Subscription.js';
import EndCustomer from '../models/EndCustomer.js';
import Plan from '../models/Plan.js';
import Reseller from '../models/Reseller.js';
import CreditTransaction from '../models/CreditTransaction.js';
import { authenticateToken, requireAdmin, requireAdminOrReseller, resellerScopeId } from '../middleware/auth.js';
import { handleValidation, handleError } from '../middleware/helpers.js';
import { encryptCredentials } from '../utils/crypto.js';
import {
  validateCreateSubscription,
  validateUpdateSubscription,
  validateRenew,
  validateMongoId
} from '../validators/subscriptionValidators.js';

const router = express.Router();

router.use(authenticateToken);

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const buildPlanSnapshot = (plan) => ({
  name: plan.name,
  serviceType: plan.serviceType,
  durationDays: plan.durationDays,
  capacity: plan.capacity,
  creditCost: plan.creditCost
});

router.get('/', requireAdminOrReseller, async (req, res) => {
  try {
    const { status, soldBy, endCustomer, plan, serviceType, expiringInDays } = req.query;
    const query = {};
    const scope = resellerScopeId(req);
    if (status) query.status = status;
    if (scope) query.soldBy = scope;            // aislamiento: solo sus ventas
    else if (soldBy) query.soldBy = soldBy;
    if (endCustomer) query.endCustomer = endCustomer;
    if (plan) query.plan = plan;
    if (serviceType) query['planSnapshot.serviceType'] = serviceType;
    if (expiringInDays) {
      const threshold = addDays(new Date(), parseInt(expiringInDays));
      query.endDate = { $lte: threshold, $gte: new Date() };
      query.status = 'active';
    }
    const subs = await Subscription.find(query)
      .populate('endCustomer', 'firstName lastName email phone')
      .populate('soldBy', 'firstName lastName businessName isOwner')
      .populate('plan', 'name serviceType durationDays capacity creditCost')
      .sort({ endDate: 1 });
    res.json(subs);
  } catch (error) {
    handleError(res, error, 'Error al listar suscripciones');
  }
});

router.get('/stats/overview', requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const [byStatus, byServiceType, totalRevenue, expiringSoon] = await Promise.all([
      Subscription.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Subscription.aggregate([
        { $group: { _id: '$planSnapshot.serviceType', count: { $sum: 1 }, revenue: { $sum: '$salePrice' } } }
      ]),
      Subscription.aggregate([
        { $group: { _id: null, total: { $sum: '$salePrice' } } }
      ]),
      Subscription.countDocuments({
        status: 'active',
        endDate: { $lte: addDays(now, 7), $gte: now }
      })
    ]);
    res.json({
      byStatus,
      byServiceType,
      totalRevenue: totalRevenue[0]?.total || 0,
      expiringInNext7Days: expiringSoon
    });
  } catch (error) {
    handleError(res, error, 'Error al obtener estadísticas');
  }
});

router.get('/:id', requireAdminOrReseller, validateMongoId, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const sub = await Subscription.findById(req.params.id)
      .populate('endCustomer')
      .populate('soldBy', 'firstName lastName businessName isOwner credits')
      .populate('plan');
    if (!sub) return res.status(404).json({ error: 'Suscripción no encontrada' });

    const scope = resellerScopeId(req);
    if (scope && String(sub.soldBy?._id ?? sub.soldBy) !== scope) {
      return res.status(403).json({ error: 'No autorizado para ver esta suscripción' });
    }
    res.json(sub);
  } catch (error) {
    handleError(res, error, 'Error al obtener suscripción');
  }
});

router.post('/', requireAdmin, validateCreateSubscription, async (req, res) => {
  if (!handleValidation(req, res)) return;
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const { endCustomer: endCustomerId, plan: planId, soldBy, salePrice, startDate, credentials, notes } = req.body;

      const customer = await EndCustomer.findById(endCustomerId).session(session);
      if (!customer) throw Object.assign(new Error('Cliente final no existe'), { statusCode: 400 });

      const plan = await Plan.findById(planId).session(session);
      if (!plan) throw Object.assign(new Error('Plan no existe'), { statusCode: 400 });
      if (!plan.active) throw Object.assign(new Error('Plan inactivo'), { statusCode: 400 });

      const resellerId = soldBy || customer.reseller;
      const reseller = await Reseller.findById(resellerId).session(session);
      if (!reseller) throw Object.assign(new Error('Reseller no existe'), { statusCode: 400 });
      if (!reseller.active) throw Object.assign(new Error('Reseller inactivo'), { statusCode: 400 });

      if (!reseller.isOwner && reseller.credits < plan.creditCost) {
        throw Object.assign(new Error(`Saldo insuficiente. Necesita ${plan.creditCost} créditos, tiene ${reseller.credits}`), { statusCode: 402 });
      }

      const start = startDate ? new Date(startDate) : new Date();
      const endDate = addDays(start, plan.durationDays);

      const subDoc = new Subscription({
        endCustomer: customer._id,
        soldBy: reseller._id,
        plan: plan._id,
        planSnapshot: buildPlanSnapshot(plan),
        salePrice,
        startDate: start,
        endDate,
        status: 'active',
        credentials: credentials || {},
        notes
      });
      await subDoc.save({ session });

      if (!reseller.isOwner && plan.creditCost > 0) {
        reseller.credits -= plan.creditCost;
        await reseller.save({ session });
        await CreditTransaction.create([{
          reseller: reseller._id,
          type: 'consume',
          amount: -plan.creditCost,
          balanceAfter: reseller.credits,
          relatedSubscription: subDoc._id,
          note: `Alta ${plan.serviceType} - ${plan.name}`,
          performedBy: req.user._id
        }], { session });
      }

      result = await Subscription.findById(subDoc._id)
        .populate('endCustomer', 'firstName lastName email phone')
        .populate('soldBy', 'firstName lastName businessName isOwner credits')
        .populate('plan', 'name serviceType durationDays capacity creditCost')
        .session(session);
    });
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Error al crear suscripción');
  } finally {
    session.endSession();
  }
});

router.put('/:id', requireAdmin, validateMongoId, validateUpdateSubscription, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const updates = { ...req.body };
    delete updates.endDate;
    delete updates.startDate;
    delete updates.planSnapshot;
    delete updates.soldBy;
    delete updates.plan;
    delete updates.endCustomer;

    // findByIdAndUpdate salta el hook pre('save'): ciframos credentials a mano.
    if (updates.credentials) {
      updates.credentials = encryptCredentials(updates.credentials);
    }

    const sub = await Subscription.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    )
      .populate('endCustomer', 'firstName lastName email phone')
      .populate('soldBy', 'firstName lastName businessName isOwner')
      .populate('plan', 'name serviceType durationDays capacity creditCost');
    if (!sub) return res.status(404).json({ error: 'Suscripción no encontrada' });
    res.json(sub);
  } catch (error) {
    handleError(res, error, 'Error al actualizar suscripción');
  }
});

router.post('/:id/renew', requireAdmin, validateMongoId, validateRenew, async (req, res) => {
  if (!handleValidation(req, res)) return;
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const sub = await Subscription.findById(req.params.id).session(session);
      if (!sub) throw Object.assign(new Error('Suscripción no encontrada'), { statusCode: 404 });

      const planId = req.body.plan || sub.plan;
      const plan = await Plan.findById(planId).session(session);
      if (!plan) throw Object.assign(new Error('Plan no existe'), { statusCode: 400 });
      if (!plan.active) throw Object.assign(new Error('Plan inactivo'), { statusCode: 400 });

      const reseller = await Reseller.findById(sub.soldBy).session(session);
      if (!reseller) throw Object.assign(new Error('Reseller no existe'), { statusCode: 400 });
      if (!reseller.isOwner && reseller.credits < plan.creditCost) {
        throw Object.assign(new Error(`Saldo insuficiente. Necesita ${plan.creditCost} créditos, tiene ${reseller.credits}`), { statusCode: 402 });
      }

      const now = new Date();
      const base = sub.endDate > now ? sub.endDate : now;
      sub.endDate = addDays(base, plan.durationDays);
      sub.plan = plan._id;
      sub.planSnapshot = buildPlanSnapshot(plan);
      sub.status = 'active';
      if (req.body.salePrice !== undefined) sub.salePrice = req.body.salePrice;
      await sub.save({ session });

      if (!reseller.isOwner && plan.creditCost > 0) {
        reseller.credits -= plan.creditCost;
        await reseller.save({ session });
        await CreditTransaction.create([{
          reseller: reseller._id,
          type: 'consume',
          amount: -plan.creditCost,
          balanceAfter: reseller.credits,
          relatedSubscription: sub._id,
          note: `Renovación ${plan.serviceType} - ${plan.name}`,
          performedBy: req.user._id
        }], { session });
      }

      result = await Subscription.findById(sub._id)
        .populate('endCustomer', 'firstName lastName email phone')
        .populate('soldBy', 'firstName lastName businessName isOwner credits')
        .populate('plan', 'name serviceType durationDays capacity creditCost')
        .session(session);
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Error al renovar suscripción');
  } finally {
    session.endSession();
  }
});

router.post('/:id/cancel', requireAdmin, validateMongoId, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const sub = await Subscription.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { new: true }
    )
      .populate('endCustomer', 'firstName lastName email phone')
      .populate('soldBy', 'firstName lastName businessName isOwner')
      .populate('plan', 'name serviceType durationDays capacity creditCost');
    if (!sub) return res.status(404).json({ error: 'Suscripción no encontrada' });
    res.json(sub);
  } catch (error) {
    handleError(res, error, 'Error al cancelar suscripción');
  }
});

router.delete('/:id', requireAdmin, validateMongoId, async (req, res) => {
  if (!handleValidation(req, res)) return;
  try {
    const sub = await Subscription.findByIdAndDelete(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Suscripción no encontrada' });
    res.json({ message: 'Suscripción eliminada correctamente' });
  } catch (error) {
    handleError(res, error, 'Error al eliminar suscripción');
  }
});

export default router;
