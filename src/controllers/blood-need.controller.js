import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import { bloodNeedService } from '../services/blood-need.service.js';
import { Division } from '../models/division.model.js';
import { District } from '../models/district.model.js';
import { Upazila } from '../models/upazila.model.js';
import { Union } from '../models/union.model.js';
import { ApiError } from '../shared/utils/api-error.js';

const toExternalId = (value) => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  return null;
};

const resolveLocationId = async (Model, value, fieldName, { required = true } = {}) => {
  if (!value) {
    if (required) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `${fieldName} is required`);
    }

    return undefined;
  }

  if (mongoose.isValidObjectId(value)) {
    return value;
  }

  const externalId = toExternalId(value);
  if (externalId === null) {
    if (required) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `${fieldName} must be a valid ObjectId or numeric externalId`,
      );
    }

    return undefined;
  }

  const entity = await Model.findOne({ externalId }).select('_id').lean();
  if (!entity?._id) {
    if (required) {
      throw new ApiError(StatusCodes.NOT_FOUND, `${fieldName} not found`);
    }

    return undefined;
  }

  return entity._id.toString();
};

const normalizeBloodNeedLocation = async (location = {}) => {
  const normalizedLocation = {
    division: await resolveLocationId(Division, location.division, 'location.division'),
    district: await resolveLocationId(District, location.district, 'location.district'),
    upazila: await resolveLocationId(Upazila, location.upazila, 'location.upazila'),
  };

  const union = await resolveLocationId(Union, location.union, 'location.union', { required: false });
  if (union) {
    normalizedLocation.union = union;
  }

  if (location.area) {
    normalizedLocation.area = location.area;
  }

  return normalizedLocation;
};

export const createBloodNeed = async (req, res, next) => {
  try {
    const {
      patientName,
      patientAge,
      bloodGroup,
      unitsRequired,
      hospital,
      hospitalName,
      location,
      urgencyLevel,
      needsRegularBlood,
      medicalCondition,
      description,
      contactPhone,
      contactPerson,
      requiredDate,
      notes,
    } = req.body;

    if (!patientName || !patientAge || !bloodGroup || !contactPhone || !requiredDate || !location) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const normalizedLocation = await normalizeBloodNeedLocation(location);

    const bloodNeed = await bloodNeedService.createBloodNeed(
      {
        userId: req.currentUser._id,
        patientName,
        patientAge,
        bloodGroup,
        unitsRequired: unitsRequired || 1,
        hospital,
        hospitalName,
        location: normalizedLocation,
        urgencyLevel: urgencyLevel || 'medium',
        needsRegularBlood: needsRegularBlood || false,
        medicalCondition: medicalCondition || 'none',
        description,
        contactPhone,
        contactPerson,
        requiredDate,
        notes,
      },
      req.currentUser._id,
    );

    res.status(201).json({
      success: true,
      message: 'Blood need request created successfully',
      data: bloodNeed,
    });
  } catch (error) {
    next(error);
  }
};

export const getBloodNeedById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bloodNeed = await bloodNeedService.getBloodNeedById(id);

    if (!bloodNeed) {
      return res.status(404).json({
        success: false,
        error: 'Blood need request not found',
      });
    }

    res.json({
      success: true,
      data: bloodNeed,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyBloodNeeds = async (req, res, next) => {
  try {
    const bloodNeeds = await bloodNeedService.getMyBloodNeeds(req.currentUser._id);

    res.json({
      success: true,
      data: bloodNeeds,
    });
  } catch (error) {
    next(error);
  }
};

export const searchBloodNeeds = async (req, res, next) => {
  try {
    const { bloodGroup, status, urgencyLevel, divisionId, districtId, upazilaId, unionId, page, limit } = req.query;

    const result = await bloodNeedService.searchBloodNeeds({
      bloodGroup,
      status,
      urgencyLevel,
      divisionId,
      districtId,
      upazilaId,
      unionId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const searchBloodNeedsInScope = async (req, res, next) => {
  try {
    const { bloodGroup, status, urgencyLevel, page, limit } = req.query;

    const scope = {
      divisionId: req.currentUser.scope?.division,
      districtId: req.currentUser.scope?.district,
      upazilaId: req.currentUser.scope?.upazila,
    };

    const result = await bloodNeedService.searchBloodNeedsInScope(
      scope,
      {
        bloodGroup,
        status,
        urgencyLevel,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
      },
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBloodNeed = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };

    if (data.location) {
      data.location = await normalizeBloodNeedLocation(data.location);
    }

    const bloodNeed = await bloodNeedService.updateBloodNeed(id, data, req.currentUser._id);

    res.json({
      success: true,
      message: 'Blood need request updated successfully',
      data: bloodNeed,
    });
  } catch (error) {
    next(error);
  }
};

export const addDonorToBloodNeed = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bloodNeed = await bloodNeedService.addDonorToBloodNeed(id, req.currentUser._id);

    res.json({
      success: true,
      message: 'Donor added to blood need request',
      data: bloodNeed,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelBloodNeed = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bloodNeed = await bloodNeedService.cancelBloodNeed(id, req.currentUser._id);

    res.json({
      success: true,
      message: 'Blood need request cancelled',
      data: bloodNeed,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicBloodNeeds = async (req, res, next) => {
  try {
    const { bloodGroup, urgencyLevel, districtId, page, limit } = req.query;

    const result = await bloodNeedService.getPublicBloodNeeds({
      bloodGroup,
      urgencyLevel,
      districtId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
