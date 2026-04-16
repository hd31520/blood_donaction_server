import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { hospitalService } from '../services/hospital.service.js';
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

const createHospitalSchema = z
  .object({
    name: z.string().min(2).max(180),
    divisionId: z.string().optional(),
    districtId: z.string().optional(),
    upazilaId: z.string().optional(),
    areaType: z.enum(['union', 'pouroshava']),
    unionId: optionalTrimmedString(120, 1),
    unionName: optionalTrimmedString(120, 2),
    wardNumber: optionalTrimmedString(20, 1),
    address: optionalTrimmedString(220),
    phone: optionalTrimmedString(30),
  })
  .refine((value) => value.unionId || value.unionName, {
    message: 'unionId or unionName is required',
    path: ['unionName'],
  })
  .refine((value) => value.areaType !== 'pouroshava' || value.wardNumber, {
    message: 'wardNumber is required for pouroshava locations',
    path: ['wardNumber'],
  });

const listHospitalSchema = z.object({
  divisionId: z.string().optional(),
  districtId: z.string().optional(),
  upazilaId: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const createHospital = asyncHandler(async (req, res) => {
  const payload = createHospitalSchema.parse(req.body);
  const data = await hospitalService.createHospital(req.currentUser, payload);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Hospital created successfully',
    data,
  });
});

export const listHospitals = asyncHandler(async (req, res) => {
  const filters = listHospitalSchema.parse(req.query);
  const result = await hospitalService.listHospitals(req.currentUser, filters);

  res.status(StatusCodes.OK).json({
    success: true,
    data: result.data,
    meta: result.pagination,
  });
});
