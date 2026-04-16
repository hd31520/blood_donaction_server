import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { authService } from '../services/auth.service.js';
import { asyncHandler } from '../shared/utils/async-handler.js';

const optionalTrimmedString = (maxLength, minLength = 0) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmedValue = value.trim();
      return trimmedValue.length === 0 ? undefined : trimmedValue;
    },
    minLength > 0
      ? z.string().min(minLength).max(maxLength).optional()
      : z.string().max(maxLength).optional(),
  );

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(64),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  role: z.enum(['donor', 'finder']).optional(),
  divisionId: z.string().min(1),
  districtId: z.string().min(1),
  upazilaId: z.string().min(1),
  areaType: z.enum(['union', 'pouroshava']),
  unionId: optionalTrimmedString(120, 1),
  unionName: optionalTrimmedString(120, 2),
  wardNumber: optionalTrimmedString(20, 1),
  location: optionalTrimmedString(180),
  phone: optionalTrimmedString(30),
}).refine((value) => value.unionId || value.unionName, {
  message: 'unionId or unionName is required',
  path: ['unionName'],
}).refine((value) => value.areaType !== 'pouroshava' || value.wardNumber, {
  message: 'wardNumber is required for pouroshava locations',
  path: ['wardNumber'],
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: optionalTrimmedString(30),
  location: optionalTrimmedString(180),
});

const uploadProfileImageSchema = z.object({
  imageDataUrl: z.string().min(20),
  imgbbApiKey: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
});

export const register = asyncHandler(async (req, res) => {
  const payload = registerSchema.parse(req.body);
  const data = await authService.register(payload);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'User registered successfully',
    data,
  });
});

export const login = asyncHandler(async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const data = await authService.login(payload);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Logged in successfully',
    data,
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const profile = await authService.getProfile(req.user.sub);

  res.status(StatusCodes.OK).json({
    success: true,
    data: profile,
  });
});

export const updateMe = asyncHandler(async (req, res) => {
  const payload = updateProfileSchema.parse(req.body);
  const profile = await authService.updateProfile(req.user.sub, payload);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Profile updated successfully',
    data: profile,
  });
});

export const uploadMyProfileImage = asyncHandler(async (req, res) => {
  const payload = uploadProfileImageSchema.parse(req.body);
  const profile = await authService.uploadProfileImage(req.user.sub, payload, req.user.role);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Profile image updated successfully',
    data: profile,
  });
});
