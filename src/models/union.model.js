import mongoose from 'mongoose';

const unionSchema = new mongoose.Schema(
  {
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

unionSchema.index({ upazilaId: 1, name: 1 }, { unique: true });

export const Union = mongoose.model('Union', unionSchema);
