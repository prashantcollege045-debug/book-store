import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWishlist extends Document {
  userId: string;
  bookIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const WishlistSchema = new Schema<IWishlist>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    bookIds: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const WishlistModel: Model<IWishlist> =
  mongoose.models.Wishlist || mongoose.model<IWishlist>('Wishlist', WishlistSchema);
