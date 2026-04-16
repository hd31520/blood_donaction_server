import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { donorProfileService } from '../services/donor-profile.service.js';
import { asyncHandler } from '../shared/utils/async-handler.js';

const donorProfileSchema = z.object({
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  lastDonationDate: z.coerce.date().optional(),
  availabilityStatus: z.enum(['available', 'unavailable', 'temporarily_unavailable']),
});

const donationHistorySchema = z.object({
  donationDate: z.coerce.date(),
  location: z.string().max(180).optional(),
  notes: z.string().max(500).optional(),
});

const searchDonorSchema = z.object({
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  divisionId: z.string().optional(),
  districtId: z.string().optional(),
  upazilaId: z.string().optional(),
  unionId: z.string().optional(),
  availabilityStatus: z.enum(['available', 'unavailable', 'temporarily_unavailable']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const upsertMyDonorProfile = asyncHandler(async (req, res) => {
  const payload = donorProfileSchema.parse(req.body);
  const profile = await donorProfileService.upsertMyProfile(req.currentUser, payload);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Donor profile saved successfully',
    data: profile,
  });
});

export const getMyDonorProfile = asyncHandler(async (req, res) => {
  const profile = await donorProfileService.getMyProfile(req.currentUser);

  res.status(StatusCodes.OK).json({
    success: true,
    data: profile,
  });
});

export const addMyDonationHistoryRecord = asyncHandler(async (req, res) => {
  const payload = donationHistorySchema.parse(req.body);
  const profile = await donorProfileService.addDonationHistoryRecord(req.currentUser, payload);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Donation history entry added',
    data: profile,
  });
});

export const getMyDonationHistory = asyncHandler(async (req, res) => {
  const history = await donorProfileService.getMyDonationHistory(req.currentUser);

  res.status(StatusCodes.OK).json({
    success: true,
    data: history,
  });
});

export const getDonorProfileByUserIdForAdmin = asyncHandler(async (req, res) => {
  const profile = await donorProfileService.getDonorProfileByUserIdForAdmin(
    req.currentUser,
    req.params.userId,
  );

  res.status(StatusCodes.OK).json({
    success: true,
    data: profile,
  });
});

export const searchDonors = asyncHandler(async (req, res) => {
  const filters = searchDonorSchema.parse(req.query);
  const result = await donorProfileService.searchDonors(req.currentUser, filters);

  res.status(StatusCodes.OK).json({
    success: true,
    data: result.data,
    meta: result.pagination,
  });
});

export const searchPublicDonors = asyncHandler(async (req, res) => {
  const filters = searchDonorSchema.parse(req.query);
  const result = await donorProfileService.searchPublicDonors(filters);

  res.status(StatusCodes.OK).json({
    success: true,
    data: result.data,
    meta: result.pagination,
  });
});

export const getPublicDonorProfileByUserId = asyncHandler(async (req, res) => {
  const profile = await donorProfileService.getPublicDonorProfileByUserId(req.params.userId);

  res.status(StatusCodes.OK).json({
    success: true,
    data: profile,
  });
});
