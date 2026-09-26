import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBook extends Document {
  title: string;
  author: string;
  description: string;
  category: string;
  language: string;
  coverUrl: string;
  fileUrl: string;
  fileType: string;
  fileSize: string;
  pages: number;
  publisher: string;
  publicationYear: number;
  isbn: string;
  tags: string[];
  bookType: 'FREE' | 'PREMIUM';
  price: number;
  downloadAllowed: boolean;
  licenseType: string;
  sourceUrl: string;
  views: number;
  downloads: number;
  rating: number;
  featured: boolean;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}

const BookSchema = new Schema<IBook>(
  {
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true,
      index: true,
    },
    author: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Book description is required'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      index: true,
    },
    language: {
      type: String,
      default: 'English',
    },
    coverUrl: {
      type: String,
      default: '/covers/default.png',
    },
    fileUrl: {
      type: String,
      default: '', // Placeholders for later phases (file upload)
    },
    fileType: {
      type: String,
      default: 'PDF',
    },
    fileSize: {
      type: String,
      default: '12.4 MB',
    },
    pages: {
      type: Number,
      default: 350,
    },
    publisher: {
      type: String,
      default: 'Academic Press',
    },
    publicationYear: {
      type: Number,
      default: new Date().getFullYear(),
    },
    isbn: {
      type: String,
      default: '978-0-12-345678-9',
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    bookType: {
      type: String,
      enum: ['FREE', 'PREMIUM'],
      default: 'FREE',
      index: true,
    },
    price: {
      type: Number,
      default: 0,
      min: [0, 'Price cannot be negative'],
    },
    downloadAllowed: {
      type: Boolean,
      default: true,
    },
    licenseType: {
      type: String,
      default: 'Creative Commons / Educational Open Access',
    },
    sourceUrl: {
      type: String,
      default: '',
    },
    views: {
      type: Number,
      default: 0,
    },
    downloads: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 0,
      max: 5,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'DRAFT', 'ARCHIVED'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: ensure price is 0 for FREE books
BookSchema.pre('save', function () {
  if (this.bookType === 'FREE') {
    this.price = 0;
  }
});

export const BookModel: Model<IBook> = mongoose.models.Book || mongoose.model<IBook>('Book', BookSchema);
