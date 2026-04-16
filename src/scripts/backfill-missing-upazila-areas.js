import mongoose from 'mongoose';

import { connectDatabase } from '../config/db.js';
import { logger } from '../config/logger.js';
import { Union } from '../models/union.model.js';
import { Upazila } from '../models/upazila.model.js';

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

const backfillMissingUpazilaAreas = async () => {
  await connectDatabase();

  const upazilas = await Upazila.find({})
    .select('_id name bnName divisionId districtId externalId')
    .lean();

  const unions = await Union.find({}).select('upazilaId areaType').lean();

  const typeMapByUpazila = new Map();
  for (const union of unions) {
    const key = String(union.upazilaId);
    if (!typeMapByUpazila.has(key)) {
      typeMapByUpazila.set(key, new Set());
    }

    typeMapByUpazila.get(key).add(union.areaType || 'union');
  }

  const payload = upazilas.flatMap((upazila) => {
    const existingTypes = typeMapByUpazila.get(String(upazila._id)) || new Set();

    // No area records at all: add both fallback types.
    if (existingTypes.size === 0) {
      return buildFallbackAreas(upazila);
    }

    // Pouroshava-only: add fallback union.
    if (!existingTypes.has('union') && existingTypes.has('pouroshava')) {
      return buildFallbackAreas(upazila).filter((item) => item.areaType === 'union');
    }

    // Keep union-only upazilas unchanged.
    return [];
  });

  if (payload.length === 0) {
    logger.info('No backfill needed. No upazila is empty or pouroshava-only.');
    return;
  }

  await Union.insertMany(payload, { ordered: true });

  logger.info(`Backfill completed. Added ${payload.length} fallback area records.`);
};

backfillMissingUpazilaAreas()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error('Backfill failed', error);
    await mongoose.connection.close();
    process.exit(1);
  });
