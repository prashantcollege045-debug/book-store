import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  Bookmark, 
  Receipt, 
  Clock, 
  ArrowRight, 
  GraduationCap, 
  TrendingUp,
  FileText
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BOOKS_DATA } from '../data/booksData';
import { BookCover } from '../components/BookCover';
import { Badge } from '../components/Badge';
import { OrderService } from '../services/api';
import { OrderItem } from '../types';

export const LibraryPage: React.FC = () => {
  const { 
    libraryItems, 
    purchaseHistory, 
    currentUser, 
    openReader, 
    navigateTo,
    allBooks,
    wishlistIds
  } = useApp();

  const [activeTab, setActiveTab] = useState<'purchased' | 'reading' | 'saved' | 'completed' | 'bookmarks' | 'orders'>('purchased');
  const [serverOrders, setServerOrders] = useState<OrderItem[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser) {
      setIsLoadingOrders(true);
      OrderService.getMyOrders()
        .then(orders => {
          setServerOrders(orders || []);
        })
        .finally(() => {
          setIsLoadingOrders(false);
        });
    }
  }, [currentUser]);

  const readingItems = libraryItems.filter(item => item.status === 'reading');
  const completedItems = libraryItems.filter(item => item.status === 'completed');
  const bookmarkedItems = libraryItems.filter(item => item.status === 'bookmarked');

  // Purchased books: Combine server-verified paid orders and local purchase records
  const paidOrderBookIds = new Set([
    ...serverOrders.filter(o => o.paymentStatus === 'PAID').map(o => o.bookId),
    ...purchaseHistory.map(p => p.bookId)
  ]);
  const purchasedBooks = allBooks.filter(b => paidOrderBookIds.has(b.id));

  // Free/Saved books
  const savedBooks = allBooks.filter(b => wishlistIds.includes(b.id) || b.type === 'FREE').slice(0, 8);

  const getBook = (bookId: string) => allBooks.find(b => b.id === bookId) || BOOKS_DATA.find(b => b.id === bookId) || BOOKS_DATA[0];

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center mx-auto">
          <BookOpen className="w-7 h-7" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">
          Sign In Required
        </h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Please sign in to access your personal reading library, bookmarks, and academic study progress.
        </p>
        <button
          type="button"
          onClick={() => navigateTo('login')}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md"
        >
          Sign In to Student Account
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Student Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl font-bold font-serif">
            {currentUser ? currentUser.name.charAt(0) : 'S'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono tracking-wider text-indigo-300">
                Student Portal
              </span>
              <span className="text-white/40">•</span>
              <span className="text-xs text-white/70">
                {currentUser?.studentId || 'CS-2024-045'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {currentUser ? currentUser.name : 'Student Scholar'}
            </h1>
            <p className="text-xs text-indigo-200 mt-0.5">
              {currentUser?.college || 'Department of Computer Science & Engineering'}
            </p>
          </div>
        </div>

        {/* Quick Reading Stats */}
        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-white/15 pt-4 md:pt-0 md:pl-6 text-center">
          <div>
            <span className="text-2xl font-bold tabular-nums text-white">
              {libraryItems.length}
            </span>
            <p className="text-[11px] text-white/60">Library Books</p>
          </div>
          <div>
            <span className="text-2xl font-bold tabular-nums text-emerald-400">
              {completedItems.length}
            </span>
            <p className="text-[11px] text-white/60">Completed</p>
          </div>
          <div>
            <span className="text-2xl font-bold tabular-nums text-amber-400">
              {purchaseHistory.length}
            </span>
            <p className="text-[11px] text-white/60">Purchased</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 sm:gap-6 overflow-x-auto pb-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('purchased')}
          className={`pb-3 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'purchased'
              ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Purchased Books ({purchasedBooks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reading')}
          className={`pb-3 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'reading'
              ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Currently Reading ({readingItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('saved')}
          className={`pb-3 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'saved'
              ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-600" />
          <span>Free & Saved Books ({savedBooks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`pb-3 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'completed'
              ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Completed ({completedItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bookmarks')}
          className={`pb-3 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'bookmarks'
              ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          <span>Bookmarks & Notes ({bookmarkedItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => navigateTo('purchase-history')}
          className="pb-3 whitespace-nowrap text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 cursor-pointer ml-auto text-xs"
        >
          <span>Purchase History & Invoices</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab: Purchased Books (Requirement 8) */}
      {activeTab === 'purchased' && (
        <div className="space-y-4">
          {purchasedBooks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {purchasedBooks.map(b => (
                <div
                  key={b.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-4">
                    <div 
                      onClick={() => navigateTo('book-detail', { bookId: b.id })}
                      className="w-16 sm:w-20 shrink-0 cursor-pointer rounded-lg overflow-hidden shadow-xs"
                    >
                      <BookCover book={b} size="sm" showSpine={false} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded">
                        PURCHASED
                      </span>
                      <h3
                        onClick={() => navigateTo('book-detail', { bookId: b.id })}
                        className="text-sm font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-600"
                      >
                        {b.title}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">by {b.author}</p>
                      <p className="text-[11px] text-slate-400">{b.pages} Pages · ₹{b.price}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => openReader(b)}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Read Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateTo('book-detail', { bookId: b.id })}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium cursor-pointer"
                    >
                      Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
              <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">No purchased books yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When you purchase premium editions, they will appear here with instant browser reading access.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigateTo('premium-books')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Browse Premium Volumes
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Free & Saved Books */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {savedBooks.map(b => (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3"
              >
                <div 
                  onClick={() => navigateTo('book-detail', { bookId: b.id })}
                  className="cursor-pointer flex justify-center py-2"
                >
                  <BookCover book={b} size="sm" showSpine={false} />
                </div>
                <div>
                  <h4 className="text-xs font-bold truncate text-slate-900 dark:text-white">{b.title}</h4>
                  <p className="text-[11px] text-slate-500 truncate">{b.author}</p>
                </div>
                <button
                  type="button"
                  onClick={() => openReader(b)}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Read Free</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 1: Currently Reading */}
      {activeTab === 'reading' && (
        <div className="space-y-4">
          {readingItems.length > 0 ? (
            readingItems.map(item => {
              const book = getBook(item.bookId);
              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center gap-6"
                >
                  <div
                    onClick={() => navigateTo('book-detail', { bookId: book.id })}
                    className="w-20 sm:w-24 shrink-0 cursor-pointer"
                  >
                    <BookCover book={book} size="sm" showSpine={false} />
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        {book.category}
                      </span>
                      <Badge type={book.type} />
                    </div>

                    <h3
                      onClick={() => navigateTo('book-detail', { bookId: book.id })}
                      className="text-base font-bold text-slate-900 dark:text-white hover:text-indigo-600 transition-colors cursor-pointer truncate"
                    >
                      {book.title}
                    </h3>

                    <p className="text-xs text-slate-500">by {book.author}</p>

                    {/* Progress Bar */}
                    <div className="max-w-md space-y-1">
                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span>Progress: {item.progress}%</span>
                        <span>Page {item.currentPage} of {book.pages}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Last read: {item.lastRead}</span>
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => openReader(book, item.currentPage)}
                      className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Continue Reading</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-500">
              No active books currently being read. Browse books to start reading!
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Completed */}
      {activeTab === 'completed' && (
        <div className="space-y-4">
          {completedItems.length > 0 ? (
            completedItems.map(item => {
              const book = getBook(item.bookId);
              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center gap-6"
                >
                  <div
                    onClick={() => navigateTo('book-detail', { bookId: book.id })}
                    className="w-20 shrink-0 cursor-pointer"
                  >
                    <BookCover book={book} size="sm" showSpine={false} />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        100% Completed
                      </span>
                      <span className="text-xs text-slate-400">• Completed on {item.lastRead}</span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                      {book.title}
                    </h3>
                    <p className="text-xs text-slate-500">by {book.author} · {book.pages} pages</p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openReader(book)}
                      className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      Read Again
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-500">
              No completed books yet.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Bookmarks & Notes */}
      {activeTab === 'bookmarks' && (
        <div className="space-y-4">
          {bookmarkedItems.length > 0 ? (
            bookmarkedItems.map(item => {
              const book = getBook(item.bookId);
              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-indigo-600 fill-indigo-600" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {book.title}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">Page {item.currentPage}</span>
                  </div>

                  {item.note && (
                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border-l-4 border-amber-500 rounded-r-lg text-xs text-amber-900 dark:text-amber-200 italic">
                      "{item.note}"
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => openReader(book)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Open in Reader
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-500">
              No bookmarks saved yet. Use the reader view to bookmark pages.
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Purchase History */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Book Title</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {purchaseHistory.map(rec => {
                  const book = getBook(rec.bookId);
                  return (
                    <tr key={rec.orderId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono font-medium">{rec.orderId}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white max-w-xs truncate">
                        {book.title}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{rec.date}</td>
                      <td className="px-4 py-3 text-slate-500">{rec.paymentMethod}</td>
                      <td className="px-4 py-3 font-bold tabular-nums text-slate-900 dark:text-white">
                        ₹{rec.amount}.00
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {rec.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openReader(book)}
                          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Read E-Book
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400 italic">
            * Transactions in Phase 1 are demonstrated locally with simulated records.
          </p>
        </div>
      )}
    </div>
  );
};
