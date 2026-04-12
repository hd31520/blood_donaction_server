import mongoose from 'mongoose';

const districtSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const District = mongoose.model('District', districtSchema);
