import React from 'react';
import { 
  BookOpen, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  Compass, 
  Star, 
  Flame,
  Award,
  BookMarked
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BOOKS_DATA } from '../data/booksData';
import { CATEGORIES_DATA } from '../data/categoriesData';
import { BookCard } from '../components/BookCard';
import { CategoryCard } from '../components/CategoryCard';
import { SearchBar } from '../components/SearchBar';
import { BookCover } from '../components/BookCover';
import { BookService } from '../services/api';

export const HomePage: React.FC = () => {
  const { navigateTo, setSelectedType, currentUser, libraryItems, openReader } = useApp();

  const [continueReadingList, setContinueReadingList] = React.useState<any[]>([]);

  // Fetch continue reading list from server
  React.useEffect(() => {
    if (currentUser) {
      BookService.getContinueReading().then(data => {
        if (data && data.length > 0) {
          setContinueReadingList(data);
        } else {
          // fallback to local reading items with progress
          const inProgress = libraryItems
            .filter(item => item.progress > 0 && item.progress < 100)
            .map(item => {
              const book = BOOKS_DATA.find(b => b.id === item.bookId);
              return {
                ...item,
                percentage: item.progress,
                book,
              };
            })
            .filter(i => i.book);
          setContinueReadingList(inProgress);
        }
      });
    } else {
      setContinueReadingList([]);
    }
  }, [currentUser, libraryItems]);

  // Filter sections as required by prompt
  const featuredBooks = BOOKS_DATA.filter(b => b.featured).slice(0, 8);
  const freeBooks = BOOKS_DATA.filter(b => b.type === 'FREE').slice(0, 4);
  const premiumBooks = BOOKS_DATA.filter(b => b.type === 'PREMIUM').slice(0, 4);
  const popularBooks = [...BOOKS_DATA]
    .sort((a, b) => (b.views + b.downloads) - (a.views + a.downloads))
    .slice(0, 4);
  const recentBooks = [...BOOKS_DATA]
    .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
    .slice(0, 6);

  const heroHeroBook = BOOKS_DATA[0]; // Data Structures
  const heroSecondaryBook = BOOKS_DATA[4]; // Deep Learning
  const heroThirdBook = BOOKS_DATA[1]; // React

  return (
    <div className="space-y-16 sm:space-y-20 pb-16">
      {/* ==================================================
          SECTION 1 — HERO
          ================================================== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/50 via-white to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Hero Text */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100/80 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/80 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>B.Sc. Computer Science Digital Library Portal</span>
              </div>

              <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-950 dark:text-white leading-[1.15] text-balance">
                Discover Your Next Great Book
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Explore free and premium e-books in one simple digital bookstore. Built for computer science students, researchers, and tech enthusiasts.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigateTo('books')}
                  className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl text-sm shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Compass className="w-4 h-4" />
                  <span>Browse Books</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedType('FREE');
                    navigateTo('books');
                  }}
                  className="w-full sm:w-auto px-6 py-3.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold rounded-xl text-sm border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Explore Free Books</span>
                </button>
              </div>

              {/* Quick Trust Badges */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Free Open-Access Textbooks
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Instant Browser Reader
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Zero Subscriptions
                </span>
              </div>
            </div>

            {/* Right Hero Visual: Multi-Layered Original Book Presentation */}
            <div className="lg:col-span-5 flex justify-center items-center relative">
              <div className="relative w-full max-w-[340px] sm:max-w-[420px] flex justify-center items-center py-6">
                {/* Ambient Glow */}
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl -z-10" />

                {/* Layer 1: Left Background Book */}
                <div className="hidden sm:block absolute -left-4 top-8 -rotate-12 scale-85 opacity-70 hover:opacity-100 hover:z-20 transition-all duration-300">
                  <BookCover book={heroSecondaryBook} size="sm" />
                </div>

                {/* Layer 2: Right Background Book */}
                <div className="hidden sm:block absolute -right-4 top-12 rotate-12 scale-85 opacity-70 hover:opacity-100 hover:z-20 transition-all duration-300">
                  <BookCover book={heroThirdBook} size="sm" />
                </div>

                {/* Layer 3: Main Foreground Hero Book */}
                <div className="relative z-10 scale-100 sm:scale-105 shadow-2xl transition-transform duration-300 hover:scale-110">
                  <BookCover book={heroHeroBook} size="hero" />
                </div>

                {/* Floating Metric Badge */}
                <div className="absolute -bottom-4 right-2 sm:right-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-lg z-20 flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-lg">
                    <BookMarked className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      15+ CS Volumes
                    </p>
                    <p className="text-[10px] text-slate-500">Free & Premium Access</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          PHASE 5 SECTION 5: CONTINUE READING SHELF
          ================================================== */}
      {currentUser && continueReadingList.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900/10 via-purple-900/5 to-slate-900/10 border border-indigo-200 dark:border-indigo-900/50 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  Continue Reading
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigateTo('library')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View Library</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {continueReadingList.slice(0, 3).map((item, idx) => {
                const b = item.book;
                if (!b) return null;
                const pct = item.percentage ?? Math.round(((item.currentPage || 1) / (b.pages || 100)) * 100);

                return (
                  <div
                    key={item.bookId || idx}
                    className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5 hover:shadow-md transition-shadow"
                  >
                    <div className="w-12 h-16 shrink-0 rounded overflow-hidden shadow-xs border border-slate-100 dark:border-slate-800">
                      <BookCover book={b} size="sm" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold truncate text-slate-900 dark:text-white">
                        {b.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate">
                        {b.author}
                      </p>

                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>{pct}% completed</span>
                          <span>Page {item.currentPage || 1}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openReader(b, item.currentPage)}
                        className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Continue Reading</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ==================================================
          SECTION 2 — SEARCH SECTION
          ================================================== */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Smart Catalog Search
          </h2>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
            Find textbooks, lecture companions, and technical guides
          </p>
        </div>
        <SearchBar size="large" placeholder="Search books, authors, categories (e.g. Algorithms, React, SQL)..." />
      </section>

      {/* ==================================================
          SECTION 3 — CATEGORIES
          ================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Layers className="w-4 h-4" />
              <span>Curated Disciplines</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Explore by Category
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              12 core computer science and engineering subjects tailored for college coursework.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigateTo('categories')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
          >
            <span>View All Categories</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 12 Categories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {CATEGORIES_DATA.map(category => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>

      {/* ==================================================
          SECTION 4 — FEATURED BOOKS (8 Demo Books Grid)
          ================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Award className="w-4 h-4" />
              <span>Recommended by Faculty</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Featured Books
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Hand-picked textbook companions and essential references for top grades.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigateTo('books')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Browse Full Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredBooks.map(book => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </section>

      {/* ==================================================
          SECTION 5 — FREE BOOKS SECTION
          ================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-6 sm:p-8 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Open-Access Initiative</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                Free Books
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
                Read directly in your browser with zero paywalls. Free textbooks supported by open educational resources.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedType('FREE');
                navigateTo('books');
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span>See All Free Books (₹0)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {freeBooks.map(book => (
              <BookCard key={book.id} book={book} actionVariant="free" />
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================
          SECTION 6 — PREMIUM BOOKS SECTION
          ================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-6 sm:p-8 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Professional Editions</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                Premium Books
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
                In-depth technical treatises, complete code repositories, and advanced industry architecture standards (Demo pricing: ₹49, ₹99, ₹149).
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedType('PREMIUM');
                navigateTo('books');
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span>See All Premium Books</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {premiumBooks.map(book => (
              <BookCard key={book.id} book={book} actionVariant="premium" />
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================
          SECTION 7 — POPULAR BOOKS (Highest Rating / Views / Downloads)
          ================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>Community Favorites & Top Ranked</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Popular Books
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Most read, highly rated, and frequently referenced volumes by university scholars and software engineers.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              navigateTo('books', { sortBy: 'popular' });
            }}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
          >
            <span>View All Popular Books</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {popularBooks.map(book => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </section>

      {/* ==================================================
          SECTION 8 — LATEST BOOKS (Recently Added Books)
          ================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>Just Added to Catalog</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Recently Added Books
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              The latest additions to the library with publication and upload timestamps.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigateTo('books')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Explore All Additions</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 6 Recently Added Cards with dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {recentBooks.map(book => (
            <BookCard key={book.id} book={book} showDate={true} />
          ))}
        </div>
      </section>

      {/* Student Project Note Callout Banner */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <span className="text-[11px] font-mono uppercase tracking-widest text-indigo-400 font-bold">
                B.Sc. CS Project Architecture · Phase 1
              </span>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
                Frontend UI & Data Flow Ready for Phase 2
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                All components use modular services, centralized sample data, responsive touch layouts, and working local state. Ready for Express.js backend, MongoDB schemas, and payment integrations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('library')}
              className="shrink-0 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-lg shadow-indigo-600/30"
            >
              Test Student Library
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
