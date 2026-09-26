import { Router, Response } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { 
  createOrder, 
  processOrderPayment, 
  getUserOrders, 
  getOrderById, 
  checkUserBookAccess,
  getBookById
} from '../store';

const router = Router();

// Protect all /api/orders routes with server-side authentication
router.use(authenticateUser);

/**
 * POST /api/orders
 * Requirement 3 & 14:
 * Create an order for a premium book.
 * Strictly derives userId from authenticated server token.
 * Retrieves actual book price from MongoDB/store.
 * Prevents duplicate purchases if user already owns it.
 */
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { bookId } = req.body;
    if (!bookId) {
      res.status(400).json({ success: false, message: 'bookId is required to create an order' });
      return;
    }

    const userId = req.user!.id;
    const order = await createOrder({ userId, bookId });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  } catch (error: any) {
    if (error.code === 'ALREADY_PURCHASED') {
      res.status(409).json({
        success: false,
        code: 'ALREADY_PURCHASED',
        message: 'You have already purchased this book and have full access.',
        bookId: error.bookId,
      });
      return;
    }
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create order',
    });
  }
});

/**
 * POST /api/orders/:orderId/pay
 * Requirements 4, 5, 6:
 * Test / Sandbox payment processing endpoint.
 * body: { action: 'SUCCESS' | 'FAIL', paymentMethod?: string }
 */
router.post('/:orderId/pay', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { action, paymentMethod } = req.body;

    if (!action || (action !== 'SUCCESS' && action !== 'FAIL')) {
      res.status(400).json({
        success: false,
        message: 'Invalid payment action. Allowed values: SUCCESS or FAIL.',
      });
      return;
    }

    const userId = req.user!.id;
    const result = await processOrderPayment(orderId, userId, action, paymentMethod || 'Demo UPI');

    if (action === 'SUCCESS') {
      res.status(200).json({
        success: true,
        message: 'Payment verified and book access granted successfully!',
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
      message: error.message || 'Failed to process payment',
    });
  }
});

/**
 * GET /api/orders
 * Requirement 9:
 * User's purchase history. Users can ONLY see their own orders.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const orders = await getUserOrders(userId);

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch purchase history',
    });
  }
});

/**
 * GET /api/orders/:orderId
 * Fetch single order with ownership check
 */
router.get('/:orderId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';

    const order = await getOrderById(orderId, userId, isAdmin);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    res.status(403).json({
      success: false,
      message: error.message || 'Access denied for this order',
    });
  }
});

export default router;
