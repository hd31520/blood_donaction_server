import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import { USER_ROLES } from '../config/access-control.js';

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
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.DONOR,
    },
    districtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      required: function districtRequired() {
        return this.role !== USER_ROLES.SUPER_ADMIN;
      },
      index: true,
    },
    upazilaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Upazila',
      index: true,
    },
    unionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Union',
      index: true,
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: true,
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
    versionKey: false,
  },
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.pre('validate', function enforceLocationHierarchy(next) {
  if (
    this.role === USER_ROLES.UPAZILA_ADMIN ||
    this.role === USER_ROLES.UNION_LEADER ||
    this.role === USER_ROLES.DONOR
  ) {
    if (!this.upazilaId) {
      return next(new Error('upazilaId is required for this role'));
    }
  }

  if (this.role === USER_ROLES.UNION_LEADER || this.role === USER_ROLES.DONOR) {
    if (!this.unionId) {
      return next(new Error('unionId is required for this role'));
    }
  }

  return next();
});

export const User = mongoose.model('User', userSchema);
