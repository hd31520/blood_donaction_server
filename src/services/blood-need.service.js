import { BloodNeed } from '../models/blood-need.model.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const toBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return false;
};

const normalizeCondition = (value) => {
  if (!value) {
    return 'none';
  }

  return ['thalassemia', 'other_regular'].includes(value) ? value : 'none';
};

export const bloodNeedService = {
  async createBloodNeed(data, createdBy) {
    const needsRegularBlood = toBoolean(data.needsRegularBlood);
    const medicalCondition = normalizeCondition(data.medicalCondition);
    const shouldKeep = needsRegularBlood || medicalCondition !== 'none';

    const bloodNeed = new BloodNeed({
      ...data,
      needsRegularBlood,
      medicalCondition,
      autoDeleteAt: shouldKeep ? null : new Date(Date.now() + SEVEN_DAYS_MS),
      createdBy,
    });
    return bloodNeed.save();
  },

  async getBloodNeedById(id) {
    return BloodNeed.findById(id)
      .populate('userId', 'name email phone')
      .populate('hospital', 'name address')
      .populate('location.division', 'name')
      .populate('location.district', 'name')
      .populate('location.upazila', 'name')
      .populate('location.union', 'name')
      .populate('donors', 'name email phone');
  },

  async getMyBloodNeeds(userId) {
    return BloodNeed.find({ userId })
      .populate('hospital', 'name address')
      .populate('location.division', 'name')
      .populate('location.district', 'name')
      .populate('location.upazila', 'name')
      .populate('location.union', 'name')
      .populate('donors', 'name email')
      .sort({ createdAt: -1 });
  },

  async searchBloodNeeds(filters = {}) {
    const {
      bloodGroup,
      status,
      urgencyLevel,
      divisionId,
      districtId,
      upazilaId,
      unionId,
      page = 1,
      limit = 20,
    } = filters;

    const query = { status: { $ne: 'cancelled' } };

    if (bloodGroup) {
      query.bloodGroup = bloodGroup;
    }

    if (status) {
      query.status = status;
    }

    if (urgencyLevel) {
      query.urgencyLevel = urgencyLevel;
    }

    if (divisionId) {
      query['location.division'] = divisionId;
    }

    if (districtId) {
      query['location.district'] = districtId;
    }

    if (upazilaId) {
      query['location.upazila'] = upazilaId;
    }

    if (unionId) {
      query['location.union'] = unionId;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      BloodNeed.find(query)
        .populate('userId', 'name email phone')
        .populate('hospital', 'name address')
        .populate('location.division', 'name')
        .populate('location.district', 'name')
        .populate('location.upazila', 'name')
        .populate('location.union', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ urgencyLevel: -1, createdAt: -1 }),
      BloodNeed.countDocuments(query),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  },

  async searchBloodNeedsInScope(scope, filters = {}) {
    const {
      bloodGroup,
      status,
      urgencyLevel,
      page = 1,
      limit = 20,
    } = filters;

    const query = { status: { $ne: 'cancelled' } };

    // Apply scope filter
    if (scope.upazilaId) {
      query['location.upazila'] = scope.upazilaId;
    } else if (scope.districtId) {
      query['location.district'] = scope.districtId;
    } else if (scope.divisionId) {
      query['location.division'] = scope.divisionId;
    }

    if (bloodGroup) {
      query.bloodGroup = bloodGroup;
    }

    if (status) {
      query.status = status;
    }

    if (urgencyLevel) {
      query.urgencyLevel = urgencyLevel;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      BloodNeed.find(query)
        .populate('userId', 'name email phone')
        .populate('hospital', 'name address')
        .populate('location.division', 'name')
        .populate('location.district', 'name')
        .populate('location.upazila', 'name')
        .populate('location.union', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ urgencyLevel: -1, createdAt: -1 }),
      BloodNeed.countDocuments(query),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  },

  async updateBloodNeed(id, data, userId) {
    const bloodNeed = await BloodNeed.findById(id);
    if (!bloodNeed) {
      throw new Error('Blood need request not found');
    }

    if (bloodNeed.userId.toString() !== userId && bloodNeed.createdBy.toString() !== userId) {
      throw new Error('Unauthorized to update this blood need');
    }

    Object.assign(bloodNeed, data);
    return bloodNeed.save();
  },

  async addDonorToBloodNeed(bloodNeedId, donorUserId) {
    const bloodNeed = await BloodNeed.findById(bloodNeedId);
    if (!bloodNeed) {
      throw new Error('Blood need request not found');
    }

    if (!bloodNeed.donors.includes(donorUserId)) {
      bloodNeed.donors.push(donorUserId);
      bloodNeed.unitsReceived = (bloodNeed.unitsReceived || 0) + 1;

      if (bloodNeed.unitsReceived >= bloodNeed.unitsRequired) {
        bloodNeed.status = 'fulfilled';
      }
    }

    return bloodNeed.save();
  },

  async cancelBloodNeed(id, userId) {
    const bloodNeed = await BloodNeed.findById(id);
    if (!bloodNeed) {
      throw new Error('Blood need request not found');
    }

    if (bloodNeed.needsRegularBlood || bloodNeed.medicalCondition !== 'none') {
      throw new Error('Regular blood need requests cannot be deleted by users');
    }

    if (bloodNeed.userId.toString() !== userId && bloodNeed.createdBy.toString() !== userId) {
      throw new Error('Unauthorized to cancel this blood need');
    }

    bloodNeed.status = 'cancelled';
    return bloodNeed.save();
  },

  async getPublicBloodNeeds(filters = {}) {
    const { bloodGroup, urgencyLevel, districtId, page = 1, limit = 20 } = filters;

    const query = { status: { $in: ['pending', 'in_progress'] } };

    if (bloodGroup) {
      query.bloodGroup = bloodGroup;
    }

    if (urgencyLevel) {
      query.urgencyLevel = urgencyLevel;
    }

    if (districtId) {
      query['location.district'] = districtId;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      BloodNeed.find(query)
        .populate('userId', 'name email phone')
        .populate('hospital', 'name address')
        .populate('location.division', 'name')
        .populate('location.district', 'name')
        .populate('location.upazila', 'name')
        .populate('location.union', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ urgencyLevel: -1, createdAt: -1 }),
      BloodNeed.countDocuments(query),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  },
};
