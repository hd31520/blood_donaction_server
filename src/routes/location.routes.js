import { Router } from 'express';

import {
  getDistrictsByDivisionId,
  getDivisions,
  getPouroshavasByUpazilaId,
  getUnionsBySelectedUpazilaId,
  getUnionsByUpazilaId,
  getUpazilasByDistrictId,
} from '../controllers/location.controller.js';

export const locationRouter = Router();

locationRouter.get('/divisions', getDivisions);
locationRouter.get('/divisions/:divisionId/districts', getDistrictsByDivisionId);
locationRouter.get('/districts/:districtId/upazilas', getUpazilasByDistrictId);
locationRouter.get('/unions', getUnionsBySelectedUpazilaId);
locationRouter.get('/upazilas/:upazilaId/unions', getUnionsByUpazilaId);
locationRouter.get('/upazilas/:upazilaId/pouroshavas', getPouroshavasByUpazilaId);
