import { patientService } from '../services/patient.service.js';

export const listPatients = async (req, res, next) => {
  try {
    const { patientName, bloodGroup, status, divisionId, districtId, upazilaId, unionId, page, limit } = req.query;

    const includePending = !!req.currentUser;

    const result = await patientService.listPatients({
      patientName,
      bloodGroup,
      status,
      divisionId,
      districtId,
      upazilaId,
      unionId,
      page,
      limit,
      includePending,
    });

    res.json({ success: true, data: result.data, meta: result.pagination });
  } catch (error) {
    next(error);
  }
};

export const getPatientById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patient = await patientService.getPatientById(id, req.currentUser);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'রোগীর তথ্য পাওয়া যায়নি' });
    }

    res.json({ success: true, data: patient });
  } catch (error) {
    next(error);
  }
};

export const approvePatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patient = await patientService.updateApprovalStatus(id, req.currentUser, 'approved');

    res.json({ success: true, data: patient });
  } catch (error) {
    next(error);
  }
};

export const rejectPatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const patient = await patientService.updateApprovalStatus(id, req.currentUser, 'rejected', reason);

    res.json({ success: true, data: patient });
  } catch (error) {
    next(error);
  }
};
