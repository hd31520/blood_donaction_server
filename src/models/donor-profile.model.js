import mongoose from 'mongoose';

const donationHistorySchema = new mongoose.Schema(
  {
    donationDate: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      trim: true,
      maxlength: 180,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    _id: false,
  },
);

const donorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    bloodGroup: {
      type: String,
      required: true,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    },
    lastDonationDate: {
      type: Date,
    },
    availabilityStatus: {
      type: String,
      enum: ['available', 'unavailable', 'temporarily_unavailable'],
      default: 'available',
      index: true,
    },
    donationHistory: {
      type: [donationHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Supports fast profile filtering/sorting in donor search flows.
donorProfileSchema.index({ availabilityStatus: 1, bloodGroup: 1, updatedAt: -1 });

export const DonorProfile = mongoose.model('DonorProfile', donorProfileSchema);
