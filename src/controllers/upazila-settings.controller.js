import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { upazilaSettingsService } from '../services/upazila-settings.service.js';
import { asyncHandler } from '../shared/utils/async-handler.js';

const saveImgbbSchema = z.object({
  imgbbApiKey: z.string().min(1).max(300),
});

export const getMyUpazilaImgbbSettings = asyncHandler(async (req, res) => {
  const data = await upazilaSettingsService.getMyImgbbSettings(req.currentUser);

  res.status(StatusCodes.OK).json({
    success: true,
    data,
  });
});

export const saveMyUpazilaImgbbSettings = asyncHandler(async (req, res) => {
  const payload = saveImgbbSchema.parse(req.body);
  const data = await upazilaSettingsService.saveMyImgbbApiKey(req.currentUser, payload.imgbbApiKey);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Upazila ImgBB API key saved successfully',
    data,
  });
});
