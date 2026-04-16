import { bloodNeedService } from '../services/blood-need.service.js';

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

    const bloodNeed = await bloodNeedService.createBloodNeed(
      {
        userId: req.currentUser._id,
        patientName,
        patientAge,
        bloodGroup,
        unitsRequired: unitsRequired || 1,
        hospital,
        hospitalName,
        location,
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
    const data = req.body;

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
