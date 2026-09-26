import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { 
  getAllBooks, 
  getBookById, 
  incrementBookDownloads, 
  incrementBookViews,
  getReadingProgress,
  saveReadingProgress,
  getUserReadingProgressList,
  getBookmarks,
  addBookmark,
  removeBookmark,
  checkUserBookAccess,
  findUserById
} from '../store';
import { UPLOAD_ROOT } from '../storage';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const JWT_SECRET = process.env.AUTH_SECRET || 'bookstore-jwt-secure-secret-key-2026-prod';

/**
 * Optional user authenticator for reading/download endpoints:
 * Checks Authorization header or ?token= query parameter and attaches req.user if valid.
 */
async function authenticateOptional(req: AuthenticatedRequest, res: Response, next: () => void): Promise<void> {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: 'USER' | 'ADMIN' };
      const user = await findUserById(decoded.id);
      if (user && user.status !== 'DISABLED') {
        req.user = {
          id: user.id || user._id.toString(),
          _id: user._id ? user._id.toString() : user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        };
      }
    } catch {
      // invalid token ignored in optional mode
    }
  }
  next();
}

/**
 * Strict user authenticator for reading progress and bookmarks
 */
async function authenticateStrict(req: AuthenticatedRequest, res: Response, next: () => void): Promise<void> {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken;

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in to access bookmarks and reading progress.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: 'USER' | 'ADMIN' };
    const user = await findUserById(decoded.id);
    if (!user) {
      res.status(401).json({ success: false, message: 'User session no longer valid.' });
      return;
    }
    if (user.status === 'DISABLED') {
      res.status(403).json({ success: false, message: 'Account is disabled. Access denied.' });
      return;
    }

    req.user = {
      id: user.id || user._id.toString(),
      _id: user._id ? user._id.toString() : user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
  }
}

/**
 * Generates an academic study PDF copy on the fly for seeded textbooks
 */
function generateStudyCopyPdf(book: any): Buffer {
  const clean = (s: string) => (s || '').replace(/[\(\)\\\r\n]/g, ' ');
  const title = clean(book.title);
  const author = clean(book.author);
  const category = clean(book.category);
  const isbn = clean(book.isbn || '978-0-13-468599-1');
  const desc = clean(book.description?.slice(0, 220) || 'Academic study reference textbook');

  const textStream = [
    'BT',
    '/F1 18 Tf',
    '50 720 Td',
    `(${title}) Tj`,
    '/F1 12 Tf',
    '0 -30 Td',
    `(Author: ${author}) Tj`,
    '0 -20 Td',
    `(Category: ${category} | Pages: ${book.pages || 320} | Year: ${book.publicationYear || 2025}) Tj`,
    '0 -20 Td',
    `(ISBN: ${isbn} | Language: ${clean(book.language || 'English')}) Tj`,
    '0 -40 Td',
    '(Overview:) Tj',
    '0 -20 Td',
    `(${desc}) Tj`,
    '0 -40 Td',
    '(Digital College Library - Official Study Copy for Students) Tj',
    '0 -20 Td',
    '(Laboratory Exercises, Discussion Questions, and Chapter Problems included in full edition) Tj',
    'ET',
  ].join('\n');

  const streamLen = Buffer.byteLength(textStream, 'utf-8');

  const body = [
    '%PDF-1.4',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    'endobj',
    '3 0 obj',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    'endobj',
    '4 0 obj',
    `<< /Length ${streamLen} >>`,
    'stream',
    textStream,
    'endstream',
    'endobj',
    '5 0 obj',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    'endobj',
    'xref',
    '0 6',
    '0000000000 65535 f ',
    '0000000009 00000 n ',
    '0000000058 00000 n ',
    '0000000115 00000 n ',
    '0000000244 00000 n ',
    '0000000450 00000 n ',
    'trailer',
    '<< /Size 6 /Root 1 0 R >>',
    'startxref',
    '530',
    '%%EOF',
  ].join('\n');

  return Buffer.from(body, 'utf-8');
}

/**
 * GET /api/books
 * Returns list of public books dynamically from database / store
 * (Supports instant updates when admin creates or modifies books)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, category, type, language, sortBy } = req.query;
    let books = await getAllBooks({
      search: typeof search === 'string' ? search : undefined,
      category: typeof category === 'string' ? category : undefined,
      bookType: typeof type === 'string' && type !== 'ALL' ? type : undefined,
    });

    // Language filter
    if (typeof language === 'string' && language !== 'ALL') {
      books = books.filter(b => b.language?.toLowerCase() === language.toLowerCase());
    }

    // Sorting
    const sort = typeof sortBy === 'string' ? sortBy : 'latest';
    switch (sort) {
      case 'latest':
        books.sort((a, b) => new Date(b.dateAdded || b.createdAt).getTime() - new Date(a.dateAdded || a.createdAt).getTime());
        break;
      case 'popular':
        books.sort((a, b) => ((b.views || 0) + (b.downloads || 0)) - ((a.views || 0) + (a.downloads || 0)));
        break;
      case 'rating':
        books.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'price-asc':
        books.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-desc':
        books.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'title-az':
        books.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
    }

    // Safety: Do not expose raw internal premium file paths publicly (Requirement 20)
    const sanitized = books.map(b => {
      const isFree = b.bookType === 'FREE' || b.type === 'FREE';
      return {
        ...b,
        fileUrl: isFree ? b.fileUrl : undefined,
      };
    });

    res.status(200).json({
      success: true,
      data: sanitized,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch books',
    });
  }
});

/**
 * GET /api/books/:id
 * Returns single book
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const book = await getBookById(req.params.id);
    if (!book) {
      res.status(404).json({
        success: false,
        message: 'Book not found',
      });
      return;
    }

    const isFree = book.bookType === 'FREE' || book.type === 'FREE';

    res.status(200).json({
      success: true,
      data: {
        ...book,
        fileUrl: isFree ? book.fileUrl : undefined,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load book',
    });
  }
});

/**
 * POST /api/books/:id/view
 * Increments view counter when a user opens book details or reads
 */
router.post('/:id/view', async (req: Request, res: Response): Promise<void> => {
  try {
    const book = await getBookById(req.params.id);
    if (!book) {
      res.status(404).json({ success: false, message: 'Book not found' });
      return;
    }
    const updatedViews = await incrementBookViews(book.id);
    res.status(200).json({ success: true, views: updatedViews });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/books/:id/download
 * Requirements 12, 13, 14, 15:
 * Secure download handler:
 * - Free books with downloadAllowed=true: allowed for everyone, increments download counter
 * - Premium books: protected on server, requires auth/admin token
 */
router.get('/:id/download', async (req: Request, res: Response): Promise<void> => {
  try {
    const book = await getBookById(req.params.id);
    if (!book) {
      res.status(404).json({ success: false, message: 'Book not found' });
      return;
    }

    const isPremium = book.bookType === 'PREMIUM' || book.type === 'PREMIUM';

    // Requirement 13 & 14 & Phase 5 Section 8:
    // Prevent direct unauthorized download of premium book files:
    // Check authenticated user and verify purchase/admin permission
    if (isPremium) {
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string | undefined;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken;

      if (!token) {
        res.status(403).json({
          success: false,
          message: 'Direct download of premium book files is restricted to authorized purchasers. Please purchase to gain access.',
        });
        return;
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const hasAccess = await checkUserBookAccess(decoded.id, book.id, decoded.role);
        if (!hasAccess) {
          res.status(403).json({
            success: false,
            message: 'This premium edition requires purchase verification before file download.',
          });
          return;
        }
      } catch {
        res.status(403).json({
          success: false,
          message: 'Invalid or expired authorization token for premium book download.',
        });
        return;
      }
    }

    // Check if downloads are allowed by publisher/author
    if (book.downloadAllowed === false) {
      res.status(403).json({
        success: false,
        message: 'Downloads are disabled for this publication by author/publisher.',
      });
      return;
    }

    // Increment downloads count in MongoDB & cache
    await incrementBookDownloads(book.id);

    // If a physical file was uploaded and exists in uploads/books
    if (book.fileUrl && book.fileUrl.startsWith('/uploads/')) {
      const relPath = book.fileUrl.replace(/^\/uploads\//, '');
      const absPath = path.join(UPLOAD_ROOT, relPath);
      if (fs.existsSync(absPath)) {
        const ext = path.extname(absPath);
        const safeTitle = (book.title || 'book').replace(/[^a-zA-Z0-9-_]/g, '_');
        res.download(absPath, `${safeTitle}${ext}`);
        return;
      }
    }

    // Otherwise, generate a clean academic study PDF copy
    const pdfBuffer = generateStudyCopyPdf(book);
    const safeTitle = (book.title || 'study_copy').replace(/[^a-zA-Z0-9-_]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.status(200).send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to download book file.',
    });
  }
});

/**
 * ==================================================
 * PHASE 5: SECURE FILE STREAM & READER METADATA APIS
 * ==================================================
 */

/**
 * GET /api/books/:id/access
 * Requirement 3 & 7:
 * Lightweight endpoint checking if authenticated user has access to a book
 */
router.get('/:id/access', authenticateOptional, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const book = await getBookById(req.params.id);
    if (!book) {
      res.status(404).json({ success: false, message: 'Book not found' });
      return;
    }

    const isFree = book.bookType === 'FREE' || book.type === 'FREE';
    if (isFree) {
      res.status(200).json({
        success: true,
        hasAccess: true,
        isFree: true,
        price: 0,
      });
      return;
    }

    if (!req.user) {
      res.status(200).json({
        success: true,
        hasAccess: false,
        isFree: false,
        price: book.price,
        message: 'Authentication and purchase required.',
      });
      return;
    }

    const hasAccess = await checkUserBookAccess(req.user.id, book.id, req.user.role);
    res.status(200).json({
      success: true,
      hasAccess,
      isFree: false,
      price: book.price,
      message: hasAccess ? 'Book unlocked' : 'Purchase required to unlock book',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/books/:id/read
 * Checks access and returns book reader metadata
 */
router.get('/:id/read', authenticateOptional, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const book = await getBookById(req.params.id);
    if (!book) {
      res.status(404).json({ success: false, message: 'Book not found' });
      return;
    }

    const isFree = book.bookType === 'FREE' || book.type === 'FREE';
    let hasAccess = isFree;

    if (!isFree) {
      if (!req.user) {
        res.status(403).json({
          success: false,
          hasAccess: false,
          message: 'Sign in and purchase is required to read this premium edition.',
          price: book.price,
        });
        return;
      }
      hasAccess = await checkUserBookAccess(req.user.id, book.id, req.user.role);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          hasAccess: false,
          message: `This premium book requires purchase (₹${book.price}).`,
          price: book.price,
        });
        return;
      }
    }

    // Increment views
    await incrementBookViews(book.id);

    // Retrieve user reading progress if user authenticated
    let progress = null;
    let bookmarks: any[] = [];
    if (req.user) {
      progress = await getReadingProgress(req.user.id, book.id);
      bookmarks = await getBookmarks(req.user.id, book.id);
    }

    res.status(200).json({
      success: true,
      hasAccess: true,
      data: {
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          category: book.category,
          bookType: book.bookType || book.type,
          price: book.price,
          coverUrl: book.coverUrl || book.cover,
          fileType: book.fileType || 'PDF',
          pages: book.pages || 350,
          downloadAllowed: book.downloadAllowed !== false,
          hasUploadedFile: Boolean(book.fileUrl && book.fileUrl.startsWith('/uploads/')),
          fileEndpoint: `/api/books/${book.id}/file`,
        },
        progress,
        bookmarks,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to initialize reader' });
  }
});

/**
 * GET /api/books/:id/file
 * Phase 5 Section 8: SECURE FILE ACCESS
 * Streams the real book file (PDF or EPUB).
 * Strictly authenticates user and validates purchase for PREMIUM books.
 * Never allows unauthorized users to access raw binary files.
 */
router.get('/:id/file', authenticateOptional, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const book = await getBookById(req.params.id);
    if (!book) {
      res.status(404).json({ success: false, message: 'Book not found' });
      return;
    }

    const isFree = book.bookType === 'FREE' || book.type === 'FREE';

    if (!isFree) {
      if (!req.user) {
        res.status(403).json({
          success: false,
          message: 'Access forbidden: Sign in required to access premium e-book file.',
        });
        return;
      }

      const hasAccess = await checkUserBookAccess(req.user.id, book.id, req.user.role);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: 'Access forbidden: Premium e-book has not been purchased.',
        });
        return;
      }
    }

    // Serve uploaded physical file if present
    if (book.fileUrl && book.fileUrl.startsWith('/uploads/')) {
      const relPath = book.fileUrl.replace(/^\/uploads\//, '');
      const absPath = path.join(UPLOAD_ROOT, relPath);

      if (fs.existsSync(absPath)) {
        const ext = path.extname(absPath).toLowerCase();
        const contentType = ext === '.epub' ? 'application/epub+zip' : 'application/pdf';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(absPath)}"`);
        const readStream = fs.createReadStream(absPath);
        readStream.pipe(res);
        return;
      }
    }

    // Otherwise, generate the academic PDF study copy
    const pdfBuffer = generateStudyCopyPdf(book);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="academic_study_edition.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.status(200).send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to serve book file' });
  }
});

/**
 * ==================================================
 * READING PROGRESS ENDPOINTS
 * ==================================================
 */

/**
 * GET /api/books/continue-reading
 * Returns list of in-progress books for the authenticated user
 */
router.get('/user/continue-reading', authenticateStrict, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const list = await getUserReadingProgressList(req.user!.id);
    const enriched = await Promise.all(
      list.map(async p => {
        const book = await getBookById(p.bookId);
        return {
          ...p,
          book: book
            ? {
                id: book.id,
                title: book.title,
                author: book.author,
                category: book.category,
                coverUrl: book.coverUrl || book.cover,
                bookType: book.bookType || book.type,
                pages: book.pages,
              }
            : null,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: enriched.filter(item => item.book !== null),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to get continue reading' });
  }
});

/**
 * GET /api/books/:id/progress
 */
router.get('/:id/progress', authenticateStrict, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const progress = await getReadingProgress(req.user!.id, req.params.id);
    res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to get reading progress' });
  }
});

/**
 * PUT /api/books/:id/progress
 * Body: { currentPage: number, totalPages: number }
 */
router.put('/:id/progress', authenticateStrict, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { currentPage, totalPages } = req.body;
    if (!currentPage || !totalPages) {
      res.status(400).json({ success: false, message: 'currentPage and totalPages are required' });
      return;
    }

    const saved = await saveReadingProgress(
      req.user!.id,
      req.params.id,
      Number(currentPage),
      Number(totalPages)
    );

    res.status(200).json({
      success: true,
      data: saved,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to save reading progress' });
  }
});

/**
 * ==================================================
 * BOOKMARK ENDPOINTS
 * ==================================================
 */

/**
 * GET /api/books/:id/bookmarks
 */
router.get('/:id/bookmarks', authenticateStrict, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const bookmarks = await getBookmarks(req.user!.id, req.params.id);
    res.status(200).json({
      success: true,
      data: bookmarks,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to get bookmarks' });
  }
});

/**
 * POST /api/books/:id/bookmarks
 * Body: { page: number, note?: string }
 */
router.post('/:id/bookmarks', authenticateStrict, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page, note } = req.body;
    if (!page) {
      res.status(400).json({ success: false, message: 'Page number is required' });
      return;
    }

    const bookmark = await addBookmark(req.user!.id, req.params.id, Number(page), note);
    res.status(201).json({
      success: true,
      message: `Page ${page} bookmarked successfully`,
      data: bookmark,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to add bookmark' });
  }
});

/**
 * DELETE /api/books/:id/bookmarks/:page
 */
router.delete('/:id/bookmarks/:page', authenticateStrict, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = Number(req.params.page);
    await removeBookmark(req.user!.id, req.params.id, page);
    res.status(200).json({
      success: true,
      message: `Bookmark for page ${page} removed`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to remove bookmark' });
  }
});

/**
 * POST /api/books/:id/purchase-simulated
 * Prepares Phase 6 purchase connect architecture
 */
router.post('/:id/purchase-simulated', authenticateStrict, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const book = await getBookById(req.params.id);
    if (!book) {
      res.status(404).json({ success: false, message: 'Book not found' });
      return;
    }

    const { recordPurchase } = await import('../store');
    const rec = await recordPurchase(req.user!.id, book.id, book.price, req.body.paymentMethod || 'UPI');
    res.status(200).json({
      success: true,
      message: `Access granted for ${book.title}`,
      data: rec,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
