import React from 'react';
import { 
  Code2, 
  Binary, 
  Globe, 
  Database, 
  Bot, 
  BrainCircuit, 
  ShieldCheck, 
  Network, 
  LineChart, 
  Sigma, 
  GitBranch, 
  Boxes,
  ArrowRight,
  BookOpen
} from 'lucide-react';
import { Category } from '../types';
import { useApp } from '../context/AppContext';

interface CategoryCardProps {
  category: Category;
  compact?: boolean;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category, compact = false }) => {
  const { navigateTo, setSelectedCategory } = useApp();

  const getIcon = () => {
    const props = { className: compact ? 'w-5 h-5' : 'w-6 h-6 text-indigo-600 dark:text-indigo-400' };
    switch (category.icon) {
      case 'Code2':
        return <Code2 {...props} />;
      case 'Binary':
        return <Binary {...props} />;
      case 'Globe':
        return <Globe {...props} />;
      case 'Database':
        return <Database {...props} />;
      case 'Bot':
        return <Bot {...props} />;
      case 'BrainCircuit':
        return <BrainCircuit {...props} />;
      case 'ShieldCheck':
        return <ShieldCheck {...props} />;
      case 'Network':
        return <Network {...props} />;
      case 'LineChart':
        return <LineChart {...props} />;
      case 'Sigma':
        return <Sigma {...props} />;
      case 'GitBranch':
        return <GitBranch {...props} />;
      case 'Boxes':
        return <Boxes {...props} />;
      default:
        return <BookOpen {...props} />;
    }
  };

  const handleClick = () => {
    setSelectedCategory(category.name);
    navigateTo('category-detail', { categorySlug: category.slug });
  };

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-xs transition-all text-left cursor-pointer group"
      >
        <div className="p-2 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
          {getIcon()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
            {category.name}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
            {category.bookCount} books
          </p>
        </div>
      </button>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="group relative flex flex-col justify-between p-5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg transition-all duration-200 cursor-pointer"
    >
      <div>
        <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
          <div className="group-hover:text-white transition-colors">
            {getIcon()}
          </div>
        </div>

        <h3 className="font-semibold text-slate-900 dark:text-white text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {category.name}
        </h3>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
          {category.description}
        </p>
      </div>

      <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 tabular-nums">
          {category.bookCount} e-books
        </span>

        <span className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
          <span>Explore</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </span>
      </div>
    </div>
  );
};
