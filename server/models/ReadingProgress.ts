import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReadingProgress extends Document {
  userId: string;
  bookId: string;
  currentPage: number;
  totalPages: number;
  percentage: number;
  lastReadAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReadingProgressSchema = new Schema<IReadingProgress>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    bookId: {
      type: String,
      required: true,
      index: true,
    },
    currentPage: {
      type: Number,
      required: true,
      default: 1,
    },
    totalPages: {
      type: Number,
      required: true,
      default: 1,
    },
    percentage: {
      type: Number,
      required: true,
      default: 0,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring a single progress record per user and book
ReadingProgressSchema.index({ userId: 1, bookId: 1 }, { unique: true });

export const ReadingProgressModel: Model<IReadingProgress> =
  mongoose.models.ReadingProgress ||
  mongoose.model<IReadingProgress>('ReadingProgress', ReadingProgressSchema);
