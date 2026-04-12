import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    bloodGroup: {
      type: String,
      required: true,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    },
    location: {
      type: String,
      trim: true,
      maxlength: 180,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },
  },
  {
    timestamps: true,
  },
);

export const User = mongoose.model('User', userSchema);
