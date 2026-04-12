import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { ApiError } from '../../../shared/utils/api-error.js';
import { asyncHandler } from '../../../shared/utils/async-handler.js';
import { User } from '../models/user.model.js';

const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  location: z.string().max(180).optional(),
  phone: z.string().max(30).optional(),
});

export const createUser = asyncHandler(async (req, res) => {
  const payload = createUserSchema.parse(req.body);

  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'User with this email already exists');
  }

  const user = await User.create(payload);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'User created successfully',
    data: user,
  });
});

export const getUsers = asyncHandler(async (req, res) => {
  void req;
  const users = await User.find().sort({ createdAt: -1 }).limit(100);

  res.status(StatusCodes.OK).json({
    success: true,
    data: users,
  });
});
