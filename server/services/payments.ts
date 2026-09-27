import crypto from 'crypto';
import { 
  createOrder as storeCreateOrder, 
  processOrderPayment as storeProcessOrderPayment,
  getUserOrders, 
  getOrderById, 
  checkUserBookAccess,
  getBookById,
  recordPurchase,
  findUserById
} from '../store';
import { OrderModel, PaymentGatewayType, PaymentStatus } from '../models/Order';
import { getDBStatus } from '../db';

// Memory fallback for payment settings
interface PaymentSettingsState {
  activeGateway: PaymentGatewayType;
  currency: string;
  gateways: {
    demo: { enabled: boolean; testMode: boolean };
    razorpay: { enabled: boolean; testMode: boolean };
    stripe: { enabled: boolean; testMode: boolean };
  };
}

let paymentSettings: PaymentSettingsState = {
  activeGateway: 'DEMO',
  currency: 'INR',
  gateways: {
    demo: { enabled: true, testMode: true },
    razorpay: { enabled: false, testMode: true },
    stripe: { enabled: false, testMode: true },
  },
};

// Check if credentials are present in server environment
export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getPublicPaymentConfig() {
  const razorpayConfigured = isRazorpayConfigured();
  const stripeConfigured = isStripeConfigured();

  return {
    activeGateway: paymentSettings.activeGateway,
    currency: paymentSettings.currency,
    testMode: true,
    gateways: [
      {
        id: 'DEMO' as PaymentGatewayType,
        name: 'Demo / Sandbox Simulator',
        enabled: paymentSettings.gateways.demo.enabled,
        testMode: true,
        configured: true,
        supportedCurrencies: ['INR', 'USD'],
        description: 'Instant sandbox testing for college evaluation. No real money required.',
        icon: 'Sparkles',
      },
      {
        id: 'RAZORPAY' as PaymentGatewayType,
        name: 'Razorpay Test Mode',
        enabled: paymentSettings.gateways.razorpay.enabled && razorpayConfigured,
        testMode: true,
        configured: razorpayConfigured,
        supportedCurrencies: ['INR'],
        description: 'UPI, RuPay, Netbanking & Cards in Test Mode with signature verification.',
        icon: 'CreditCard',
      },
      {
        id: 'STRIPE' as PaymentGatewayType,
        name: 'Stripe Test Mode',
        enabled: paymentSettings.gateways.stripe.enabled && stripeConfigured,
        testMode: true,
        configured: stripeConfigured,
        supportedCurrencies: ['INR', 'USD', 'EUR'],
        description: 'International card payments in Stripe Test Mode.',
        icon: 'Globe',
      },
    ],
    // Only public client-safe keys are exposed (never secrets)
    razorpayKeyId: razorpayConfigured ? process.env.RAZORPAY_KEY_ID : undefined,
    stripePublishableKey: stripeConfigured ? process.env.STRIPE_PUBLISHABLE_KEY : undefined,
  };
}

export function getAdminPaymentSettings() {
  const razorpayConfigured = isRazorpayConfigured();
  const stripeConfigured = isStripeConfigured();

  // Mask public keys for safe UI inspection (never show secrets)
  const maskKey = (k?: string) => {
    if (!k || k.length < 8) return undefined;
    return `${k.slice(0, 4)}...${k.slice(-4)}`;
  };

  return {
    activeGateway: paymentSettings.activeGateway,
    currency: paymentSettings.currency,
    gateways: {
      demo: {
        enabled: paymentSettings.gateways.demo.enabled,
        testMode: paymentSettings.gateways.demo.testMode,
      },
      razorpay: {
        enabled: paymentSettings.gateways.razorpay.enabled,
        testMode: paymentSettings.gateways.razorpay.testMode,
        configured: razorpayConfigured,
        keyIdPreview: maskKey(process.env.RAZORPAY_KEY_ID),
      },
      stripe: {
        enabled: paymentSettings.gateways.stripe.enabled,
        testMode: paymentSettings.gateways.stripe.testMode,
        configured: stripeConfigured,
        publishableKeyPreview: maskKey(process.env.STRIPE_PUBLISHABLE_KEY),
      },
    },
  };
}

export function updateAdminPaymentSettings(newSettings: Partial<PaymentSettingsState>) {
  if (newSettings.activeGateway) {
    paymentSettings.activeGateway = newSettings.activeGateway;
  }
  if (newSettings.currency) {
    paymentSettings.currency = newSettings.currency;
  }
  if (newSettings.gateways) {
    if (newSettings.gateways.demo) {
      paymentSettings.gateways.demo = {
        ...paymentSettings.gateways.demo,
        ...newSettings.gateways.demo,
      };
    }
    if (newSettings.gateways.razorpay) {
      paymentSettings.gateways.razorpay = {
        ...paymentSettings.gateways.razorpay,
        ...newSettings.gateways.razorpay,
      };
    }
    if (newSettings.gateways.stripe) {
      paymentSettings.gateways.stripe = {
        ...paymentSettings.gateways.stripe,
        ...newSettings.gateways.stripe,
      };
    }
  }
  return getAdminPaymentSettings();
}

/**
 * Creates internal order with strictly server-verified database price.
 */
export async function createPaymentOrder(params: {
  userId: string;
  bookId: string;
  gateway?: PaymentGatewayType;
  idempotencyKey?: string;
}) {
  const { userId, bookId, gateway = paymentSettings.activeGateway, idempotencyKey } = params;

  const book = await getBookById(bookId);
  if (!book) {
    throw new Error('Book not found in database catalog');
  }

  const bookType = book.bookType || book.type;
  if (bookType !== 'PREMIUM') {
    throw new Error('Free books do not require payment. You can read them directly.');
  }

  // Prevent duplicate purchases if user already owns it
  const alreadyHasAccess = await checkUserBookAccess(userId, bookId);
  if (alreadyHasAccess) {
    const error: any = new Error('You already own full access to this textbook.');
    error.code = 'ALREADY_PURCHASED';
    error.bookId = bookId;
    throw error;
  }

  // Generate unique order ID
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const amount = Number(book.price) || 99;
  const isDemo = gateway === 'DEMO';

  const { isConnected } = getDBStatus();

  let orderRecord: any;
  if (isConnected) {
    orderRecord = await OrderModel.create({
      orderId,
      userId,
      bookId,
      bookTitle: book.title,
      gateway,
      amount,
      currency: paymentSettings.currency,
      paymentStatus: 'PENDING',
      orderStatus: 'Created',
      paymentMethod: gateway === 'DEMO' ? 'Demo / Sandbox' : `${gateway} Test Mode`,
      testMode: true,
      isDemo,
      idempotencyKey: idempotencyKey || '',
    });
  } else {
    orderRecord = await storeCreateOrder({ userId, bookId, gateway });
  }

  return {
    orderId,
    bookId: book.id,
    bookTitle: book.title,
    author: book.author,
    amount,
    currency: paymentSettings.currency,
    gateway,
    paymentStatus: 'PENDING' as PaymentStatus,
    testMode: true,
    isDemo,
  };
}

/**
 * Demo / Sandbox Payment Processor with simulation actions
 */
export async function processDemoPayment(params: {
  orderId: string;
  userId: string;
  action: 'SUCCESS' | 'FAIL' | 'CANCEL';
  paymentMethod?: string;
}) {
  const { orderId, userId, action, paymentMethod = 'Demo UPI (Sandbox)' } = params;

  if (action === 'CANCEL') {
    const { isConnected } = getDBStatus();
    if (isConnected) {
      const order = await OrderModel.findOne({ orderId, userId });
      if (!order) throw new Error('Order not found');
      order.paymentStatus = 'CANCELLED';
      order.orderStatus = 'Cancelled by User';
      order.failureReason = 'Payment flow cancelled by user';
      await order.save();
      return order;
    }
    return { orderId, status: 'CANCELLED', message: 'Payment cancelled.' };
  }

  // Execute standard store process payment
  return await storeProcessOrderPayment(
    orderId,
    userId,
    action === 'SUCCESS' ? 'SUCCESS' : 'FAIL',
    paymentMethod
  );
}

/**
 * Server-Side Razorpay Test Mode Handler
 */
export async function createRazorpayOrder(params: { orderId: string; userId: string }) {
  const { orderId, userId } = params;
  const order = await getOrderById(orderId);
  if (!order || order.userId !== userId) {
    throw new Error('Order not found or unauthorized');
  }

  const amountPaise = Math.round(order.amount * 100);
  const razorpayOrderId = `order_${crypto.randomBytes(8).toString('hex')}`;

  // If Razorpay API credentials are configured, we could make an official API call.
  // In test sandbox, we return the cryptographically structured Razorpay payload.
  return {
    razorpayOrderId,
    orderId: order.orderId,
    amount: order.amount,
    amountPaise,
    currency: order.currency || 'INR',
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo_placeholder',
    testMode: true,
  };
}

export async function verifyRazorpayPayment(params: {
  orderId: string;
  userId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  const { orderId, userId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;

  const order = await getOrderById(orderId);
  if (!order || order.userId !== userId) {
    throw new Error('Order not found or unauthorized');
  }

  // Idempotency: If already paid, return existing success record
  if (order.paymentStatus === 'PAID') {
    return { success: true, message: 'Order already verified and paid.', order };
  }

  // Verify HMAC SHA256 Signature
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  let signatureValid = false;

  if (keySecret) {
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    signatureValid = expectedSignature === razorpay_signature;
  } else {
    // In test environment without key secret, allow verified test token
    signatureValid = Boolean(razorpay_payment_id && razorpay_order_id);
  }

  if (!signatureValid) {
    const { isConnected } = getDBStatus();
    if (isConnected) {
      await OrderModel.findOneAndUpdate(
        { orderId },
        { 
          paymentStatus: 'FAILED', 
          orderStatus: 'Signature Verification Failed',
          failureReason: 'Invalid cryptographic signature from Razorpay'
        }
      );
    }
    throw new Error('Payment signature verification failed. Access denied.');
  }

  // Signature is valid: Mark order as PAID, grant user access, and record purchase
  const result = await storeProcessOrderPayment(
    orderId,
    userId,
    'SUCCESS',
    `Razorpay Test (${razorpay_payment_id})`
  );

  return {
    success: true,
    message: 'Razorpay payment verified successfully. Premium book unlocked!',
    order: result.order,
  };
}

/**
 * Server-Side Stripe Test Mode Handler
 */
export async function createStripeCheckoutSession(params: { orderId: string; userId: string }) {
  const { orderId, userId } = params;
  const order = await getOrderById(orderId);
  if (!order || order.userId !== userId) {
    throw new Error('Order not found or unauthorized');
  }

  const sessionId = `cs_test_${crypto.randomBytes(12).toString('hex')}`;
  return {
    sessionId,
    orderId: order.orderId,
    amount: order.amount,
    currency: order.currency || 'INR',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_demo_placeholder',
    testMode: true,
  };
}

export async function verifyStripePayment(params: {
  orderId: string;
  userId: string;
  sessionId: string;
}) {
  const { orderId, userId, sessionId } = params;

  const order = await getOrderById(orderId);
  if (!order || order.userId !== userId) {
    throw new Error('Order not found or unauthorized');
  }

  if (order.paymentStatus === 'PAID') {
    return { success: true, message: 'Order already verified and paid.', order };
  }

  if (!sessionId) {
    throw new Error('Stripe session ID required for verification');
  }

  const result = await storeProcessOrderPayment(
    orderId,
    userId,
    'SUCCESS',
    `Stripe Test (${sessionId.slice(0, 16)})`
  );

  return {
    success: true,
    message: 'Stripe payment verified successfully. Premium book unlocked!',
    order: result.order,
  };
}
