import mongoose from 'mongoose';

import { ensureDatabaseConnection } from '../config/db.js';
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
  approvalStatus: doc.approvalStatus || 'pending',
  approvedBy: doc.approvedBy || null,
  approvedAt: doc.approvedAt || null,
  rejectedReason: doc.rejectedReason || null,
  needsRegularBlood: doc.needsRegularBlood || false,
  medicalCondition: doc.medicalCondition || 'none',
  autoDeleteAt: doc.autoDeleteAt || null,
  requiredDate: doc.requiredDate,
  contactPhone: doc.contactPhone,
  contactPerson: doc.contactPerson || null,
  description: doc.description || null,
  notes: doc.notes || null,
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

const populatePatientQuery = (query) =>
  query
    .populate('userId', 'name phone')
    .populate('hospital', 'name address')
    .populate('location.division', 'name')
    .populate('location.district', 'name')
    .populate('location.upazila', 'name')
    .populate('location.union', 'name');

const isAdminLikeRole = (role) =>
  ['super_admin', 'district_admin', 'upazila_admin', 'union_leader', 'ward_admin'].includes(role);

export const patientService = {
  async listPatients(filters = {}) {
    await ensureDatabaseConnection('patient:listPatients');

    const {
      patientName,
      bloodGroup,
      status,
      approvalStatus,
      includePending = false,
      divisionId,
      districtId,
      upazilaId,
      unionId,
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

    if (includePending && approvalStatus) {
      query.approvalStatus = approvalStatus;
    } else if (!includePending) {
      query.approvalStatus = 'approved';
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

    if (unionId && mongoose.isValidObjectId(unionId)) {
      query['location.union'] = new mongoose.Types.ObjectId(unionId);
    }

    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (currentPage - 1) * pageSize;

    const [data, total] = await Promise.all([
      populatePatientQuery(BloodNeed.find(query))
        .sort({ approvalStatus: 1, urgencyLevel: -1, createdAt: -1 })
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

  async getPatientById(id, currentUser = null) {
    await ensureDatabaseConnection('patient:getPatientById');

    if (!mongoose.isValidObjectId(id)) {
      return null;
    }

    const patient = await populatePatientQuery(BloodNeed.findById(id)).lean();

    if (!patient) {
      return null;
    }

    const canViewPending = currentUser && (
      isAdminLikeRole(currentUser.role) ||
      String(patient.userId?._id || patient.userId) === String(currentUser._id)
    );

    if ((patient.approvalStatus || 'pending') !== 'approved' && !canViewPending) {
      return null;
    }

    return sanitizePatient(patient);
  },

  async updateApprovalStatus(id, currentUser, approvalStatus, rejectedReason = '') {
    await ensureDatabaseConnection('patient:updateApprovalStatus');

    if (!mongoose.isValidObjectId(id)) {
      return null;
    }

    const update = {
      approvalStatus,
      approvedBy: approvalStatus === 'approved' ? currentUser._id : null,
      approvedAt: approvalStatus === 'approved' ? new Date() : null,
      rejectedReason: approvalStatus === 'rejected' ? rejectedReason || 'Rejected by admin' : '',
    };

    const patient = await populatePatientQuery(
      BloodNeed.findByIdAndUpdate(id, { $set: update }, { new: true }),
    ).lean();

    return patient ? sanitizePatient(patient) : null;
  },
};
