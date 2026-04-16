import mongoose from 'mongoose';

const bloodNeedSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    patientAge: {
      type: Number,
      required: true,
      min: 0,
      max: 150,
    },
    bloodGroup: {
      type: String,
      required: true,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      index: true,
    },
    unitsRequired: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: false,
    },
    hospitalName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    location: {
      division: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Division',
        required: true,
        index: true,
      },
      district: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'District',
        required: true,
        index: true,
      },
      upazila: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Upazila',
        required: true,
        index: true,
      },
      union: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Union',
        required: false,
      },
      area: {
        type: String,
        trim: true,
        maxlength: 100,
      },
    },
    urgencyLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'fulfilled', 'cancelled'],
      default: 'pending',
      index: true,
    },
    needsRegularBlood: {
      type: Boolean,
      default: false,
      index: true,
    },
    medicalCondition: {
      type: String,
      enum: ['none', 'thalassemia', 'other_regular'],
      default: 'none',
      index: true,
    },
    autoDeleteAt: {
      type: Date,
      default: null,
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    contactPerson: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    requiredDate: {
      type: Date,
      required: true,
    },
    unitsReceived: {
      type: Number,
      default: 0,
      min: 0,
    },
    donors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      { bloodGroup: 1, status: 1 },
      { 'location.upazila': 1, status: 1 },
      { urgencyLevel: 1, status: 1 },
      { createdAt: -1 },
    ],
  },
);

bloodNeedSchema.index({ autoDeleteAt: 1 }, { expireAfterSeconds: 0 });

export const BloodNeed = mongoose.model('BloodNeed', bloodNeedSchema);
