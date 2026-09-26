import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload root and subdirectories exist
export const UPLOAD_ROOT = path.resolve(__dirname, '../uploads');
export const COVERS_DIR = path.join(UPLOAD_ROOT, 'covers');
export const BOOKS_DIR = path.join(UPLOAD_ROOT, 'books');

if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });
if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR, { recursive: true });

// Multer storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'cover') {
      cb(null, COVERS_DIR);
    } else if (file.fieldname === 'bookFile') {
      cb(null, BOOKS_DIR);
    } else {
      cb(null, UPLOAD_ROOT);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 30);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${sanitizedBase}-${uniqueSuffix}${ext}`);
  },
});

// File validation filter (Requirement 3 & 4)
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === 'cover') {
    const allowedCoverExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const allowedCoverMimes = ['image/jpeg', 'image/png', 'image/webp'];

    if (allowedCoverExts.includes(ext) && allowedCoverMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid cover image format. Supported formats: JPG, JPEG, PNG, WEBP.'));
    }
  } else if (file.fieldname === 'bookFile') {
    const allowedBookExts = ['.pdf', '.epub'];
    const allowedBookMimes = [
      'application/pdf',
      'application/epub+zip',
      'application/octet-stream', // Some browsers send epub as octet-stream
    ];

    if (allowedBookExts.includes(ext) || allowedBookMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid book file format. Supported formats: PDF, EPUB.'));
    }
  } else {
    cb(null, true);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max file size
  },
});

/**
 * Safely delete an uploaded file from disk (Requirement 9)
 */
export function removeFileIfPresent(fileUrlOrPath?: string): void {
  if (!fileUrlOrPath) return;

  try {
    // If it's a URL path like /uploads/books/xyz.pdf, convert to disk path
    let diskPath = fileUrlOrPath;
    if (fileUrlOrPath.startsWith('/uploads/')) {
      diskPath = path.join(UPLOAD_ROOT, fileUrlOrPath.replace('/uploads/', ''));
    }

    if (fs.existsSync(diskPath) && fs.lstatSync(diskPath).isFile()) {
      fs.unlinkSync(diskPath);
      console.log(`[Storage] Deleted file: ${diskPath}`);
    }
  } catch (err: any) {
    console.warn(`[Storage Warning] Could not remove file ${fileUrlOrPath}:`, err.message);
  }
}
