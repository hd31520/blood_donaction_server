import mongoose from 'mongoose';

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    divisionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Division',
      required: true,
      index: true,
    },
    districtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      required: true,
      index: true,
    },
    upazilaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Upazila',
      required: true,
      index: true,
    },
    areaType: {
      type: String,
      enum: ['union', 'pouroshava'],
      required: true,
    },
    unionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Union',
      index: true,
    },
    unionName: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    wardNumber: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 220,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    locationNames: {
      division: { type: String, trim: true, maxlength: 120 },
      district: { type: String, trim: true, maxlength: 120 },
      upazila: { type: String, trim: true, maxlength: 120 },
      union: { type: String, trim: true, maxlength: 120 },
      wardNumber: { type: String, trim: true, maxlength: 20 },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

hospitalSchema.index({ districtId: 1, upazilaId: 1, createdAt: -1 });

export const Hospital = mongoose.model('Hospital', hospitalSchema);
