import mongoose from 'mongoose';

const districtSchema = new mongoose.Schema(
  {
    divisionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Division',
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

districtSchema.index({ divisionId: 1, name: 1 }, { unique: true });

export const District = mongoose.model('District', districtSchema);
