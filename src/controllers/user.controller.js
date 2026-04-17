import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { USER_ROLES } from '../config/access-control.js';
import { userService } from '../services/user.service.js';
import { asyncHandler } from '../shared/utils/async-handler.js';

const createUserByAdminSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(64),
  role: z
    .enum([
      USER_ROLES.DISTRICT_ADMIN,
      USER_ROLES.UPAZILA_ADMIN,
      USER_ROLES.UNION_LEADER,
      USER_ROLES.WARD_ADMIN,
      USER_ROLES.DONOR,
      USER_ROLES.FINDER,
    ])
    .optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  divisionId: z.string().optional(),
  districtId: z.string().optional(),
  upazilaId: z.string().optional(),
  unionId: z.string().optional(),
  location: z.string().max(180).optional(),
  phone: z.string().max(30).optional(),
});

export const getUsers = asyncHandler(async (req, res) => {
  const users = await userService.getAllUsers(req.currentUser);

  res.status(StatusCodes.OK).json({
    success: true,
    data: users,
  });
});

export const getUserManagementMeta = asyncHandler(async (req, res) => {
  const meta = await userService.getUserManagementMeta(req.currentUser);

  res.status(StatusCodes.OK).json({
    success: true,
    data: meta,
  });
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.userId, req.currentUser);

  res.status(StatusCodes.OK).json({
    success: true,
    data: user,
  });
});

export const createUserByAdmin = asyncHandler(async (req, res) => {
  const payload = createUserByAdminSchema.parse(req.body);
  const user = await userService.createUserByAdmin(req.currentUser, payload);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'User created successfully',
    data: user,
  });
});

export const createUsersByAdminBulk = asyncHandler(async (req, res) => {
  const payload = z.array(createUserByAdminSchema).min(1).max(100).parse(req.body?.users || []);
  const users = await userService.createUsersByAdminBulk(req.currentUser, payload);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Users created successfully',
    data: users,
  });
});

const updateUserRoleSchema = z.object({
  role: z.enum([
    USER_ROLES.DISTRICT_ADMIN,
    USER_ROLES.UPAZILA_ADMIN,
    USER_ROLES.UNION_LEADER,
    USER_ROLES.WARD_ADMIN,
    USER_ROLES.DONOR,
    USER_ROLES.FINDER,
  ]),
});

export const updateUserRoleByAdmin = asyncHandler(async (req, res) => {
  const payload = updateUserRoleSchema.parse(req.body);
  const user = await userService.updateUserRoleByAdmin(req.currentUser, req.params.userId, payload);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'User role updated successfully',
    data: user,
  });
});
