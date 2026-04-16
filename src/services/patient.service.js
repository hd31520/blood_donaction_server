import mongoose from 'mongoose';

import { BloodNeed } from '../models/blood-need.model.js';

const sanitizePatient = (doc) => ({
  id: doc._id,
  patientName: doc.patientName,
  patientAge: doc.patientAge,
  bloodGroup: doc.bloodGroup,
  unitsRequired: doc.unitsRequired,
  unitsReceived: doc.unitsReceived || 0,
  urgencyLevel: doc.urgencyLevel,
  status: doc.status,
  needsRegularBlood: doc.needsRegularBlood || false,
  medicalCondition: doc.medicalCondition || 'none',
  autoDeleteAt: doc.autoDeleteAt || null,
  requiredDate: doc.requiredDate,
  contactPhone: doc.contactPhone,
  contactPerson: doc.contactPerson || null,
  hospital: doc.hospital
    ? {
        id: doc.hospital._id,
        name: doc.hospital.name,
        address: doc.hospital.address || null,
      }
    : null,
  hospitalName: doc.hospitalName || null,
  locationNames: {
    division: doc.location?.division?.name || null,
    district: doc.location?.district?.name || null,
    upazila: doc.location?.upazila?.name || null,
    union: doc.location?.union?.name || null,
    area: doc.location?.area || null,
  },
  requestedBy: doc.userId
    ? {
        id: doc.userId._id,
        name: doc.userId.name,
        phone: doc.userId.phone || null,
      }
    : null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const patientService = {
  async listPatients(filters = {}) {
    const {
      patientName,
      bloodGroup,
      status,
      divisionId,
      districtId,
      upazilaId,
      page = 1,
      limit = 20,
    } = filters;

    const query = {};

    if (patientName) {
      query.patientName = { $regex: patientName.trim(), $options: 'i' };
    }

    if (bloodGroup) {
      query.bloodGroup = bloodGroup;
    }

    if (status) {
      query.status = status;
    } else {
      query.status = { $ne: 'cancelled' };
    }

    if (divisionId && mongoose.isValidObjectId(divisionId)) {
      query['location.division'] = new mongoose.Types.ObjectId(divisionId);
    }

    if (districtId && mongoose.isValidObjectId(districtId)) {
      query['location.district'] = new mongoose.Types.ObjectId(districtId);
    }

    if (upazilaId && mongoose.isValidObjectId(upazilaId)) {
      query['location.upazila'] = new mongoose.Types.ObjectId(upazilaId);
    }

    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (currentPage - 1) * pageSize;

    const [data, total] = await Promise.all([
      BloodNeed.find(query)
        .populate('userId', 'name phone')
        .populate('hospital', 'name address')
        .populate('location.division', 'name')
        .populate('location.district', 'name')
        .populate('location.upazila', 'name')
        .populate('location.union', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      BloodNeed.countDocuments(query),
    ]);

    return {
      data: data.map(sanitizePatient),
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },
};
