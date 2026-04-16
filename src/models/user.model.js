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
    divisionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Division',
      required: function divisionRequired() {
        return this.role !== USER_ROLES.SUPER_ADMIN;
      },
      index: true,
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
    areaType: {
      type: String,
      enum: ['union', 'pouroshava'],
      index: true,
    },
    unionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Union',
      index: true,
    },
    wardNumber: {
      type: String,
      trim: true,
      maxlength: 20,
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
    profileImageUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    profileImageDeleteUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    locationNames: {
      division: {
        type: String,
        trim: true,
        maxlength: 120,
      },
      district: {
        type: String,
        trim: true,
        maxlength: 120,
      },
      upazila: {
        type: String,
        trim: true,
        maxlength: 120,
      },
      union: {
        type: String,
        trim: true,
        maxlength: 120,
      },
      wardNumber: {
        type: String,
        trim: true,
        maxlength: 20,
      },
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

// Accelerates donor filtering by location hierarchy.
userSchema.index(
  { role: 1, divisionId: 1, districtId: 1, upazilaId: 1, unionId: 1 },
  { partialFilterExpression: { role: USER_ROLES.DONOR } },
);
userSchema.index(
  { role: 1, districtId: 1, upazilaId: 1 },
  { partialFilterExpression: { role: USER_ROLES.DONOR } },
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
      this.role === USER_ROLES.DONOR ||
      this.role === USER_ROLES.FINDER
    ) {
    if (!this.upazilaId) {
      return next(new Error('upazilaId is required for this role'));
    }
  }

    if (this.role === USER_ROLES.UNION_LEADER || this.role === USER_ROLES.DONOR || this.role === USER_ROLES.FINDER) {
    if (!this.areaType) {
      return next(new Error('areaType is required for this role'));
    }

    if (!this.unionId && !this.locationNames?.union) {
      return next(new Error('unionId or unionName is required for this role'));
    }

    if (this.areaType === 'pouroshava' && !this.wardNumber) {
      return next(new Error('wardNumber is required for pouroshava locations'));
    }
  }

  return next();
});

export const User = mongoose.model('User', userSchema);
