import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPurchase extends Document {
  userId: string;
  bookId: string;
  orderId: string;
  amount: number;
  paymentMethod: string;
  status: 'Completed' | 'Pending';
  purchasedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseSchema = new Schema<IPurchase>(
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
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      default: 'UPI / Demo Student Checkout',
    },
    status: {
      type: String,
      enum: ['Completed', 'Pending'],
      default: 'Completed',
    },
    purchasedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

PurchaseSchema.index({ userId: 1, bookId: 1 });

export const PurchaseModel: Model<IPurchase> =
  mongoose.models.Purchase || mongoose.model<IPurchase>('Purchase', PurchaseSchema);
