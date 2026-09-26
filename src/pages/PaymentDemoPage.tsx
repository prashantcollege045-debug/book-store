import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  CreditCard, 
  Smartphone, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  Lock, 
  ShoppingCart,
  BookOpen
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BookCover } from '../components/BookCover';
import { OrderService } from '../services/api';

export const PaymentDemoPage: React.FC = () => {
  const { 
    selectedBookId, 
    allBooks, 
    currentUser, 
    navigateTo, 
    showToast, 
    openReader,
    addPurchasedBook
  } = useApp();

  const [order, setOrder] = useState<any>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState<boolean>(true);
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'PAID' | 'FAILED'>('IDLE');
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const book = allBooks.find(b => b.id === selectedBookId) || null;

  useEffect(() => {
    if (!currentUser) {
      showToast('Please sign in to proceed with checkout.', 'info');
      navigateTo('login');
      return;
    }

    if (!selectedBookId || !book) {
      navigateTo('books');
      return;
    }

    // Step 1: Create Order on backend
    let isMounted = true;
    setIsCreatingOrder(true);
    setErrorMsg(null);

    OrderService.createOrder(selectedBookId)
      .then(res => {
        if (!isMounted) return;
        setOrder(res.data);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        if (err.data?.code === 'ALREADY_PURCHASED' || err.message?.includes('Already purchased')) {
          showToast('You already own this book! Opening reader...', 'info');
          openReader(book);
        } else {
          setErrorMsg(err.message || 'Failed to create order');
        }
      })
      .finally(() => {
        if (isMounted) setIsCreatingOrder(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedBookId, currentUser]);

  // Handler for Payment Decision: SUCCESS vs FAIL
  const handleExecutePayment = async (action: 'SUCCESS' | 'FAIL') => {
    if (!order?.orderId) return;

    setIsPaying(true);
    setErrorMsg(null);

    try {
      const methodLabel = selectedMethod === 'upi' ? 'Test UPI (GPay/PhonePe)' : selectedMethod === 'card' ? 'Test RuPay Card' : 'Test NetBanking';
      const res = await OrderService.payOrder(order.orderId, action, methodLabel);

      if (action === 'SUCCESS') {
        setPaymentStatus('PAID');
        setOrder(res.data);
        if (book) {
          addPurchasedBook(book);
        }
        showToast('Payment verified successfully! Access granted.', 'success');
      } else {
        setPaymentStatus('FAILED');
        setOrder(res.data);
        showToast('Test payment simulation rejected/failed.', 'warning');
      }
    } catch (err: any) {
      if (action === 'FAIL') {
        setPaymentStatus('FAILED');
      } else {
        setErrorMsg(err.message || 'Payment execution failed');
      }
    } finally {
      setIsPaying(false);
    }
  };

  if (!book) return null;

  // ==========================================
  // VIEW: PAYMENT SUCCESS
  // ==========================================
  if (paymentStatus === 'PAID') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <span className="text-xs uppercase font-mono tracking-widest text-emerald-600 font-bold">
              Transaction Approved · Sandbox Test Mode
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 dark:text-white">
              Purchase Successful!
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              You now have unlimited open access to <strong>"{book.title}"</strong>. It has been added to your Student Library.
            </p>
          </div>

          {/* Receipt Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-left text-xs space-y-2">
            <div className="flex justify-between text-slate-500">
              <span>Order Reference:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{order?.orderId}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Payment Reference:</span>
              <span className="font-mono text-emerald-600 font-medium">{order?.paymentReference || 'TXN-DEMO-VERIFIED'}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Book Title:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{book.title}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-slate-900 dark:text-white text-sm">
              <span>Amount Paid:</span>
              <span className="font-mono text-emerald-600">₹{book.price}.00</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => openReader(book)}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 transition-all"
            >
              <BookOpen className="w-4 h-4" />
              <span>Read Now</span>
            </button>

            <button
              type="button"
              onClick={() => navigateTo('library')}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
            >
              Go to My Library
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: PAYMENT FAILED
  // ==========================================
  if (paymentStatus === 'FAILED') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 border border-rose-200 dark:border-rose-900/60 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <XCircle className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <span className="text-xs uppercase font-mono tracking-widest text-rose-600 font-bold">
              Transaction Declined · Sandbox Mode
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 dark:text-white">
              Payment Failed
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Your test payment could not be processed or was simulated as declined. No charge has occurred and access was not granted.
            </p>
          </div>

          {/* Error Notice */}
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-left text-xs space-y-1.5 text-rose-900 dark:text-rose-200">
            <div className="flex justify-between">
              <span className="font-semibold">Order ID:</span>
              <span className="font-mono">{order?.orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Reason:</span>
              <span>{order?.failureReason || 'Declined during sandbox testing'}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => setPaymentStatus('IDLE')}
              className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
            >
              <span>Try Again</span>
            </button>

            <button
              type="button"
              onClick={() => navigateTo('book-detail', { bookId: book.id })}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
            >
              Back to Book
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: CHECKOUT & PAYMENT DEMO SCREEN
  // ==========================================
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Back Button */}
      <div>
        <button
          type="button"
          onClick={() => navigateTo('book-detail', { bookId: book.id })}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Book Details</span>
        </button>
      </div>

      {/* Demo Warning Banner */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <p className="font-bold uppercase tracking-wider text-[11px] text-amber-700 dark:text-amber-300">
            DEMO / TEST PAYMENT SANDBOX (College Project)
          </p>
          <p className="leading-relaxed opacity-90">
            This is a mock sandbox payment simulator. No real money or payment credentials are required. Select a demonstration payment method below and test both <strong>Successful</strong> and <strong>Failed</strong> purchase verification flows.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Book & Order Summary */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-indigo-600" />
            <span>Order Summary</span>
          </h2>

          <div className="flex gap-4">
            <div className="w-20 shrink-0 rounded-lg overflow-hidden shadow-md">
              <BookCover book={book} size="sm" showSpine={false} />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded">
                PREMIUM EDITION
              </span>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                {book.title}
              </h3>
              <p className="text-xs text-slate-500">by {book.author}</p>
              <p className="text-[11px] text-slate-400">{book.pages} Pages · Year {book.publicationYear}</p>
            </div>
          </div>

          {/* Order Details */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Order ID:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {isCreatingOrder ? 'Generating...' : order?.orderId}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Customer:</span>
              <span>{currentUser?.name || 'Student Customer'}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Currency:</span>
              <span>INR (₹)</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-sm text-slate-900 dark:text-white">
              <span>Total Price:</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">₹{book.price}.00</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>Server-side price verification · Never trusted from frontend</span>
          </div>
        </div>

        {/* Right: Sandbox Payment Screen */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Payment Gateway Simulation</span>
            </h2>
            <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded">
              SANDBOX TEST
            </span>
          </div>

          {/* Test Payment Methods */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Select Demonstration Channel
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedMethod('upi')}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  selectedMethod === 'upi'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Smartphone className="w-5 h-5" />
                <span className="text-xs font-semibold">Test UPI</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('card')}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  selectedMethod === 'card'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-xs font-semibold">Test Card</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('netbanking')}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  selectedMethod === 'netbanking'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Building2 className="w-5 h-5" />
                <span className="text-xs font-semibold">Net Banking</span>
              </button>
            </div>
          </div>

          {/* Mock Input Preview (Safe - Never stores sensitive data) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-3 text-xs">
            {selectedMethod === 'upi' && (
              <div>
                <label className="block text-slate-500 mb-1">Simulated VPA / UPI ID</label>
                <input
                  type="text"
                  readOnly
                  value={`${currentUser?.email.split('@')[0] || 'student'}@okhdfcbank`}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300"
                />
              </div>
            )}

            {selectedMethod === 'card' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-slate-500 mb-1">Demo Card Number</label>
                  <input
                    type="text"
                    readOnly
                    value="4242 •••• •••• 4242 (Test Card)"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-500 mb-1">Expiry</label>
                    <input
                      type="text"
                      readOnly
                      value="12/28"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">CVV</label>
                    <input
                      type="text"
                      readOnly
                      value="•••"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedMethod === 'netbanking' && (
              <div>
                <label className="block text-slate-500 mb-1">Selected Institution</label>
                <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200">
                  State Bank of India (Simulated Sandbox)
                </div>
              </div>
            )}
          </div>

          {/* Action Trigger Buttons for Testing Requirement 5 & 6 */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => handleExecutePayment('SUCCESS')}
              disabled={isPaying || isCreatingOrder}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all"
            >
              {isPaying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Payment...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simulate SUCCESSFUL Payment (₹{book.price})</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleExecutePayment('FAIL')}
              disabled={isPaying || isCreatingOrder}
              className="w-full py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>Simulate FAILED Payment (Test Rejection)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
