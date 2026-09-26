import { Router, Request, Response } from 'express';
import { CATEGORIES_DATA } from '../../src/data/categoriesData';

const router = Router();

/**
 * GET /api/categories
 * Returns categories list
 */
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: CATEGORIES_DATA,
  });
});

export default router;
