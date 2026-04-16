import mongoose from 'mongoose';

import { logger } from '../config/logger.js';
import { ApiError } from '../shared/utils/api-error.js';
import { District } from '../models/district.model.js';
import { Division } from '../models/division.model.js';
import { Union } from '../models/union.model.js';
import { Upazila } from '../models/upazila.model.js';
import { locationDatasetService } from './location-dataset.service.js';

const UNION_EXTERNAL_ID_OVERRIDES_BY_UPAZILA = new Map([
  [
    374,
    new Set([3425, 3426, 3427, 3428, 3429, 3430, 3431, 3432, 3433, 3434, 3435]),
  ],
]);

const UNION_NAME_OVERRIDES_BY_UPAZILA = new Map([
  [
    156,
    [
      { name: 'Ishan Gopalpur Union', bnName: 'ঈশান গোপালপুর ইউনিয়ন' },
      { name: 'Charmadhabdia Union', bnName: 'চরমাধবদিয়া ইউনিয়ন' },
      { name: 'North Channel Union', bnName: 'নর্থচ্যানেল ইউনিয়ন' },
      { name: 'Aliyabad Union', bnName: 'আলিয়াবাদ ইউনিয়ন' },
      { name: 'Dikrirchar Union', bnName: 'ডিক্রীরচর ইউনিয়ন' },
      { name: 'Machchar Union', bnName: 'মাচ্চর ইউনিয়ন' },
      { name: 'Ambikapur Union', bnName: 'অম্বিকাপুর ইউনিয়ন' },
      { name: 'Krishnanagar Union', bnName: 'কৃষ্ণনগর ইউনিয়ন' },
      { name: 'Kanaipur Union', bnName: 'কানাইপুর ইউনিয়ন' },
      { name: 'Kaijuri Union', bnName: 'কৈজুরী ইউনিয়ন' },
      { name: 'Gerda Union', bnName: 'গেরদা ইউনিয়ন' },
    ],
  ],
]);

const UNION_ONLY_UPAZILA_EXTERNAL_IDS = new Set([156, 374]);

const toExternalId = (value) => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  return null;
};

const resolveEntityObjectId = async (Model, value, fieldName) => {
  if (mongoose.isValidObjectId(value)) {
    return new mongoose.Types.ObjectId(value);
  }

  const externalId = toExternalId(value);
  if (externalId !== null) {
    const entity = await Model.findOne({ externalId }).select('_id').lean();
    if (!entity?._id) {
      throw new ApiError(404, `${fieldName} not found`);
    }

    return entity._id;
  }

  throw new ApiError(400, `${fieldName} must be a valid ObjectId or numeric externalId`);
};

const projection = '_id name bnName code divisionId districtId upazilaId areaType externalId';

const mapLocation = (doc, extra = {}) => ({
  id: doc._id?.toString?.() || String(doc._id),
  name: doc.name,
  bnName: doc.bnName || null,
  code: doc.code || null,
  externalId: doc.externalId,
  ...extra,
});

const mapDatasetLocation = (doc, extra = {}) => ({
  id: String(doc.id),
  name: doc.name,
  bnName: doc.bnName || null,
  code: doc.code || null,
  externalId: doc.id,
  ...extra,
});

const resolveExternalId = async (Model, value, fieldName) => {
  const externalId = toExternalId(value);
  if (externalId !== null) {
    return externalId;
  }

  if (mongoose.isValidObjectId(value)) {
    const entity = await Model.findById(value).select('externalId').lean();
    if (!entity?.externalId) {
      throw new ApiError(404, `${fieldName} not found`);
    }

    return entity.externalId;
  }

  throw new ApiError(400, `${fieldName} must be a valid ObjectId or numeric externalId`);
};

const buildUnionNameOverrideAreas = ({ externalUpazilaId, divisionId, districtId, upazilaId }) => {
  const overrideUnions = UNION_NAME_OVERRIDES_BY_UPAZILA.get(Number(externalUpazilaId));
  if (!overrideUnions?.length) {
    return null;
  }

  return overrideUnions.map((union, index) => ({
    id: `OVR-${externalUpazilaId}-${index + 1}`,
    name: union.name,
    bnName: union.bnName,
    code: `UNION-OVR-${externalUpazilaId}-${index + 1}`,
    externalId: 980000 + Number(externalUpazilaId) * 100 + index + 1,
    divisionId: String(divisionId),
    districtId: String(districtId),
    upazilaId: String(upazilaId),
    areaType: 'union',
  }));
};

const getFallbackAreasByUpazilaId = async (upazilaId, areaType) => {
  const externalUpazilaId = await resolveExternalId(Upazila, upazilaId, 'upazilaId');

  if (areaType === 'pouroshava' && UNION_ONLY_UPAZILA_EXTERNAL_IDS.has(externalUpazilaId)) {
    return [];
  }

  if (areaType === 'union') {
    const datasetUpazila = locationDatasetService.findUpazila(externalUpazilaId);
    const overriddenAreas = buildUnionNameOverrideAreas({
      externalUpazilaId,
      divisionId: datasetUpazila?.divisionId ?? '',
      districtId: datasetUpazila?.districtId ?? '',
      upazilaId: externalUpazilaId,
    });

    if (overriddenAreas) {
      return overriddenAreas;
    }
  }

  let areas = locationDatasetService
    .getUnionsByUpazila(externalUpazilaId)
    .filter((area) => (area.areaType || 'union') === areaType);

  if (areaType === 'union') {
    const overrideUnionExternalIds = UNION_EXTERNAL_ID_OVERRIDES_BY_UPAZILA.get(externalUpazilaId);
    if (overrideUnionExternalIds) {
      areas = areas.filter((area) => overrideUnionExternalIds.has(Number(area.id)));
    }
  }

  return areas.map((area) =>
    mapDatasetLocation(area, {
      divisionId: String(area.divisionId),
      districtId: String(area.districtId),
      upazilaId: String(area.upazilaId),
      areaType: area.areaType || 'union',
    }),
  );
};

const buildFallbackAreas = (upazila) => {
  const baseExternalId = Number(upazila.externalId || 0);

  return [
    {
      divisionId: upazila.divisionId,
      districtId: upazila.districtId,
      upazilaId: upazila._id,
      areaType: 'union',
      name: `${upazila.name} Union`,
      bnName: upazila.bnName ? `${upazila.bnName} ইউনিয়ন` : null,
      code: `UNION-FB-${upazila.externalId}`,
      externalId: 910000 + baseExternalId,
    },
    {
      divisionId: upazila.divisionId,
      districtId: upazila.districtId,
      upazilaId: upazila._id,
      areaType: 'pouroshava',
      name: `${upazila.name} Pouroshava`,
      bnName: upazila.bnName ? `${upazila.bnName} পৌরসভা` : null,
      code: `MUNI-${upazila.externalId}`,
      externalId: 900000 + baseExternalId,
    },
  ];
};

const ensureFallbackAreasIfMissing = async (normalizedUpazilaId) => {
  const anyAreaExists = await Union.exists({ upazilaId: normalizedUpazilaId });
  if (anyAreaExists) {
    return;
  }

  const upazila = await Upazila.findById(normalizedUpazilaId)
    .select('_id name bnName divisionId districtId externalId')
    .lean();

  if (!upazila) {
    return;
  }

  const fallbackAreas = buildFallbackAreas(upazila);

  try {
    if (fallbackAreas.length > 0) {
      await Union.insertMany(fallbackAreas, { ordered: false });
    }
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }
  }
};

const getAreasByUpazilaId = async (upazilaId, areaType) => {
  const normalizedUpazilaId = await resolveEntityObjectId(Upazila, upazilaId, 'upazilaId');

  logger.info('Querying areas by upazilaId', {
    upazilaId: normalizedUpazilaId.toString(),
    areaType,
  });

  const upazila = await Upazila.findById(normalizedUpazilaId)
    .select('_id externalId divisionId districtId')
    .lean();
  if (!upazila?._id) {
    throw new ApiError(404, 'Upazila not found');
  }

  if (areaType === 'union') {
    const overriddenAreas = buildUnionNameOverrideAreas({
      externalUpazilaId: upazila.externalId,
      divisionId: upazila.divisionId,
      districtId: upazila.districtId,
      upazilaId: upazila._id,
    });

    if (overriddenAreas) {
      return overriddenAreas;
    }
  }

  if (areaType === 'pouroshava' && UNION_ONLY_UPAZILA_EXTERNAL_IDS.has(Number(upazila.externalId))) {
    return [];
  }

  await ensureFallbackAreasIfMissing(normalizedUpazilaId);

  const areaFilter = {
    upazilaId: normalizedUpazilaId,
    areaType,
  };

  let areas = await Union.find(areaFilter)
    .select(projection)
    .sort({ name: 1 })
    .lean();

  if (areaType === 'union') {
    const overrideUnionExternalIds = UNION_EXTERNAL_ID_OVERRIDES_BY_UPAZILA.get(
      Number(upazila.externalId),
    );
    if (overrideUnionExternalIds) {
      areas = areas.filter((area) => overrideUnionExternalIds.has(Number(area.externalId)));
    }
  }

  logger.info('Area query completed', {
    upazilaId: normalizedUpazilaId.toString(),
    areaType,
    count: areas.length,
    areaIds: areas.map((area) => area._id?.toString()),
  });

  return areas.map((area) =>
    mapLocation(area, {
      divisionId: area.divisionId.toString(),
      districtId: area.districtId.toString(),
      upazilaId: area.upazilaId.toString(),
      areaType: area.areaType || 'union',
    }),
  );
};

export const locationQueryService = {
  getDivisions: async () => {
    try {
      const divisions = await Division.find({})
        .select('_id name bnName code externalId')
        .sort({ externalId: 1 })
        .lean();

      if (divisions.length > 0) {
        return divisions.map((division) => mapLocation(division));
      }
    } catch (error) {
      logger.warn('Primary divisions query failed. Falling back to dataset', {
        message: error?.message,
      });
    }

    return locationDatasetService
      .getAllDivisions()
      .sort((a, b) => a.id - b.id)
      .map((division) => mapDatasetLocation(division));
  },

  getDistrictsByDivisionId: async (divisionId) => {
    try {
      const normalizedDivisionId = await resolveEntityObjectId(Division, divisionId, 'divisionId');

      const districts = await District.find({ divisionId: normalizedDivisionId })
        .select(projection)
        .sort({ name: 1 })
        .lean();

      if (districts.length > 0) {
        return districts.map((district) =>
          mapLocation(district, { divisionId: district.divisionId.toString() }),
        );
      }
    } catch (error) {
      logger.warn('Primary districts query failed. Falling back to dataset', {
        message: error?.message,
        divisionId,
      });
    }

    const externalDivisionId = await resolveExternalId(Division, divisionId, 'divisionId');
    return locationDatasetService
      .getDistrictsByDivision(externalDivisionId)
      .sort((a, b) => a.id - b.id)
      .map((district) =>
        mapDatasetLocation(district, {
          divisionId: String(district.divisionId),
        }),
      );
  },

  getUpazilasByDistrictId: async (districtId) => {
    try {
      const normalizedDistrictId = await resolveEntityObjectId(District, districtId, 'districtId');

      const upazilas = await Upazila.find({ districtId: normalizedDistrictId })
        .select(projection)
        .sort({ name: 1 })
        .lean();

      if (upazilas.length > 0) {
        return upazilas.map((upazila) =>
          mapLocation(upazila, {
            divisionId: upazila.divisionId.toString(),
            districtId: upazila.districtId.toString(),
          }),
        );
      }
    } catch (error) {
      logger.warn('Primary upazilas query failed. Falling back to dataset', {
        message: error?.message,
        districtId,
      });
    }

    const externalDistrictId = await resolveExternalId(District, districtId, 'districtId');
    return locationDatasetService
      .getUpazilasByDistrict(externalDistrictId)
      .sort((a, b) => a.id - b.id)
      .map((upazila) =>
        mapDatasetLocation(upazila, {
          divisionId: String(upazila.divisionId),
          districtId: String(upazila.districtId),
        }),
      );
  },

  getUnionsByUpazilaId: async (upazilaId) => {
    try {
      const data = await getAreasByUpazilaId(upazilaId, 'union');
      if (data.length > 0) {
        return data;
      }
    } catch (error) {
      logger.warn('Primary unions query failed. Falling back to dataset', {
        message: error?.message,
        upazilaId,
      });
    }

    return getFallbackAreasByUpazilaId(upazilaId, 'union');
  },

  getPouroshavasByUpazilaId: async (upazilaId) => {
    try {
      const data = await getAreasByUpazilaId(upazilaId, 'pouroshava');
      if (data.length > 0) {
        return data;
      }
    } catch (error) {
      logger.warn('Primary pouroshavas query failed. Falling back to dataset', {
        message: error?.message,
        upazilaId,
      });
    }

    return getFallbackAreasByUpazilaId(upazilaId, 'pouroshava');
  },
};
