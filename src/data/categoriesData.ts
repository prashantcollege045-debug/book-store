import { Category } from '../types';
import { BOOKS_DATA } from './booksData';

export const CATEGORIES_BASE: Omit<Category, 'bookCount'>[] = [
  {
    id: 'cat-1',
    name: 'Programming',
    slug: 'programming',
    description: 'Master core languages like Python, C++, Java, Rust, and Go with clean design patterns and idiomatic code.',
    icon: 'Code2',
  },
  {
    id: 'cat-2',
    name: 'Computer Science',
    slug: 'computer-science',
    description: 'Foundations of algorithms, computation theory, compiler construction, and discrete structures.',
    icon: 'Binary',
  },
  {
    id: 'cat-3',
    name: 'Web Development',
    slug: 'web-development',
    description: 'Modern front-end, back-end, React, Node.js, Next.js, Web APIs, and progressive web apps.',
    icon: 'Globe',
  },
  {
    id: 'cat-4',
    name: 'Database',
    slug: 'database',
    description: 'Relational database systems, SQL, PostgreSQL, indexing, ACID transactions, and NoSQL architecture.',
    icon: 'Database',
  },
  {
    id: 'cat-5',
    name: 'Artificial Intelligence',
    slug: 'artificial-intelligence',
    description: 'State space search, knowledge graphs, reasoning systems, NLP, and intelligent agent architectures.',
    icon: 'Bot',
  },
  {
    id: 'cat-6',
    name: 'Machine Learning',
    slug: 'machine-learning',
    description: 'Supervised and unsupervised learning, deep neural networks, transformers, and model evaluation.',
    icon: 'BrainCircuit',
  },
  {
    id: 'cat-7',
    name: 'Cybersecurity',
    slug: 'cybersecurity',
    description: 'Network defenses, applied cryptography, ethical hacking, vulnerability assessments, and secure coding.',
    icon: 'ShieldCheck',
  },
  {
    id: 'cat-8',
    name: 'Networking',
    slug: 'networking',
    description: 'TCP/IP protocols, socket programming, distributed routing, software-defined networks, and cloud meshes.',
    icon: 'Network',
  },
  {
    id: 'cat-9',
    name: 'Data Science',
    slug: 'data-science',
    description: 'Statistical inference, exploratory analysis, pandas, data visualization, and Big Data processing pipelines.',
    icon: 'LineChart',
  },
  {
    id: 'cat-10',
    name: 'Software Engineering',
    slug: 'software-engineering',
    description: 'Agile architectures, clean code principles, CI/CD pipelines, system design, and testing methodologies.',
    icon: 'GitBranch',
  },
  {
    id: 'cat-11',
    name: 'Mathematics',
    slug: 'mathematics',
    description: 'Linear algebra, multivariate calculus, graph theory, probability, and numerical analysis for engineers.',
    icon: 'Sigma',
  },
  {
    id: 'cat-12',
    name: 'Other',
    slug: 'other',
    description: 'Tech ethics, IT project management, quantum computing foundations, and career guides for students.',
    icon: 'Boxes',
  },
];

// Dynamically compute book counts based on centralized BOOKS_DATA
export const CATEGORIES_DATA: Category[] = CATEGORIES_BASE.map(cat => {
  const count = BOOKS_DATA.filter(
    b => b.category.toLowerCase() === cat.name.toLowerCase()
  ).length;
  return {
    ...cat,
    bookCount: count,
  };
});
