import mongoose from 'mongoose';

const upazilaSchema = new mongoose.Schema(
  {
    districtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
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
      sparse: true,
      maxlength: 20,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

upazilaSchema.index({ districtId: 1, name: 1 }, { unique: true });

export const Upazila = mongoose.model('Upazila', upazilaSchema);
