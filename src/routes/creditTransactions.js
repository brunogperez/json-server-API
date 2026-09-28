import express from 'express';
import CreditTransaction from '../models/CreditTransaction.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { handleError } from '../middleware/helpers.js';

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const { reseller, type, limit = 100 } = req.query;
    const query = {};
    if (reseller) query.reseller = reseller;
    if (type) query.type = type;

    const txs = await CreditTransaction.find(query)
      .populate('reseller', 'firstName lastName businessName')
      .populate('relatedSubscription', 'planSnapshot status')
      .populate('performedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(txs);
  } catch (error) {
    handleError(res, error, 'Error al listar transacciones');
  }
});

export default router;
