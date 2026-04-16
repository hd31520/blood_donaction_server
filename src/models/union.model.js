import mongoose from 'mongoose';

import { Upazila } from './upazila.model.js';

const unionSchema = new mongoose.Schema(
  {
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
      required: [true, 'upazilaId is required for every union'],
      index: true,
      immutable: true,
    },
    areaType: {
      type: String,
      enum: ['union', 'pouroshava'],
      default: 'union',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    bnName: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    code: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      maxlength: 20,
    },
    externalId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

unionSchema.index({ upazilaId: 1, areaType: 1, name: 1 }, { unique: true });

unionSchema.pre('validate', async function ensureUpazilaLink(next) {
  if (!this.upazilaId) {
    return next(new Error('upazilaId is required for every union'));
  }

  const upazilaExists = await Upazila.exists({ _id: this.upazilaId });
  if (!upazilaExists) {
    return next(new Error('upazilaId must reference an existing upazila'));
  }

  return next();
});

export const Union = mongoose.model('Union', unionSchema);
