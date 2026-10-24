import { Router } from 'express';
import billingController from '../modules/billing/billing.controller.js';

const router = Router();

// Public webhook, mounted before the global API rate limiter in app.ts.
router.post('/payos', billingController.handlePayosWebhook);

export default router;
