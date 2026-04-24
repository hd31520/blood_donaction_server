import mongoose from 'mongoose';

const visitSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
      maxlength: 120,
    },
    path: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
      index: true,
    },
    referrer: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    visitedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    visitDate: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

visitSchema.index({ visitDate: 1, path: 1 });
visitSchema.index({ sessionId: 1, visitDate: 1 });

export const Visit = mongoose.model('Visit', visitSchema);
