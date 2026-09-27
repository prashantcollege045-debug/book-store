import { Router, Request, Response } from 'express';
import { getAllCategoriesWithCounts } from '../store';

const router = Router();

/**
 * GET /api/categories
 * Returns dynamically computed categories list with live book counts
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const categories = await getAllCategoriesWithCounts();
    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch categories',
    });
  }
});

export default router;
