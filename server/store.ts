import bcrypt from 'bcryptjs';
import { UserModel, IUser } from './models/User';
import { BookModel, IBook } from './models/Book';
import { CategoryModel } from './models/Category';
import { WishlistModel } from './models/Wishlist';
import { ReadingProgressModel } from './models/ReadingProgress';
import { BookmarkModel } from './models/Bookmark';
import { PurchaseModel } from './models/Purchase';
import { OrderModel, PaymentStatus } from './models/Order';
import { getDBStatus } from './db';
import { removeFileIfPresent } from './storage';
import { BOOKS_DATA } from '../src/data/booksData';
import { CATEGORIES_DATA } from '../src/data/categoriesData';

// Resilient In-Memory store for environments where MongoDB daemon is not locally running
interface MemoryUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

const memoryUsers: Map<string, MemoryUser> = new Map();
const memoryWishlists: Map<string, string[]> = new Map();
const memoryBooks: Map<string, any> = new Map();
const memoryCategories: Map<string, any> = new Map();
const memoryReadingProgress: Map<string, any> = new Map(); // key: `${userId}:${bookId}`
const memoryBookmarks: Map<string, any[]> = new Map(); // key: `${userId}:${bookId}`
const memoryPurchases: Map<string, any[]> = new Map(); // key: userId
const memoryOrders: Map<string, any> = new Map(); // key: orderId

/**
 * Initialize and seed initial administrator and default catalogs
 */
export async function seedInitialData() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@bookstore.edu').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSecurePassword2026!';
  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash(adminPassword, salt);

  const { isConnected } = getDBStatus();

  if (isConnected) {
    try {
      // 1. Check if admin exists in MongoDB
      const existingAdmin = await UserModel.findOne({ role: 'ADMIN' });
      if (!existingAdmin) {
        await UserModel.create({
          name: 'System Administrator',
          email: adminEmail,
          passwordHash: adminPasswordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
        });
        console.log(`[Seed] Initial administrator created in MongoDB: ${adminEmail}`);
      }

      // 2. Seed books if empty
      const bookCount = await BookModel.countDocuments();
      if (bookCount === 0) {
        for (const b of BOOKS_DATA) {
          await BookModel.create({
            title: b.title,
            author: b.author,
            description: b.description,
            category: b.category,
            language: b.language,
            coverUrl: b.cover,
            fileType: 'PDF',
            fileSize: '14.2 MB',
            pages: b.pages,
            publisher: b.publisher,
            publicationYear: b.publicationYear,
            isbn: b.isbn,
            tags: b.tags,
            bookType: b.type,
            price: b.type === 'FREE' ? 0 : b.price,
            downloadAllowed: true,
            views: b.views,
            downloads: b.downloads,
            rating: b.rating,
            featured: b.featured,
            status: 'ACTIVE',
          });
        }
        console.log(`[Seed] Seeded ${BOOKS_DATA.length} initial books into MongoDB.`);
      }

      // 3. Seed categories if empty
      const catCount = await CategoryModel.countDocuments();
      if (catCount === 0) {
        for (const c of CATEGORIES_DATA) {
          await CategoryModel.create({
            name: c.name,
            slug: c.slug,
            description: c.description,
            icon: c.icon,
          });
        }
        console.log(`[Seed] Seeded ${CATEGORIES_DATA.length} categories into MongoDB.`);
      }
    } catch (err: any) {
      console.warn('[Seed Warning] MongoDB seeding error, falling back to memory store:', err.message);
    }
  }

  // Always initialize memory store fallback
  if (!memoryUsers.has(adminEmail)) {
    memoryUsers.set(adminEmail, {
      id: 'admin-root-01',
      name: 'System Administrator',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Also seed a default verified test user
  const testUserEmail = 'student@college.edu';
  if (!memoryUsers.has(testUserEmail)) {
    const userPassHash = await bcrypt.hash('Student12345!', salt);
    memoryUsers.set(testUserEmail, {
      id: 'user-student-01',
      name: 'Aditya Verma (CS Student)',
      email: testUserEmail,
      passwordHash: userPassHash,
      role: 'USER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    memoryWishlists.set('user-student-01', ['book-1', 'book-4']);
  }

  // Seed memory books
  if (memoryBooks.size === 0) {
    for (const b of BOOKS_DATA) {
      memoryBooks.set(b.id, {
        ...b,
        _id: b.id,
        bookType: b.type,
        coverUrl: b.cover,
        fileType: 'PDF',
        fileSize: '14.2 MB',
        downloadAllowed: true,
        licenseType: 'Open Educational Resource / Creative Commons',
        sourceUrl: 'https://academic.cs.edu/textbooks',
        status: 'ACTIVE',
        createdAt: b.dateAdded || '2026-09-20',
      });
    }
  }

  // Seed memory categories
  if (memoryCategories.size === 0) {
    for (const c of CATEGORIES_DATA) {
      memoryCategories.set(c.slug, c);
    }
  }
}

/**
 * User Service Operations
 */
export async function findUserByEmail(email: string): Promise<any | null> {
  const normalized = email.toLowerCase().trim();
  const { isConnected } = getDBStatus();

  if (isConnected) {
    try {
      const user = await UserModel.findOne({ email: normalized }).select('+passwordHash');
      if (user) return user;
    } catch (e) {
      // fallback
    }
  }

  const memUser = memoryUsers.get(normalized);
  if (!memUser) return null;
  return {
    _id: memUser.id,
    id: memUser.id,
    name: memUser.name,
    email: memUser.email,
    passwordHash: memUser.passwordHash,
    role: memUser.role,
    status: memUser.status,
    createdAt: memUser.createdAt,
    updatedAt: memUser.updatedAt,
    comparePassword: async (candidate: string) => bcrypt.compare(candidate, memUser.passwordHash),
  };
}

export async function findUserById(id: string): Promise<any | null> {
  const { isConnected } = getDBStatus();

  if (isConnected) {
    try {
      const user = await UserModel.findById(id);
      if (user) return user;
    } catch (e) {
      // fallback
    }
  }

  for (const u of memoryUsers.values()) {
    if (u.id === id) {
      return {
        _id: u.id,
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    }
  }
  return null;
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
}): Promise<any> {
  const normalizedEmail = data.email.toLowerCase().trim();

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error('An account with this email address already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(data.password, salt);

  const { isConnected } = getDBStatus();

  if (isConnected) {
    try {
      const user = await UserModel.create({
        name: data.name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'USER',
        status: 'ACTIVE',
      });
      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      };
    } catch (e: any) {
      console.warn('[MongoDB Create User Error] falling back to memory store:', e.message);
    }
  }

  const id = 'user-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();
  const memUser: MemoryUser = {
    id,
    name: data.name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'USER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  memoryUsers.set(normalizedEmail, memUser);

  return {
    id: memUser.id,
    name: memUser.name,
    email: memUser.email,
    role: memUser.role,
    status: memUser.status,
    createdAt: memUser.createdAt,
  };
}

export async function getAllUsers(): Promise<any[]> {
  const { isConnected } = getDBStatus();

  if (isConnected) {
    try {
      const users = await UserModel.find().sort({ createdAt: -1 });
      if (users.length > 0) {
        return users.map(u => ({
          id: u._id.toString(),
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
        }));
      }
    } catch (e) {
      // fallback
    }
  }

  return Array.from(memoryUsers.values()).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
  }));
}

export async function updateUserStatus(userId: string, newStatus: 'ACTIVE' | 'DISABLED', currentAdminId: string): Promise<any> {
  if (userId === currentAdminId) {
    throw new Error('Administrators cannot disable their own account');
  }

  const { isConnected } = getDBStatus();

  if (isConnected) {
    try {
      const user = await UserModel.findById(userId);
      if (user) {
        if (user.role === 'ADMIN') {
          const adminCount = await UserModel.countDocuments({ role: 'ADMIN', status: 'ACTIVE' });
          if (adminCount <= 1 && newStatus === 'DISABLED') {
            throw new Error('Cannot disable the only active administrator');
          }
        }
        user.status = newStatus;
        await user.save();
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        };
      }
    } catch (e: any) {
      if (e.message.includes('administrator')) throw e;
    }
  }

  for (const u of memoryUsers.values()) {
    if (u.id === userId) {
      if (u.role === 'ADMIN' && newStatus === 'DISABLED') {
        throw new Error('Cannot disable the only active administrator');
      }
      u.status = newStatus;
      u.updatedAt = new Date().toISOString();
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
      };
    }
  }

  throw new Error('User not found');
}

/**
 * User-Isolated Wishlist Service (Requirement 17)
 */
export async function getUserWishlist(userId: string): Promise<string[]> {
  const { isConnected } = getDBStatus();

  if (isConnected) {
    try {
      const doc = await WishlistModel.findOne({ userId });
      if (doc) return doc.bookIds;
      return [];
    } catch (e) {
      // fallback
    }
  }

  return memoryWishlists.get(userId) || [];
}

export async function setUserWishlist(userId: string, bookIds: string[]): Promise<string[]> {
  const cleanBookIds = Array.from(new Set(bookIds.map(id => String(id).trim())));
  const { isConnected } = getDBStatus();

  if (isConnected) {
    try {
      let doc = await WishlistModel.findOne({ userId });
      if (!doc) {
        doc = await WishlistModel.create({ userId, bookIds: cleanBookIds });
      } else {
        doc.bookIds = cleanBookIds;
        await doc.save();
      }
      return doc.bookIds;
    } catch (e) {
      // fallback
    }
  }

  memoryWishlists.set(userId, cleanBookIds);
  return cleanBookIds;
}

/**
 * ==================================================
 * PHASE 4: COMPLETE ADMIN BOOK CRUD & CATALOG STORE
 * ==================================================
 */

export interface CreateBookInput {
  title: string;
  author: string;
  description: string;
  category: string;
  language?: string;
  coverUrl?: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: string;
  pages?: number;
  publisher?: string;
  publicationYear?: number;
  isbn?: string;
  tags?: string[];
  bookType: 'FREE' | 'PREMIUM';
  price: number;
  downloadAllowed?: boolean;
  licenseType?: string;
  sourceUrl?: string;
  featured?: boolean;
  status?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
}

export async function createBook(input: CreateBookInput): Promise<any> {
  // Validate Book Type and Price (Requirements 2, 7, 12, 13)
  const isFree = input.bookType === 'FREE';
  const cleanPrice = isFree ? 0 : Number(input.price);

  if (!isFree && (isNaN(cleanPrice) || cleanPrice <= 0)) {
    throw new Error('Premium books must have a valid price greater than ₹0');
  }

  const now = new Date().toISOString();
  const id = `book-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const newBookRecord = {
    id,
    title: input.title.trim(),
    author: input.author.trim(),
    description: input.description.trim(),
    category: input.category.trim(),
    language: input.language || 'English',
    coverUrl: input.coverUrl || '/covers/default.png',
    cover: input.coverUrl || '/covers/default.png',
    fileUrl: input.fileUrl || '',
    fileType: input.fileType || 'PDF',
    fileSize: input.fileSize || '15 MB',
    pages: Number(input.pages) || 320,
    publisher: input.publisher || 'Academic BookStore Press',
    publicationYear: Number(input.publicationYear) || new Date().getFullYear(),
    isbn: input.isbn || `978-0-${Math.floor(100000000 + Math.random() * 900000000)}`,
    tags: input.tags || [input.category.toLowerCase()],
    bookType: input.bookType,
    type: input.bookType,
    price: cleanPrice,
    downloadAllowed: input.downloadAllowed ?? true,
    licenseType: input.licenseType || 'Open License',
    sourceUrl: input.sourceUrl || '',
    views: 0,
    downloads: 0,
    rating: 5.0,
    reviewsCount: 1,
    featured: Boolean(input.featured),
    status: input.status || 'ACTIVE',
    dateAdded: now.split('T')[0],
    createdAt: now,
    updatedAt: now,
    coverTheme: {
      gradient: isFree
        ? 'from-blue-900 via-indigo-950 to-slate-900'
        : 'from-amber-950 via-slate-950 to-stone-900',
      accent: isFree ? '#38bdf8' : '#fbbf24',
      pattern: 'network',
    },
  };

  const { isConnected } = getDBStatus();

  if (isConnected) {
    try {
      const doc = await BookModel.create({
        ...newBookRecord,
        _id: id,
      });
      console.log(`[MongoDB] Created book: "${doc.title}" (ID: ${doc._id})`);
    } catch (e: any) {
      console.warn('[MongoDB Create Book Error]:', e.message);
    }
  }

  // Always sync to memory store
  memoryBooks.set(id, newBookRecord);

  return newBookRecord;
}

export async function updateBook(id: string, updateData: Partial<CreateBookInput>): Promise<any> {
  const existing = await getBookById(id);
  if (!existing) {
    throw new Error(`Book with ID "${id}" not found`);
  }

  // Price rule enforcement
  let cleanPrice = existing.price;
  let bookType = updateData.bookType || existing.bookType;

  if (bookType === 'FREE') {
    cleanPrice = 0;
  } else if (updateData.price !== undefined) {
    cleanPrice = Number(updateData.price);
    if (isNaN(cleanPrice) || cleanPrice <= 0) {
      throw new Error('Premium books must have a valid price greater than ₹0');
    }
  }

  const updatedRecord = {
    ...existing,
    ...updateData,
    id,
    bookType,
    type: bookType,
    price: cleanPrice,
    updatedAt: new Date().toISOString(),
  };

  // If a new cover was uploaded, remove old cover if it was on disk
  if (updateData.coverUrl && updateData.coverUrl !== existing.coverUrl && existing.coverUrl?.startsWith('/uploads/')) {
    removeFileIfPresent(existing.coverUrl);
  }

  // If a new book file was uploaded, remove old file if it was on disk
  if (updateData.fileUrl && updateData.fileUrl !== existing.fileUrl && existing.fileUrl?.startsWith('/uploads/')) {
    removeFileIfPresent(existing.fileUrl);
  }

  const { isConnected } = getDBStatus();

  if (isConnected) {
    try {
      await BookModel.findOneAndUpdate({ _id: id }, updatedRecord);
    } catch (e: any) {
      console.warn('[MongoDB Update Book Error]:', e.message);
    }
  }

  memoryBooks.set(id, updatedRecord);
  return updatedRecord;
}

export async function deleteBook(id: string): Promise<boolean> {
  const existing = await getBookById(id);
  if (!existing) {
    throw new Error(`Book with ID "${id}" not found`);
  }

  // Requirement 9: Remove associated files from storage
  if (existing.coverUrl?.startsWith('/uploads/')) {
    removeFileIfPresent(existing.coverUrl);
  }
  if (existing.fileUrl?.startsWith('/uploads/')) {
    removeFileIfPresent(existing.fileUrl);
  }

  const { isConnected } = getDBStatus();

  if (isConnected) {
    try {
      await BookModel.findOneAndDelete({ _id: id });
    } catch (e: any) {
      console.warn('[MongoDB Delete Book Error]:', e.message);
    }
  }

  memoryBooks.delete(id);
  return true;
}

export async function getAllBooks(filters?: {
  search?: string;
  category?: string;
  bookType?: string;
  status?: string;
}): Promise<any[]> {
  const { isConnected } = getDBStatus();

  let list: any[] = [];

  if (isConnected) {
    try {
      const query: any = {};
      if (filters?.category && filters.category !== 'ALL') {
        query.category = filters.category;
      }
      if (filters?.bookType && filters.bookType !== 'ALL') {
        query.bookType = filters.bookType;
      }
      if (filters?.status && filters.status !== 'ALL') {
        query.status = filters.status;
      }
      const docs = await BookModel.find(query).sort({ createdAt: -1 });
      if (docs.length > 0) {
        list = docs.map(d => ({
          ...d.toObject(),
          id: d._id.toString(),
          type: d.bookType,
          cover: d.coverUrl,
        }));
      }
    } catch (e) {
      // fallback
    }
  }

  if (list.length === 0) {
    list = Array.from(memoryBooks.values());
  }

  // Apply filters in memory
  if (filters?.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(b => {
      const titleMatch = b.title.toLowerCase().includes(q);
      const authorMatch = b.author.toLowerCase().includes(q);
      const catMatch = b.category.toLowerCase().includes(q);
      const tagsMatch = b.tags && Array.isArray(b.tags) && b.tags.some((t: string) => t.toLowerCase().includes(q));
      return titleMatch || authorMatch || catMatch || tagsMatch;
    });
  }

  if (filters?.category && filters.category !== 'ALL') {
    list = list.filter(b => b.category.toLowerCase() === filters.category!.toLowerCase());
  }

  if (filters?.bookType && filters.bookType !== 'ALL') {
    list = list.filter(b => (b.bookType || b.type) === filters.bookType);
  }

  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter(b => b.status === filters.status);
  }

  return list;
}

export async function getBookById(id: string): Promise<any | null> {
  const { isConnected } = getDBStatus();

  if (isConnected) {
    try {
      const doc = await BookModel.findById(id);
      if (doc) {
        return {
          ...doc.toObject(),
          id: doc._id.toString(),
          type: doc.bookType,
          cover: doc.coverUrl,
        };
      }
    } catch (e) {}
  }

  return memoryBooks.get(id) || null;
}

export async function incrementBookViews(id: string): Promise<number> {
  const { isConnected } = getDBStatus();
  let updatedViews = 1;

  if (isConnected) {
    try {
      const doc = await BookModel.findByIdAndUpdate(
        id,
        { $inc: { views: 1 } },
        { new: true }
      );
      if (doc) updatedViews = doc.views;
    } catch (e) {}
  }

  const mem = memoryBooks.get(id);
  if (mem) {
    mem.views = (mem.views || 0) + 1;
    updatedViews = mem.views;
  }

  return updatedViews;
}

export async function incrementBookDownloads(id: string): Promise<number> {
  const { isConnected } = getDBStatus();
  let updatedDownloads = 1;

  if (isConnected) {
    try {
      const doc = await BookModel.findByIdAndUpdate(
        id,
        { $inc: { downloads: 1 } },
        { new: true }
      );
      if (doc) updatedDownloads = doc.downloads;
    } catch (e) {}
  }

  const mem = memoryBooks.get(id);
  if (mem) {
    mem.downloads = (mem.downloads || 0) + 1;
    updatedDownloads = mem.downloads;
  }

  return updatedDownloads;
}

/**
 * Dashboard & Analytics Metrics (Requirement 11 & 20)
 */
export async function getAdminDashboardMetrics() {
  const users = await getAllUsers();
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === 'ACTIVE').length;
  const adminUsers = users.filter(u => u.role === 'ADMIN').length;

  const allBooksList = await getAllBooks();
  const totalBooks = allBooksList.length;
  let freeBooks = 0;
  let premiumBooks = 0;
  let totalViews = 0;
  let totalDownloads = 0;

  for (const b of allBooksList) {
    if (b.bookType === 'FREE' || b.type === 'FREE') freeBooks++;
    if (b.bookType === 'PREMIUM' || b.type === 'PREMIUM') premiumBooks++;
    totalViews += (b.views || 0);
    totalDownloads += (b.downloads || 0);
  }

  // Requirement 11: Top segmented lists
  const recentlyAddedBooks = [...allBooksList]
    .sort((a, b) => new Date(b.dateAdded || b.createdAt).getTime() - new Date(a.dateAdded || a.createdAt).getTime())
    .slice(0, 5);

  const mostViewedBooks = [...allBooksList]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5);

  const mostDownloadedBooks = [...allBooksList]
    .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
    .slice(0, 5);

  // Include Phase 6 Revenue Analytics
  const revenueData = await getRevenueAnalytics();

  return {
    overview: {
      totalBooks,
      freeBooks,
      premiumBooks,
      totalUsers,
      activeUsers,
      adminUsers,
      totalViews,
      totalDownloads,
      totalSales: revenueData.totalSales,
      totalRevenue: revenueData.totalRevenue,
      paidOrders: revenueData.paidOrders,
      failedOrders: revenueData.failedOrders,
    },
    recentlyAddedBooks,
    mostViewedBooks,
    mostDownloadedBooks,
    revenue: revenueData,
    system: {
      mongodb: getDBStatus(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * ==================================================
 * PHASE 5: READING PROGRESS, BOOKMARKS & ACCESS STORE
 * ==================================================
 */

export interface ReadingProgressData {
  userId: string;
  bookId: string;
  currentPage: number;
  totalPages: number;
  percentage: number;
  lastReadAt: string;
}

/**
 * Get reading progress for a user and book
 */
export async function getReadingProgress(userId: string, bookId: string): Promise<ReadingProgressData | null> {
  const { isConnected } = getDBStatus();
  if (isConnected) {
    try {
      const doc = await ReadingProgressModel.findOne({ userId, bookId });
      if (doc) {
        return {
          userId: doc.userId,
          bookId: doc.bookId,
          currentPage: doc.currentPage,
          totalPages: doc.totalPages,
          percentage: doc.percentage,
          lastReadAt: doc.lastReadAt.toISOString(),
        };
      }
    } catch (e) {
      // fallback
    }
  }

  const key = `${userId}:${bookId}`;
  return memoryReadingProgress.get(key) || null;
}

/**
 * Save or update reading progress
 * percentage = Math.round((currentPage / totalPages) * 100)
 * Does NOT create duplicates for same user and book
 */
export async function saveReadingProgress(
  userId: string,
  bookId: string,
  currentPage: number,
  totalPages: number
): Promise<ReadingProgressData> {
  const safeCurrent = Math.max(1, Math.floor(currentPage));
  const safeTotal = Math.max(1, Math.floor(totalPages));
  const percentage = Math.min(100, Math.max(0, Math.round((safeCurrent / safeTotal) * 100)));
  const now = new Date();

  const { isConnected } = getDBStatus();
  if (isConnected) {
    try {
      const doc = await ReadingProgressModel.findOneAndUpdate(
        { userId, bookId },
        {
          currentPage: safeCurrent,
          totalPages: safeTotal,
          percentage,
          lastReadAt: now,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      if (doc) {
        return {
          userId: doc.userId,
          bookId: doc.bookId,
          currentPage: doc.currentPage,
          totalPages: doc.totalPages,
          percentage: doc.percentage,
          lastReadAt: doc.lastReadAt.toISOString(),
        };
      }
    } catch (e) {
      // fallback
    }
  }

  const key = `${userId}:${bookId}`;
  const record: ReadingProgressData = {
    userId,
    bookId,
    currentPage: safeCurrent,
    totalPages: safeTotal,
    percentage,
    lastReadAt: now.toISOString(),
  };
  memoryReadingProgress.set(key, record);
  return record;
}

/**
 * Get all reading progress items for a user (for "Continue Reading" shelf)
 */
export async function getUserReadingProgressList(userId: string): Promise<ReadingProgressData[]> {
  const { isConnected } = getDBStatus();
  if (isConnected) {
    try {
      const docs = await ReadingProgressModel.find({ userId }).sort({ lastReadAt: -1 });
      if (docs.length > 0) {
        return docs.map(d => ({
          userId: d.userId,
          bookId: d.bookId,
          currentPage: d.currentPage,
          totalPages: d.totalPages,
          percentage: d.percentage,
          lastReadAt: d.lastReadAt.toISOString(),
        }));
      }
    } catch (e) {
      // fallback
    }
  }

  const list: ReadingProgressData[] = [];
  for (const [k, v] of memoryReadingProgress.entries()) {
    if (k.startsWith(`${userId}:`)) {
      list.push(v);
    }
  }
  return list.sort((a, b) => new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime());
}

/**
 * Bookmarks: Get all bookmarks for a user and book
 */
export async function getBookmarks(userId: string, bookId: string): Promise<any[]> {
  const { isConnected } = getDBStatus();
  if (isConnected) {
    try {
      const docs = await BookmarkModel.find({ userId, bookId }).sort({ page: 1 });
      return docs.map(d => ({
        id: d._id.toString(),
        userId: d.userId,
        bookId: d.bookId,
        page: d.page,
        note: d.note || '',
        createdAt: d.createdAt.toISOString(),
      }));
    } catch (e) {
      // fallback
    }
  }

  const key = `${userId}:${bookId}`;
  return memoryBookmarks.get(key) || [];
}

/**
 * Add bookmark for user and book
 */
export async function addBookmark(userId: string, bookId: string, page: number, note?: string): Promise<any> {
  const safePage = Math.max(1, Math.floor(page));
  const { isConnected } = getDBStatus();

  if (isConnected) {
    try {
      const doc = await BookmarkModel.findOneAndUpdate(
        { userId, bookId, page: safePage },
        { note: note || '' },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return {
        id: doc._id.toString(),
        userId: doc.userId,
        bookId: doc.bookId,
        page: doc.page,
        note: doc.note,
        createdAt: doc.createdAt.toISOString(),
      };
    } catch (e) {
      // fallback
    }
  }

  const key = `${userId}:${bookId}`;
  const existing = memoryBookmarks.get(key) || [];
  const foundIdx = existing.findIndex(b => b.page === safePage);
  const now = new Date().toISOString();
  const item = {
    id: `bm-${Date.now()}-${safePage}`,
    userId,
    bookId,
    page: safePage,
    note: note || '',
    createdAt: now,
  };

  if (foundIdx >= 0) {
    existing[foundIdx] = item;
  } else {
    existing.push(item);
    existing.sort((a, b) => a.page - b.page);
  }
  memoryBookmarks.set(key, existing);
  return item;
}

/**
 * Remove bookmark for user and book at specific page
 */
export async function removeBookmark(userId: string, bookId: string, page: number): Promise<boolean> {
  const safePage = Math.max(1, Math.floor(page));
  const { isConnected } = getDBStatus();

  if (isConnected) {
    try {
      await BookmarkModel.findOneAndDelete({ userId, bookId, page: safePage });
    } catch (e) {
      // fallback
    }
  }

  const key = `${userId}:${bookId}`;
  const existing = memoryBookmarks.get(key) || [];
  const filtered = existing.filter(b => b.page !== safePage);
  memoryBookmarks.set(key, filtered);
  return true;
}

/**
 * Access Check: Check if a user has access to a book
 * - Admin: always allowed
 * - Free book: always allowed
 * - Premium book: allowed if user has a PAID order or Completed purchase record
 */
export async function checkUserBookAccess(userId: string, bookId: string, userRole?: string): Promise<boolean> {
  if (userRole === 'ADMIN') return true;

  const book = await getBookById(bookId);
  if (!book) return false;

  const isFree = book.bookType === 'FREE' || book.type === 'FREE';
  if (isFree) return true;

  // Premium book: check OrderModel for paymentStatus: 'PAID' or PurchaseModel for status: 'Completed'
  const { isConnected } = getDBStatus();
  if (isConnected) {
    try {
      const paidOrder = await OrderModel.findOne({ userId, bookId, paymentStatus: 'PAID' });
      if (paidOrder) return true;

      const purchase = await PurchaseModel.findOne({ userId, bookId, status: 'Completed' });
      if (purchase) return true;
    } catch (e) {
      // fallback
    }
  }

  // Memory checks
  for (const ord of memoryOrders.values()) {
    if (ord.userId === userId && ord.bookId === bookId && ord.paymentStatus === 'PAID') {
      return true;
    }
  }

  const userPurchases = memoryPurchases.get(userId) || [];
  return userPurchases.some(p => p.bookId === bookId && p.status === 'Completed');
}

/**
 * ==================================================
 * PHASE 6: ORDER SYSTEM, PAYMENT & REVENUE STORE
 * ==================================================
 */

export interface CreateOrderInput {
  userId: string;
  bookId: string;
}

/**
 * Create Order:
 * Retrieves user identity and actual book price from DB.
 * Checks for duplicate purchase (if already PAID).
 */
export async function createOrder(input: CreateOrderInput): Promise<any> {
  const { userId, bookId } = input;

  const book = await getBookById(bookId);
  if (!book) {
    throw new Error('Book not found');
  }

  const isFree = book.bookType === 'FREE' || book.type === 'FREE';
  if (isFree) {
    throw new Error('This book is free and does not require an order or purchase');
  }

  // Requirement 13: Prevent duplicate purchase if user already owns it
  const alreadyOwned = await checkUserBookAccess(userId, bookId);
  if (alreadyOwned) {
    const err: any = new Error('Already purchased. You already have access to this e-book.');
    err.code = 'ALREADY_PURCHASED';
    err.bookId = bookId;
    throw err;
  }

  // If there is an existing PENDING order for this user and book, we can reuse or create fresh
  const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const amount = Number(book.price);
  const now = new Date();

  const newOrderRecord = {
    orderId,
    userId,
    bookId,
    bookTitle: book.title,
    amount,
    currency: 'INR',
    paymentStatus: 'PENDING' as PaymentStatus,
    paymentMethod: 'TEST_UPI',
    paymentReference: '',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const { isConnected } = getDBStatus();
  if (isConnected) {
    try {
      const doc = await OrderModel.create({
        orderId,
        userId,
        bookId,
        bookTitle: book.title,
        amount,
        currency: 'INR',
        paymentStatus: 'PENDING',
      });
      return {
        id: doc._id.toString(),
        orderId: doc.orderId,
        userId: doc.userId,
        bookId: doc.bookId,
        bookTitle: doc.bookTitle,
        amount: doc.amount,
        currency: doc.currency,
        paymentStatus: doc.paymentStatus,
        createdAt: doc.createdAt.toISOString(),
      };
    } catch (e: any) {
      console.warn('[MongoDB Create Order Error]:', e.message);
    }
  }

  memoryOrders.set(orderId, newOrderRecord);
  return newOrderRecord;
}

/**
 * Process Test Payment:
 * action: 'SUCCESS' | 'FAIL'
 */
export async function processOrderPayment(
  orderId: string,
  userId: string,
  action: 'SUCCESS' | 'FAIL',
  paymentMethod = 'Test UPI'
): Promise<any> {
  const { isConnected } = getDBStatus();
  let order: any = null;

  if (isConnected) {
    try {
      order = await OrderModel.findOne({ orderId });
    } catch {}
  }
  if (!order) {
    order = memoryOrders.get(orderId);
  }

  if (!order) {
    throw new Error('Order not found');
  }

  // Verify ownership: user can only pay their own order
  if (order.userId !== userId) {
    throw new Error('Unauthorized: You can only pay for your own orders');
  }

  if (order.paymentStatus === 'PAID') {
    throw new Error('This order has already been paid');
  }

  const now = new Date();
  const paymentRef = action === 'SUCCESS' ? `TXN-DEMO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}` : '';
  const newStatus: PaymentStatus = action === 'SUCCESS' ? 'PAID' : 'FAILED';
  const failureReason = action === 'FAIL' ? 'Card declined or demo payment simulation rejected by user.' : '';

  if (isConnected) {
    try {
      order.paymentStatus = newStatus;
      order.paymentMethod = paymentMethod;
      order.paymentReference = paymentRef;
      order.failureReason = failureReason;
      await order.save();

      // If success, also record in PurchaseModel for unified access
      if (action === 'SUCCESS') {
        await PurchaseModel.findOneAndUpdate(
          { userId, bookId: order.bookId },
          {
            userId,
            bookId: order.bookId,
            orderId: order.orderId,
            amount: order.amount,
            paymentMethod,
            status: 'Completed',
            purchasedAt: now,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    } catch (e: any) {
      console.warn('[MongoDB Payment Update Error]:', e.message);
    }
  }

  // Sync memory
  order.paymentStatus = newStatus;
  order.paymentMethod = paymentMethod;
  order.paymentReference = paymentRef;
  order.failureReason = failureReason;
  order.updatedAt = now.toISOString();
  memoryOrders.set(orderId, order);

  if (action === 'SUCCESS') {
    const list = memoryPurchases.get(userId) || [];
    list.unshift({
      id: `pur-${Date.now()}`,
      userId,
      bookId: order.bookId,
      orderId: order.orderId,
      amount: order.amount,
      paymentMethod,
      status: 'Completed',
      purchasedAt: now.toISOString(),
    });
    memoryPurchases.set(userId, list);
  }

  return {
    orderId: order.orderId,
    userId: order.userId,
    bookId: order.bookId,
    bookTitle: order.bookTitle,
    amount: order.amount,
    currency: order.currency || 'INR',
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    failureReason: order.failureReason,
    updatedAt: now.toISOString(),
  };
}

/**
 * Get user orders (only user's own orders)
 */
export async function getUserOrders(userId: string): Promise<any[]> {
  const { isConnected } = getDBStatus();
  if (isConnected) {
    try {
      const docs = await OrderModel.find({ userId }).sort({ createdAt: -1 });
      if (docs.length > 0) {
        return docs.map(d => ({
          orderId: d.orderId,
          userId: d.userId,
          bookId: d.bookId,
          bookTitle: d.bookTitle,
          amount: d.amount,
          currency: d.currency,
          paymentStatus: d.paymentStatus,
          paymentMethod: d.paymentMethod,
          paymentReference: d.paymentReference,
          createdAt: d.createdAt.toISOString(),
        }));
      }
    } catch {}
  }

  const list: any[] = [];
  for (const ord of memoryOrders.values()) {
    if (ord.userId === userId) {
      list.push(ord);
    }
  }
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get order by ID (with user ownership validation)
 */
export async function getOrderById(orderId: string, userId?: string, isAdmin?: boolean): Promise<any | null> {
  const { isConnected } = getDBStatus();
  let ord: any = null;

  if (isConnected) {
    try {
      ord = await OrderModel.findOne({ orderId });
    } catch {}
  }
  if (!ord) {
    ord = memoryOrders.get(orderId);
  }
  if (!ord) return null;

  // Ownership check unless admin
  if (!isAdmin && userId && ord.userId !== userId) {
    throw new Error('Unauthorized to view this order');
  }

  return {
    orderId: ord.orderId,
    userId: ord.userId,
    bookId: ord.bookId,
    bookTitle: ord.bookTitle,
    amount: ord.amount,
    currency: ord.currency,
    paymentStatus: ord.paymentStatus,
    paymentMethod: ord.paymentMethod,
    paymentReference: ord.paymentReference,
    failureReason: ord.failureReason,
    createdAt: ord.createdAt?.toISOString ? ord.createdAt.toISOString() : ord.createdAt,
    updatedAt: ord.updatedAt?.toISOString ? ord.updatedAt.toISOString() : ord.updatedAt,
  };
}

/**
 * Get all orders for Admin with filters (Requirement 10)
 * Filters: status: PAID | PENDING | FAILED | CANCELLED
 */
export async function getAllOrdersForAdmin(filters?: { status?: string; search?: string }): Promise<any[]> {
  const { isConnected } = getDBStatus();
  let list: any[] = [];

  if (isConnected) {
    try {
      const q: any = {};
      if (filters?.status && filters.status !== 'ALL') {
        q.paymentStatus = filters.status;
      }
      const docs = await OrderModel.find(q).sort({ createdAt: -1 });
      if (docs.length > 0) {
        list = docs.map(d => ({
          orderId: d.orderId,
          userId: d.userId,
          bookId: d.bookId,
          bookTitle: d.bookTitle,
          amount: d.amount,
          currency: d.currency,
          paymentStatus: d.paymentStatus,
          paymentMethod: d.paymentMethod,
          paymentReference: d.paymentReference,
          createdAt: d.createdAt.toISOString(),
        }));
      }
    } catch {}
  }

  if (list.length === 0) {
    list = Array.from(memoryOrders.values());
    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter(o => o.paymentStatus === filters.status);
    }
  }

  // Populate user display info safely (without sensitive info)
  const enriched = await Promise.all(
    list.map(async o => {
      const user = await findUserById(o.userId);
      return {
        ...o,
        userName: user?.name || 'Student Customer',
        userEmail: user?.email || 'student@college.edu',
      };
    })
  );

  if (filters?.search && filters.search.trim()) {
    const s = filters.search.toLowerCase().trim();
    return enriched.filter(
      o =>
        o.orderId.toLowerCase().includes(s) ||
        o.bookTitle.toLowerCase().includes(s) ||
        o.userName.toLowerCase().includes(s) ||
        o.userEmail.toLowerCase().includes(s)
    );
  }

  return enriched;
}

/**
 * Requirement 11: REVENUE ANALYTICS
 * Connect Admin Dashboard to purchase data
 * Only PAID orders contribute to revenue.
 */
export async function getRevenueAnalytics() {
  const orders = await getAllOrdersForAdmin();

  let totalSales = 0;
  let totalRevenue = 0;
  let paidOrders = 0;
  let failedOrders = 0;
  let pendingOrders = 0;
  let cancelledOrders = 0;

  const bookPurchasedCounts: Record<string, { title: string; count: number; revenue: number }> = {};
  const monthlyRevenueMap: Record<string, { sales: number; revenue: number }> = {};

  // Initialize last 6 months buckets
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    monthlyRevenueMap[key] = { sales: 0, revenue: 0 };
  }

  for (const o of orders) {
    if (o.paymentStatus === 'PAID') {
      totalSales++;
      paidOrders++;
      totalRevenue += o.amount;

      // Track by book
      if (!bookPurchasedCounts[o.bookId]) {
        bookPurchasedCounts[o.bookId] = { title: o.bookTitle, count: 0, revenue: 0 };
      }
      bookPurchasedCounts[o.bookId].count++;
      bookPurchasedCounts[o.bookId].revenue += o.amount;

      // Track by month
      const date = new Date(o.createdAt);
      const mKey = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      if (monthlyRevenueMap[mKey]) {
        monthlyRevenueMap[mKey].sales++;
        monthlyRevenueMap[mKey].revenue += o.amount;
      }
    } else if (o.paymentStatus === 'FAILED') {
      failedOrders++;
    } else if (o.paymentStatus === 'PENDING') {
      pendingOrders++;
    } else if (o.paymentStatus === 'CANCELLED') {
      cancelledOrders++;
    }
  }

  // Top purchased books
  const topPurchasedBooks = Object.values(bookPurchasedCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const monthlyCharts = Object.entries(monthlyRevenueMap).map(([month, data]) => ({
    month,
    sales: data.sales,
    revenue: data.revenue,
  }));

  return {
    totalSales,
    totalRevenue,
    paidOrders,
    failedOrders,
    pendingOrders,
    cancelledOrders,
    premiumBooksSold: totalSales,
    topPurchasedBooks,
    monthlyCharts,
  };
}

/**
 * Backward compatibility recordPurchase
 */
export async function recordPurchase(userId: string, bookId: string, amount: number, paymentMethod = 'UPI'): Promise<any> {
  const ord = await createOrder({ userId, bookId });
  return processOrderPayment(ord.orderId, userId, 'SUCCESS', paymentMethod);
}


