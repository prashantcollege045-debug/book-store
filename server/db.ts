import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let isConnected = false;
let isFallbackMode = false;

export async function connectDB(): Promise<{ isConnected: boolean; isFallback: boolean }> {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookstore';

  try {
    mongoose.set('strictQuery', false);
    
    // Set a reasonable server selection timeout so we can gracefully fallback if no MongoDB daemon is active
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2500,
    });

    isConnected = true;
    isFallbackMode = false;
    console.log(`[MongoDB] Successfully connected to database: ${mongoose.connection.name}`);
    return { isConnected: true, isFallback: false };
  } catch (error: any) {
    console.warn(`[MongoDB Warning] Could not connect to remote MongoDB daemon at ${uri}.`);
    console.warn(`[MongoDB Notice] Activating resilient in-memory simulated store for Phase 3 so authentication, user registration, and admin authorization function seamlessly without interruption.`);
    
    isConnected = false;
    isFallbackMode = true;
    return { isConnected: false, isFallback: true };
  }
}

export function getDBStatus() {
  return {
    isConnected: mongoose.connection.readyState === 1,
    isFallbackMode,
    connectionState: mongoose.connection.readyState,
  };
}
