export type BookType = 'FREE' | 'PREMIUM';

export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export type SortOption = 
  | 'latest' 
  | 'popular' 
  | 'rating' 
  | 'price-asc' 
  | 'price-desc' 
  | 'title-az';

export interface Chapter {
  id: string;
  title: string;
  readTime: string;
  content: string[];
}

export interface Book {
  id: string;
  _id?: string;
  title: string;
  author: string;
  description: string;
  category: string;
  language: string; // 'English' | 'Hindi' | 'Marathi'
  cover?: string;
  coverUrl?: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: string;
  type: BookType;
  bookType?: BookType;
  price: number; // in INR (₹) - 0 for FREE, demo price for PREMIUM
  downloadAllowed?: boolean;
  licenseType?: string;
  sourceUrl?: string;
  status?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  rating: number; // 1.0 - 5.0
  reviewsCount?: number;
  pages: number;
  publisher: string;
  publicationYear: number;
  tags: string[];
  views: number;
  downloads: number;
  dateAdded: string; // YYYY-MM-DD
  createdAt?: string;
  updatedAt?: string;
  featured: boolean;
  isbn?: string;
  edition?: string;
  coverTheme?: {
    gradient: string;
    accent: string;
    pattern: 'network' | 'code' | 'circuit' | 'grid' | 'database' | 'shield' | 'math' | 'ai';
  };
  chapters?: Chapter[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  bookCount: number;
}

export interface BookmarkItem {
  id?: string;
  userId?: string;
  bookId: string;
  page: number;
  note?: string;
  createdAt?: string;
}

export interface ReadingProgressRecord {
  userId?: string;
  bookId: string;
  currentPage: number;
  totalPages: number;
  percentage: number;
  lastReadAt?: string;
  book?: Partial<Book>;
}

export interface LibraryItem {
  id: string;
  bookId: string;
  status: 'reading' | 'completed' | 'bookmarked';
  progress: number; // 0 - 100%
  currentPage: number;
  lastRead: string;
  note?: string;
}

export type PaymentStatus = 
  | 'PENDING' 
  | 'PROCESSING' 
  | 'PAID' 
  | 'FAILED' 
  | 'CANCELLED' 
  | 'REFUNDED';

export type GatewayId = 'sandbox' | 'razorpay' | 'stripe';

export interface PaymentGatewayConfig {
  id: GatewayId;
  name: string;
  enabled: boolean;
  mode: 'TEST' | 'LIVE';
  configured: boolean;
  description: string;
  supportedCurrencies?: string[];
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  hasKeySecret?: boolean;
}

export interface PaymentGatewaySettings {
  activeGateway: GatewayId;
  gateways: Record<GatewayId, PaymentGatewayConfig>;
  updatedAt?: string;
}

export interface PublicGatewayInfo {
  id: GatewayId;
  name: string;
  enabled: boolean;
  mode: 'TEST' | 'LIVE';
  configured: boolean;
  description: string;
  keyId?: string;
}

export interface OrderItem {
  id?: string;
  orderId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  bookId: string;
  bookTitle: string;
  amount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  paymentReference?: string;
  gateway?: string;
  isTestMode?: boolean;
  paymentId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RazorpayOrderResponse {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  bookTitle: string;
  customerName?: string;
  customerEmail?: string;
}

export interface RazorpayVerificationPayload {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PurchaseRecord {
  orderId: string;
  bookId: string;
  bookTitle?: string;
  date: string;
  amount: number;
  paymentMethod: string;
  status: 'Completed' | 'Processing' | 'PAID' | 'FAILED' | 'REFUNDED';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  studentId?: string;
  college?: string;
  createdAt?: string;
}

export type AdminTab = 
  | 'dashboard'
  | 'books'
  | 'add-book'
  | 'categories'
  | 'users'
  | 'orders'
  | 'payment-gateways'
  | 'analytics'
  | 'ai-settings'
  | 'settings';

export type ActivePage = 
  | 'home' 
  | 'books' 
  | 'categories' 
  | 'category-detail' 
  | 'book-detail' 
  | 'free-books' 
  | 'premium-books' 
  | 'wishlist' 
  | 'library' 
  | 'login' 
  | 'register'
  | 'profile'
  | 'admin'
  | 'admin-payment-gateway'
  | 'reader'
  | 'checkout'
  | 'payment-demo'
  | 'payment-success'
  | 'payment-failed'
  | 'purchase-history';
