import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // direct recipient
    audienceRole: { type: String }, // broadcast to role
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    type: { type: String, enum: ['task','expense','invoice','payment','system'], default: 'system', index: true },
    title: { type: String, required: true },
    message: { type: String },
    link: { type: String },
    meta: { type: Object },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ audienceRole: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
