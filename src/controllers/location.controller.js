import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { logger } from '../config/logger.js';
import { locationQueryService } from '../services/location-query.service.js';
import { asyncHandler } from '../shared/utils/async-handler.js';

const idParamsSchema = z.object({
  divisionId: z.string().min(1),
  districtId: z.string().min(1),
  upazilaId: z.string().min(1),
});

const unionsQuerySchema = z
  .object({
    upazilaId: z.string().min(1).optional(),
    selectedUpazilaId: z.string().min(1).optional(),
  })
  .refine((value) => value.upazilaId || value.selectedUpazilaId, {
    message: 'upazilaId is required',
  });

export const getDivisions = asyncHandler(async (req, res) => {
  const divisions = await locationQueryService.getDivisions();

  res.status(StatusCodes.OK).json({
    success: true,
    data: divisions,
  });
});

export const getDistrictsByDivisionId = asyncHandler(async (req, res) => {
  const { divisionId } = idParamsSchema.pick({ divisionId: true }).parse(req.params);
  const districts = await locationQueryService.getDistrictsByDivisionId(divisionId);

  res.status(StatusCodes.OK).json({
    success: true,
    data: districts,
  });
});

export const getUpazilasByDistrictId = asyncHandler(async (req, res) => {
  const { districtId } = idParamsSchema.pick({ districtId: true }).parse(req.params);
  const upazilas = await locationQueryService.getUpazilasByDistrictId(districtId);

  res.status(StatusCodes.OK).json({
    success: true,
    data: upazilas,
  });
});

export const getUnionsByUpazilaId = asyncHandler(async (req, res) => {
  const { upazilaId } = idParamsSchema.pick({ upazilaId: true }).parse(req.params);
  const unions = await locationQueryService.getUnionsByUpazilaId(upazilaId);

  res.status(StatusCodes.OK).json({
    success: true,
    data: unions,
  });
});

export const getPouroshavasByUpazilaId = asyncHandler(async (req, res) => {
  const { upazilaId } = idParamsSchema.pick({ upazilaId: true }).parse(req.params);
  const pouroshavas = await locationQueryService.getPouroshavasByUpazilaId(upazilaId);

  res.status(StatusCodes.OK).json({
    success: true,
    data: pouroshavas,
  });
});

export const getUnionsBySelectedUpazilaId = asyncHandler(async (req, res) => {
  const { upazilaId, selectedUpazilaId } = unionsQuerySchema.parse(req.query);
  const resolvedUpazilaId = upazilaId || selectedUpazilaId;

  logger.info('Location unions request received', {
    endpoint: '/locations/unions',
    upazilaId: resolvedUpazilaId,
    query: req.query,
  });

  const unions = await locationQueryService.getUnionsByUpazilaId(resolvedUpazilaId);

  logger.info('Location unions response ready', {
    upazilaId: resolvedUpazilaId,
    count: unions.length,
    unionIds: unions.map((union) => union.id),
  });

  res.status(StatusCodes.OK).json({
    success: true,
    data: unions,
  });
});
