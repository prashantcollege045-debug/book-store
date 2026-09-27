import mongoose, { Schema, Document } from 'mongoose';

export type GatewayId = 'sandbox' | 'razorpay' | 'stripe';

export interface IGatewayConfig {
  id: GatewayId;
  name: string;
  enabled: boolean;
  mode: 'TEST' | 'LIVE';
  configured: boolean;
  description: string;
  supportedCurrencies?: string[];
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
}

export interface IGatewaySettings extends Document {
  activeGateway: GatewayId;
  gateways: Record<GatewayId, IGatewayConfig>;
  updatedAt: Date;
}

const GatewayConfigSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  enabled: { type: Boolean, default: false },
  mode: { type: String, enum: ['TEST', 'LIVE'], default: 'TEST' },
  configured: { type: Boolean, default: false },
  description: { type: String, default: '' },
  supportedCurrencies: { type: [String], default: ['INR'] },
  keyId: { type: String, default: '' },
  keySecret: { type: String, default: '' },
  webhookSecret: { type: String, default: '' },
}, { _id: false });

const GatewaySettingsSchema = new Schema<IGatewaySettings>({
  activeGateway: {
    type: String,
    enum: ['sandbox', 'razorpay', 'stripe'],
    default: 'sandbox',
  },
  gateways: {
    sandbox: { type: GatewayConfigSchema, required: true },
    razorpay: { type: GatewayConfigSchema, required: true },
    stripe: { type: GatewayConfigSchema, required: true },
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export const GatewaySettingsModel = mongoose.models.GatewaySettings || mongoose.model<IGatewaySettings>('GatewaySettings', GatewaySettingsSchema);
