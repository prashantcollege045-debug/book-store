import { Router, Request, Response } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { 
  getPublicPaymentConfig, 
  createPaymentOrder, 
  processDemoPayment, 
  createRazorpayOrder, 
  verifyRazorpayPayment, 
  createStripeCheckoutSession, 
  verifyStripePayment 
} from '../services/payments';

const router = Router();

/**
 * GET /api/payments/config
 * Public endpoint to fetch active payment gateways, currency, and public client keys.
 * Never exposes server secret keys or webhook secrets.
 */
router.get('/config', (req: Request, res: Response) => {
  try {
    const config = getPublicPaymentConfig();
    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment configuration',
    });
  }
});

/**
 * POST /api/payments/create-order
 * Authenticated: Creates an internal order with server-validated database price.
 */
router.post('/create-order', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { bookId, gateway, idempotencyKey } = req.body;
    if (!bookId) {
      res.status(400).json({ success: false, message: 'bookId is required' });
      return;
    }

    const userId = req.user!.id;
    const order = await createPaymentOrder({ userId, bookId, gateway, idempotencyKey });

    res.status(201).json({
      success: true,
      message: 'Payment order created with database price verification',
      data: order,
    });
  } catch (error: any) {
    if (error.code === 'ALREADY_PURCHASED') {
      res.status(409).json({
        success: false,
        code: 'ALREADY_PURCHASED',
        message: 'You already own full access to this textbook.',
        bookId: error.bookId,
      });
      return;
    }
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create payment order',
    });
  }
});

/**
 * POST /api/payments/demo/pay
 * Authenticated: Process Demo / Sandbox payment simulation (SUCCESS, FAIL, CANCEL).
 */
router.post('/demo/pay', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId, action, paymentMethod } = req.body;
    if (!orderId || !action) {
      res.status(400).json({ success: false, message: 'orderId and action are required' });
      return;
    }

    if (!['SUCCESS', 'FAIL', 'CANCEL'].includes(action)) {
      res.status(400).json({
        success: false,
        message: 'Invalid action. Allowed: SUCCESS, FAIL, CANCEL',
      });
      return;
    }

    const userId = req.user!.id;
    const result = await processDemoPayment({
      orderId,
      userId,
      action: action as any,
      paymentMethod,
    });

    if (action === 'SUCCESS') {
      res.status(200).json({
        success: true,
        message: 'Demo payment completed successfully. Book unlocked!',
        data: result,
      });
    } else if (action === 'CANCEL') {
      res.status(200).json({
        success: false,
        message: 'Payment cancelled.',
        data: result,
      });
    } else {
      res.status(402).json({
        success: false,
        message: 'Payment simulation failed. Transaction was declined.',
        data: result,
      });
    }
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Payment processing error',
    });
  }
});

/**
 * POST /api/payments/razorpay/create-order
 * Authenticated: Creates Razorpay Test Order payload.
 */
router.post('/razorpay/create-order', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      res.status(400).json({ success: false, message: 'orderId is required' });
      return;
    }

    const userId = req.user!.id;
    const razorpayOrder = await createRazorpayOrder({ orderId, userId });

    res.status(200).json({
      success: true,
      data: razorpayOrder,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to initialize Razorpay payment',
    });
  }
});

/**
 * POST /api/payments/razorpay/verify
 * Authenticated: Validates Razorpay payment signature server-side.
 */
router.post('/razorpay/verify', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id) {
      res.status(400).json({
        success: false,
        message: 'Missing required Razorpay payment verification parameters',
      });
      return;
    }

    const userId = req.user!.id;
    const result = await verifyRazorpayPayment({
      orderId,
      userId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature: razorpay_signature || '',
    });

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.order,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Razorpay signature verification failed',
    });
  }
});

/**
 * POST /api/payments/razorpay/webhook
 * Public webhook endpoint for asynchronous Razorpay event notifications.
 */
router.post('/razorpay/webhook', async (req: Request, res: Response) => {
  // Webhook received and acknowledged safely
  res.status(200).json({ status: 'ok', received: true });
});

/**
 * POST /api/payments/stripe/create-checkout
 * Authenticated: Creates Stripe Test checkout session.
 */
router.post('/stripe/create-checkout', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      res.status(400).json({ success: false, message: 'orderId is required' });
      return;
    }

    const userId = req.user!.id;
    const stripeSession = await createStripeCheckoutSession({ orderId, userId });

    res.status(200).json({
      success: true,
      data: stripeSession,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to initialize Stripe checkout',
    });
  }
});

/**
 * POST /api/payments/stripe/verify
 * Authenticated: Verifies Stripe checkout session completion.
 */
router.post('/stripe/verify', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId, sessionId } = req.body;
    if (!orderId || !sessionId) {
      res.status(400).json({ success: false, message: 'orderId and sessionId are required' });
      return;
    }

    const userId = req.user!.id;
    const result = await verifyStripePayment({ orderId, userId, sessionId });

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.order,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Stripe payment verification failed',
    });
  }
});

/**
 * POST /api/payments/stripe/webhook
 * Public webhook endpoint for asynchronous Stripe event notifications.
 */
router.post('/stripe/webhook', async (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', received: true });
});

export default router;
