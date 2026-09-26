import { Router, Response } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { getUserWishlist, setUserWishlist } from '../store';

const router = Router();

// Protect all wishlist endpoints: strictly isolated to the authenticated user ID
router.use(authenticateUser);

/**
 * GET /api/wishlist
 * Requirement 17: Fetch the authenticated user's isolated wishlist
 */
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const bookIds = await getUserWishlist(userId);
    res.status(200).json({
      success: true,
      data: bookIds,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve user wishlist',
    });
  }
});

/**
 * POST /api/wishlist/toggle
 * Toggle book presence in the authenticated user's isolated wishlist
 */
router.post('/toggle', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { bookId } = req.body;

    if (!bookId) {
      res.status(400).json({
        success: false,
        message: 'Book ID is required',
      });
      return;
    }

    const currentList = await getUserWishlist(userId);
    let updatedList: string[];
    let action: 'added' | 'removed';

    if (currentList.includes(bookId)) {
      updatedList = currentList.filter(id => id !== bookId);
      action = 'removed';
    } else {
      updatedList = [...currentList, bookId];
      action = 'added';
    }

    await setUserWishlist(userId, updatedList);

    res.status(200).json({
      success: true,
      action,
      data: updatedList,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update user wishlist',
    });
  }
});

/**
 * PUT /api/wishlist
 * Sync full list of book IDs for authenticated user
 */
router.put('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { bookIds } = req.body;

    if (!Array.isArray(bookIds)) {
      res.status(400).json({
        success: false,
        message: 'bookIds must be an array',
      });
      return;
    }

    const saved = await setUserWishlist(userId, bookIds);
    res.status(200).json({
      success: true,
      data: saved,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync user wishlist',
    });
  }
});

export default router;
