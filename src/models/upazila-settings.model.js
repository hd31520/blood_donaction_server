import mongoose from 'mongoose';

const upazilaSettingsSchema = new mongoose.Schema(
  {
    upazilaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Upazila',
      required: true,
      unique: true,
      index: true,
    },
    districtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      required: true,
      index: true,
    },
    imgbbApiKey: {
      type: String,
      trim: true,
      required: true,
      maxlength: 300,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const UpazilaSettings = mongoose.model('UpazilaSettings', upazilaSettingsSchema);
