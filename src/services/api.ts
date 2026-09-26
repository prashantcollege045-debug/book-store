/**
 * Book Store Management System - Client API Service Layer
 * 
 * Communicates with Express.js / Node.js / MongoDB backend endpoints.
 * Handles authentication tokens, authorization headers, multipart file uploads,
 * error formatting, and user-isolated data flows.
 */

import { Book, Category, SortOption, UserProfile } from '../types';
import { BOOKS_DATA } from '../data/booksData';
import { CATEGORIES_DATA } from '../data/categoriesData';

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  // Do not set Content-Type header if sending FormData (browser automatically sets boundary)
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = localStorage.getItem('bookstore_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.message || `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, data);
  }

  return data;
}

/**
 * Authentication Service (Phase 3)
 */
export const authService = {
  async register(data: { name: string; email: string; password: string; confirmPassword: string }) {
    const res = await request<{
      success: boolean;
      message: string;
      token: string;
      user: UserProfile;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (res.token) {
      localStorage.setItem('bookstore_token', res.token);
    }
    return res;
  },

  async login(credentials: { email: string; password: string }) {
    const res = await request<{
      success: boolean;
      message: string;
      token: string;
      user: UserProfile;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (res.token) {
      localStorage.setItem('bookstore_token', res.token);
    }
    return res;
  },

  async logout() {
    try {
      await request<{ success: boolean }>('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('bookstore_token');
      localStorage.removeItem('bookstore_user');
    }
  },

  async getMe(): Promise<{ success: boolean; user: UserProfile }> {
    return request<{ success: boolean; user: UserProfile }>('/auth/me');
  },
};

/**
 * User-Isolated Wishlist Service (Requirement 17)
 */
export const wishlistService = {
  async get(): Promise<string[]> {
    const res = await request<{ success: boolean; data: string[] }>('/wishlist');
    return res.data;
  },

  async toggle(bookId: string): Promise<{ action: 'added' | 'removed'; data: string[] }> {
    const res = await request<{
      success: boolean;
      action: 'added' | 'removed';
      data: string[];
    }>('/wishlist/toggle', {
      method: 'POST',
      body: JSON.stringify({ bookId }),
    });
    return { action: res.action, data: res.data };
  },

  async sync(bookIds: string[]): Promise<string[]> {
    const res = await request<{ success: boolean; data: string[] }>('/wishlist', {
      method: 'PUT',
      body: JSON.stringify({ bookIds }),
    });
    return res.data;
  },
};

/**
 * Administrator API Service (Phase 4 Book Management & Metrics)
 */
export const adminService = {
  async getDashboard() {
    const res = await request<{ success: boolean; data: any }>('/admin/dashboard');
    return res.data;
  },

  async getUsers(): Promise<UserProfile[]> {
    const res = await request<{ success: boolean; data: UserProfile[] }>('/admin/users');
    return res.data;
  },

  async updateUserStatus(userId: string, status: 'ACTIVE' | 'DISABLED') {
    const res = await request<{ success: boolean; message: string; data: UserProfile }>(
      `/admin/users/${userId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    );
    return res;
  },

  async getBooks(filters?: { search?: string; category?: string; bookType?: string; status?: string }): Promise<Book[]> {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.category && filters.category !== 'ALL') params.set('category', filters.category);
    if (filters?.bookType && filters.bookType !== 'ALL') params.set('bookType', filters.bookType);
    if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await request<{ success: boolean; data: Book[] }>(`/admin/books${qs}`);
    return res.data;
  },

  async createBook(formData: FormData) {
    const res = await request<{ success: boolean; message: string; data: Book }>('/admin/books', {
      method: 'POST',
      body: formData,
    });
    return res;
  },

  async updateBook(id: string, formData: FormData) {
    const res = await request<{ success: boolean; message: string; data: Book }>(`/admin/books/${id}`, {
      method: 'PUT',
      body: formData,
    });
    return res;
  },

  async deleteBook(id: string) {
    const res = await request<{ success: boolean; message: string }>(`/admin/books/${id}`, {
      method: 'DELETE',
    });
    return res;
  },

  async getOrders() {
    const res = await request<{ success: boolean; data: any[] }>('/admin/orders');
    return res.data;
  },

  async getAnalytics() {
    const res = await request<{ success: boolean; data: any }>('/admin/analytics');
    return res.data;
  },
};

/**
 * Public Book Service (Filters, Sorting, Catalogs)
 */
export interface BookFilterParams {
  search?: string;
  category?: string;
  type?: 'FREE' | 'PREMIUM' | 'ALL';
  language?: string;
  sortBy?: SortOption;
}

export const BookService = {
  async getBooks(filters?: BookFilterParams): Promise<Book[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.category && filters.category !== 'ALL') params.set('category', filters.category);
      if (filters?.type && filters.type !== 'ALL') params.set('type', filters.type);
      if (filters?.language && filters.language !== 'ALL') params.set('language', filters.language);
      if (filters?.sortBy) params.set('sortBy', filters.sortBy);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await request<{ success: boolean; data: Book[] }>(`/books${qs}`);
      if (res?.data && res.data.length > 0) {
        return res.data;
      }
    } catch {
      // Local fallback if API is not yet loaded
    }

    let result = [...BOOKS_DATA];

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(b => {
        const titleMatch = b.title.toLowerCase().includes(q);
        const authorMatch = b.author.toLowerCase().includes(q);
        const categoryMatch = b.category.toLowerCase().includes(q);
        const tagsMatch = b.tags && b.tags.some(tag => tag.toLowerCase().includes(q));
        const descMatch = b.description.toLowerCase().includes(q);
        return titleMatch || authorMatch || categoryMatch || tagsMatch || descMatch;
      });
    }

    if (filters?.category && filters.category !== 'ALL') {
      const targetCat = filters.category.toLowerCase().trim();
      result = result.filter(
        b =>
          b.category.toLowerCase().trim() === targetCat ||
          (targetCat === 'ai' && b.category.toLowerCase().includes('artificial intelligence'))
      );
    }

    if (filters?.type && filters.type !== 'ALL') {
      result = result.filter(b => b.type === filters.type);
    }

    if (filters?.language && filters.language !== 'ALL') {
      result = result.filter(
        b => b.language.toLowerCase() === filters.language!.toLowerCase()
      );
    }

    const sortBy = filters?.sortBy || 'latest';
    switch (sortBy) {
      case 'latest':
        result.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
        break;
      case 'popular':
        result.sort((a, b) => (b.views + b.downloads) - (a.views + a.downloads));
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'title-az':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return result;
  },

  async getBookById(id: string): Promise<Book | undefined> {
    try {
      const res = await request<{ success: boolean; data: Book }>(`/books/${id}`);
      if (res?.data) return res.data;
    } catch {}
    return BOOKS_DATA.find(b => b.id === id);
  },

  async getFeaturedBooks(limit = 8): Promise<Book[]> {
    const all = await this.getBooks();
    const featured = all.filter(b => b.featured);
    return featured.slice(0, limit);
  },

  async getFreeBooks(limit = 4): Promise<Book[]> {
    const all = await this.getBooks({ type: 'FREE' });
    return all.slice(0, limit);
  },

  async getPremiumBooks(limit = 4): Promise<Book[]> {
    const all = await this.getBooks({ type: 'PREMIUM' });
    return all.slice(0, limit);
  },

  async getLatestBooks(limit = 6): Promise<Book[]> {
    const all = await this.getBooks({ sortBy: 'latest' });
    return all.slice(0, limit);
  },

  async getPopularBooks(limit = 4): Promise<Book[]> {
    const all = await this.getBooks({ sortBy: 'popular' });
    return all.slice(0, limit);
  },

  async recordBookView(id: string): Promise<void> {
    try {
      await request<{ success: boolean; views: number }>(`/books/${id}/view`, {
        method: 'POST',
      });
    } catch {}
  },

  getDownloadUrl(id: string): string {
    const token = localStorage.getItem('bookstore_token');
    return token ? `/api/books/${id}/download?token=${encodeURIComponent(token)}` : `/api/books/${id}/download`;
  },

  async downloadBook(book: Book): Promise<void> {
    const token = localStorage.getItem('bookstore_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/books/${book.id}/download`, { credentials: 'same-origin', headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to download book' }));
      throw new Error(err.message || 'Download failed');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = book.fileType?.toLowerCase() === 'epub' ? 'epub' : 'pdf';
    const safeTitle = (book.title || 'academic_book').replace(/[^a-zA-Z0-9-_]/g, '_');
    a.download = `${safeTitle}.${ext}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // ==========================================
  // PHASE 5: READER & E-BOOK INTERACTION APIS
  // ==========================================

  async getReaderInfo(bookId: string) {
    return request<{
      success: boolean;
      hasAccess: boolean;
      data: {
        book: any;
        progress: any;
        bookmarks: any[];
      };
      message?: string;
      price?: number;
    }>(`/books/${bookId}/read`);
  },

  getBookFileUrl(bookId: string): string {
    const token = localStorage.getItem('bookstore_token');
    return token ? `/api/books/${bookId}/file?token=${encodeURIComponent(token)}` : `/api/books/${bookId}/file`;
  },

  async getProgress(bookId: string) {
    try {
      const res = await request<{ success: boolean; data: any }>(`/books/${bookId}/progress`);
      return res.data;
    } catch {
      return null;
    }
  },

  async saveProgress(bookId: string, currentPage: number, totalPages: number) {
    try {
      const res = await request<{ success: boolean; data: any }>(`/books/${bookId}/progress`, {
        method: 'PUT',
        body: JSON.stringify({ currentPage, totalPages }),
      });
      return res.data;
    } catch {
      return null;
    }
  },

  async getContinueReading() {
    try {
      const res = await request<{ success: boolean; data: any[] }>('/books/user/continue-reading');
      return res.data;
    } catch {
      return [];
    }
  },

  async getBookmarks(bookId: string) {
    try {
      const res = await request<{ success: boolean; data: any[] }>(`/books/${bookId}/bookmarks`);
      return res.data;
    } catch {
      return [];
    }
  },

  async addBookmark(bookId: string, page: number, note?: string) {
    const res = await request<{ success: boolean; message: string; data: any }>(`/books/${bookId}/bookmarks`, {
      method: 'POST',
      body: JSON.stringify({ page, note }),
    });
    return res.data;
  },

  async removeBookmark(bookId: string, page: number) {
    const res = await request<{ success: boolean; message: string }>(`/books/${bookId}/bookmarks/${page}`, {
      method: 'DELETE',
    });
    return res;
  },

  async checkAccess(bookId: string) {
    try {
      const res = await request<{
        success: boolean;
        hasAccess: boolean;
        isFree: boolean;
        price: number;
        message?: string;
      }>(`/books/${bookId}/access`);
      return res;
    } catch {
      return { success: false, hasAccess: false, isFree: false, price: 99 };
    }
  },

  async simulatePurchase(bookId: string, paymentMethod = 'UPI') {
    const res = await request<{ success: boolean; message: string; data: any }>(`/books/${bookId}/purchase-simulated`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    });
    return res;
  },
};

/**
 * ==================================================
 * PHASE 6: ORDER & PAYMENT SERVICE LAYER
 * ==================================================
 */
export const OrderService = {
  async createOrder(bookId: string) {
    const res = await request<{
      success: boolean;
      message: string;
      data: any;
      code?: string;
    }>('/orders', {
      method: 'POST',
      body: JSON.stringify({ bookId }),
    });
    return res;
  },

  async payOrder(orderId: string, action: 'SUCCESS' | 'FAIL', paymentMethod = 'Test UPI') {
    const res = await request<{
      success: boolean;
      message: string;
      data: any;
    }>(`/orders/${orderId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ action, paymentMethod }),
    });
    return res;
  },

  async getMyOrders(): Promise<any[]> {
    try {
      const res = await request<{ success: boolean; data: any[] }>('/orders');
      return res.data || [];
    } catch {
      return [];
    }
  },

  async getOrder(orderId: string) {
    const res = await request<{ success: boolean; data: any }>(`/orders/${orderId}`);
    return res.data;
  },
};

export const CategoryService = {
  async getCategories(): Promise<Category[]> {
    return Promise.resolve(CATEGORIES_DATA);
  },

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    return Promise.resolve(CATEGORIES_DATA.find(c => c.slug === slug));
  },
};
