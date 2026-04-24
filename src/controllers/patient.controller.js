import { patientService } from '../services/patient.service.js';

export const listPatients = async (req, res, next) => {
  try {
    const {
      patientName,
      bloodGroup,
      status,
      divisionId,
      districtId,
      upazilaId,
      unionId,
      page,
      limit,
    } = req.query;

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
    });

    res.json({
      success: true,
      data: result.data,
      meta: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};
