import mongoose from 'mongoose';

import {
  getAllDistricts,
  getAllDivisions,
  getAllUnions,
  getAllUpazilas,
} from 'bd-address-pro';

import { connectDatabase } from '../config/db.js';
import { logger } from '../config/logger.js';
import { District } from '../models/district.model.js';
import { Division } from '../models/division.model.js';
import { Union } from '../models/union.model.js';
import { Upazila } from '../models/upazila.model.js';

const EXPECTED_COUNTS = {
  divisions: 8,
  districts: 64,
  upazilas: 495,
  unions: 4554,
};

const toCode = (prefix, id) => `${prefix}-${String(id).padStart(4, '0')}`;

const detectAreaType = (item) => {
  const content = `${item?.name || ''} ${item?.bnName || ''}`.toLowerCase();
  return /pouroshava|pourashava|municipality|municipal|পৌরসভা|পৌর/.test(content)
    ? 'pouroshava'
    : 'union';
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

const failIfCountMismatch = (label, expected, actual) => {
  if (expected !== actual) {
    throw new Error(`${label} count mismatch. Expected ${expected}, got ${actual}`);
  }
};

const buildSource = () => {
  const divisions = getAllDivisions();
  const districts = getAllDistricts();
  const upazilas = getAllUpazilas();

  const allUnions = getAllUnions().sort((a, b) => a.id - b.id);

  // Source packages often include newer administrative additions.
  // We keep the official snapshot requested in this project: 4554 union/pouroshava records.
  const unions = allUnions.slice(0, EXPECTED_COUNTS.unions);

  failIfCountMismatch('Division', EXPECTED_COUNTS.divisions, divisions.length);
  failIfCountMismatch('District', EXPECTED_COUNTS.districts, districts.length);
  failIfCountMismatch('Upazila', EXPECTED_COUNTS.upazilas, upazilas.length);
  failIfCountMismatch('Union/Pouroshava', EXPECTED_COUNTS.unions, unions.length);

  return { divisions, districts, upazilas, unions };
};

const seedLocations = async () => {
  await connectDatabase();

  const { divisions, districts, upazilas, unions } = buildSource();

  await Union.deleteMany({});
  await Upazila.deleteMany({});
  await District.deleteMany({});
  await Division.deleteMany({});

  const divisionDocs = await Division.insertMany(
    divisions.map((item) => ({
      name: item.name,
      bnName: item.bnName,
      code: toCode('DIV', item.id),
      externalId: item.id,
    })),
    { ordered: true },
  );

  const divisionMap = new Map(divisionDocs.map((item) => [item.externalId, item]));

  const districtPayload = districts.map((item) => {
    const division = divisionMap.get(item.divisionId);
    if (!division) {
      throw new Error(`District ${item.name} references unknown divisionId ${item.divisionId}`);
    }

    return {
      divisionId: division._id,
      name: item.name,
      bnName: item.bnName,
      code: toCode('DIS', item.id),
      externalId: item.id,
    };
  });

  const districtDocs = await District.insertMany(districtPayload, { ordered: true });
  const districtMap = new Map(districtDocs.map((item) => [item.externalId, item]));

  const upazilaPayload = upazilas.map((item) => {
    const district = districtMap.get(item.districtId);
    if (!district) {
      throw new Error(`Upazila ${item.name} references unknown districtId ${item.districtId}`);
    }

    return {
      divisionId: district.divisionId,
      districtId: district._id,
      name: item.name,
      bnName: item.bnName,
      code: toCode('UPZ', item.id),
      externalId: item.id,
    };
  });

  const upazilaDocs = await Upazila.insertMany(upazilaPayload, { ordered: true });
  const upazilaMap = new Map(upazilaDocs.map((item) => [item.externalId, item]));

  const unionPayload = unions.map((item) => {
    const upazila = upazilaMap.get(item.upazilaId);
    if (!upazila) {
      throw new Error(`Union/Pouroshava ${item.name} references unknown upazilaId ${item.upazilaId}`);
    }

    return {
      divisionId: upazila.divisionId,
      districtId: upazila.districtId,
      upazilaId: upazila._id,
      areaType: detectAreaType(item),
      name: item.name,
      bnName: item.bnName,
      code: toCode('UNI', item.id),
      externalId: item.id,
    };
  });

  const upazilasWithArea = new Set(unionPayload.map((item) => String(item.upazilaId)));
  const fallbackAreaPayload = upazilaDocs
    .filter((upazila) => !upazilasWithArea.has(String(upazila._id)))
    .flatMap((upazila) => buildFallbackAreas(upazila));

  const allUnionPayload = [...unionPayload, ...fallbackAreaPayload];

  await Union.insertMany(allUnionPayload, { ordered: true });

  logger.info('Location seeding completed');
  logger.info(`Divisions: ${divisionDocs.length}`);
  logger.info(`Districts: ${districtDocs.length}`);
  logger.info(`Upazilas: ${upazilaDocs.length}`);
  logger.info(`Fallback Areas Added (Union + Pouroshava): ${fallbackAreaPayload.length}`);
  logger.info(`Unions/Pouroshava: ${allUnionPayload.length}`);
};

seedLocations()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error('Location seeding failed', error);
    await mongoose.connection.close();
    process.exit(1);
  });
