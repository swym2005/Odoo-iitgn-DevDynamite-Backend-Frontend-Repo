import mongoose from 'mongoose';
import { Roles } from '../utils/roles.js';

const hourlyRatesSchema = new mongoose.Schema(
  {
    role: { type: String, enum: [Roles.Admin, Roles.ProjectManager, Roles.TeamMember, Roles.Finance, Roles.Vendor], required: true },
    rate: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: 'FlowIQ' },
    logoUrl: { type: String },
    gstNumber: { type: String },
    address: { type: String },
    hourlyRates: { type: [hourlyRatesSchema], default: [] },
    currency: { type: String, default: 'USD' },
    taxRate: { type: Number, default: 0 },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  },
  { timestamps: true }
);

export const Settings = mongoose.model('Settings', settingsSchema);
