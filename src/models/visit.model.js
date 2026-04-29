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
    location: {
      division: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Division',
        index: true,
      },
      district: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'District',
        index: true,
      },
      upazila: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Upazila',
        index: true,
      },
      union: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Union',
        index: true,
      },
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
visitSchema.index({ 'location.district': 1, 'location.upazila': 1, 'location.union': 1, path: 1 });

export const Visit = mongoose.model('Visit', visitSchema);
