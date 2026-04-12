import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { authService } from '../services/auth.service.js';
import { asyncHandler } from '../shared/utils/async-handler.js';

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(64),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  districtId: z.string().optional(),
  upazilaId: z.string().optional(),
  unionId: z.string().min(1),
  location: z.string().max(180).optional(),
  phone: z.string().max(30).optional(),
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
