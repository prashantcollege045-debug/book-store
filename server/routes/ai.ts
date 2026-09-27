import { Router, Request, Response } from 'express';
import {
  getBookRecommendations,
  smartSearchBooks,
  chatAboutBook,
  generateBookSummary,
  askReaderAssistant,
  getAISettings,
  getAIAnalytics,
  setAIEnabled,
  checkRateLimit,
} from '../services/ai';
import { authenticateUser, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { getUserReadingProgressList, getUserWishlist, getUserOrders } from '../store';

const aiRouter = Router();

// Rate limiting middleware helper
function applyAIRateLimit(req: Request, res: Response, next: () => void) {
  const identifier = (req as AuthenticatedRequest).user?.id || req.ip || 'anonymous-user';
  const { allowed, remaining, retryAfterSec } = checkRateLimit(identifier);

  res.setHeader('X-RateLimit-Remaining', remaining.toString());

  if (!allowed) {
    res.status(429).json({
      success: false,
      message: `Rate limit exceeded for AI queries. Please wait ${retryAfterSec} seconds before sending another AI request.`,
      retryAfter: retryAfterSec,
    });
    return;
  }
  next();
}

/**
 * GET /api/ai/status
 * Public endpoint to check AI capability availability
 */
aiRouter.get('/status', (req: Request, res: Response) => {
  const settings = getAISettings();
  res.json({
    success: true,
    ai: settings,
  });
});

/**
 * POST /api/ai/recommendations
 * Generates AI-ranked book recommendations from catalog
 */
aiRouter.post('/recommendations', applyAIRateLimit, async (req: Request, res: Response) => {
  try {
    const {
      currentBookId,
      readBookIds,
      wishlistBookIds,
      purchasedBookIds,
      preferredCategories,
      preferredLanguages,
      limit,
    } = req.body || {};

    const result = await getBookRecommendations({
      currentBookId,
      readBookIds,
      wishlistBookIds,
      purchasedBookIds,
      preferredCategories,
      preferredLanguages,
      limit: limit ? parseInt(limit, 10) : 6,
    });

    res.json({
      success: true,
      data: result.recommendations,
      aiPowered: result.aiPowered,
    });
  } catch (error: any) {
    console.error('[AI Recommendations Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate recommendations. Please try again.',
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/search
 * Natural language smart search across the book store catalog
 */
aiRouter.post('/search', applyAIRateLimit, async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (typeof query !== 'string') {
      res.status(400).json({
        success: false,
        message: 'A valid search query string is required.',
      });
      return;
    }

    const result = await smartSearchBooks(query);

    res.json({
      success: true,
      data: {
        books: result.books,
        intent: result.interpretedIntent,
        message: result.message,
      },
      aiPowered: result.aiPowered,
    });
  } catch (error: any) {
    console.error('[AI Smart Search Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete smart search.',
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/book-assistant
 * Multi-turn book-grounded Q&A assistant for Book Details
 */
aiRouter.post('/book-assistant', applyAIRateLimit, async (req: Request, res: Response) => {
  try {
    const { bookId, message, conversationHistory } = req.body;

    if (!bookId || !message) {
      res.status(400).json({
        success: false,
        message: 'bookId and message are required fields.',
      });
      return;
    }

    const result = await chatAboutBook(
      String(bookId),
      String(message),
      Array.isArray(conversationHistory) ? conversationHistory : []
    );

    res.json({
      success: true,
      data: result,
      aiPowered: result.aiPowered,
    });
  } catch (error: any) {
    console.error('[AI Book Assistant Error]:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'AI Book Assistant is currently unavailable.',
    });
  }
});

/**
 * POST /api/ai/summary
 * Generate educational summary and key takeaways for a book
 */
aiRouter.post('/summary', applyAIRateLimit, async (req: Request, res: Response) => {
  try {
    const { bookId } = req.body;

    if (!bookId) {
      res.status(400).json({
        success: false,
        message: 'bookId is required to generate a summary.',
      });
      return;
    }

    const result = await generateBookSummary(String(bookId));

    res.json({
      success: true,
      data: result,
      aiPowered: result.aiPowered,
    });
  } catch (error: any) {
    console.error('[AI Summary Error]:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate book summary.',
    });
  }
});

/**
 * POST /api/ai/reader-assistant
 * Contextual reading tutor for explaining, summarizing, or answering questions on book snippets
 */
aiRouter.post('/reader-assistant', applyAIRateLimit, async (req: Request, res: Response) => {
  try {
    const { bookId, chapterTitle, snippet, action, userQuestion } = req.body;

    if (!bookId || !snippet) {
      res.status(400).json({
        success: false,
        message: 'bookId and snippet are required for reader assistant.',
      });
      return;
    }

    const validAction = ['explain', 'summarize', 'simplify', 'ask'].includes(action)
      ? action
      : 'explain';

    const result = await askReaderAssistant({
      bookId: String(bookId),
      chapterTitle: chapterTitle ? String(chapterTitle) : undefined,
      snippet: String(snippet),
      action: validAction,
      userQuestion: userQuestion ? String(userQuestion) : undefined,
    });

    res.json({
      success: true,
      data: result,
      aiPowered: result.aiPowered,
    });
  } catch (error: any) {
    console.error('[AI Reader Assistant Error]:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Reader Assistant is currently unavailable.',
    });
  }
});

/**
 * GET /api/ai/admin/analytics
 * Administrator view of AI system status and usage statistics
 */
aiRouter.get('/admin/analytics', authenticateUser, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const analytics = getAIAnalytics();
  res.json({
    success: true,
    data: analytics,
  });
});

/**
 * POST /api/ai/admin/toggle
 * Administrator control to enable or disable AI features globally
 */
aiRouter.post('/admin/toggle', authenticateUser, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    res.status(400).json({
      success: false,
      message: 'The "enabled" boolean property is required.',
    });
    return;
  }

  const newState = setAIEnabled(enabled);
  res.json({
    success: true,
    message: `AI capabilities have been ${newState ? 'enabled' : 'disabled'} globally.`,
    ai: getAISettings(),
  });
});

export default aiRouter;
