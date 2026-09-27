import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDB } from './server/db';
import { seedInitialData } from './server/store';
import authRouter from './server/routes/auth';
import adminRouter from './server/routes/admin';
import wishlistRouter from './server/routes/wishlist';
import booksRouter from './server/routes/books';
import categoriesRouter from './server/routes/categories';
import ordersRouter from './server/routes/orders';
import paymentsRouter from './server/routes/payments';
import aiRouter from './server/routes/ai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Core Express Middlewares
  app.use(cors());
  app.use(express.json());

  // Connect to Database & Seed Admin
  await connectDB();
  await seedInitialData();

  // API Route Registrations
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/wishlist', wishlistRouter);
  app.use('/api/books', booksRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/ai', aiRouter);

  // Health and System Info Endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'OK',
      service: 'BookStore Management System API',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Global Error Handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      message: `API endpoint ${req.method} ${req.originalUrl} not found`,
    });
  });

  // Phase 5 Section 8: SECURE FILE ACCESS
  // Cover images are publicly accessible for display
  const coversPath = path.resolve(__dirname, 'uploads/covers');
  app.use('/uploads/covers', express.static(coversPath));

  // Protect /uploads/books from raw direct unauthorized access:
  // Book files MUST be accessed via authenticated endpoint /api/books/:id/file or /download
  app.use('/uploads/books', (req, res) => {
    res.status(403).json({
      success: false,
      message: 'Direct file access forbidden. Please access files via /api/books/:id/file with valid authentication.',
    });
  });

  // Frontend Integration: Vite Middleware (Dev) or Static Assets (Prod)
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BookStore Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Fatal Server Startup Error]:', err);
  process.exit(1);
});
