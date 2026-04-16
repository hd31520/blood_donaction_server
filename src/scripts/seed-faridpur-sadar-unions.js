import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { Division } from '../models/division.model.js';
import { District } from '../models/district.model.js';
import { Upazila } from '../models/upazila.model.js';
import { Union } from '../models/union.model.js';

const FARIDPUR_SADAR_UNION_NAMES = [
  'Aliabad',
  'Ambikapur',
  'Char Madhabdia',
  'Decreer Char',
  'Greda',
  'Ishan Gopalpur',
  'Kaijuri',
  'Kanaipur',
  'Krishnanagar',
  'Maj Char',
  'Uttar Channel',
];

const FARIDPUR_SADAR_WARDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const seedFaridpurSadarUnions = async () => {
  try {
    const startTime = Date.now();

    // Find Faridpur Sadar
    const faridpurSadar = await Upazila.findOne({ name: 'Faridpur Sadar' });
    if (!faridpurSadar) {
      console.error('Faridpur Sadar upazila not found');
      return;
    }

    console.log('Found Faridpur Sadar:', faridpurSadar._id);

    // Get max externalId for unions
    const maxUnion = await Union.findOne().sort({ externalId: -1 }).select('externalId');
    let nextExternalId = (maxUnion?.externalId || 4600) + 1;

    // Seed unions
    const unionOps = FARIDPUR_SADAR_UNION_NAMES.map((name, index) => ({
      insertOne: {
        document: {
          name,
          bnName: '',
          code: `FARIDPUR-SADAR-UNION-${String(index + 1).padStart(2, '0')}`,
          divisionId: faridpurSadar.divisionId,
          districtId: faridpurSadar.districtId,
          upazilaId: faridpurSadar._id,
          areaType: 'union',
          externalId: nextExternalId + index,
        },
      },
    }));

    const unionResults = await Union.bulkWrite(unionOps, { ordered: false });
    console.log(`✓ Seeded ${unionResults.insertedCount} unions for Faridpur Sadar`);

    nextExternalId += FARIDPUR_SADAR_UNION_NAMES.length;

    // Seed pouroshavas (wards)
    const pouroshavaOps = FARIDPUR_SADAR_WARDS.map((wardNumber) => ({
      insertOne: {
        document: {
          name: `Ward ${wardNumber}`,
          bnName: `ওয়ার্ড ${wardNumber}`,
          code: `FARIDPUR-SADAR-WARD-${wardNumber}`,
          divisionId: faridpurSadar.divisionId,
          districtId: faridpurSadar.districtId,
          upazilaId: faridpurSadar._id,
          areaType: 'pouroshava',
          externalId: nextExternalId,
        },
      },
    }));

    // Only create first pouroshava as a sample (uncomment to create all)
    // const pouroshavaResults = await Union.bulkWrite(pouroshavaOps, { ordered: false });
    // console.log(`✓ Seeded ${pouroshavaResults.insertedCount} pouroshavas for Faridpur Sadar`);

    const elapsedTime = Date.now() - startTime;
    console.log(`✓ Seeding completed in ${elapsedTime}ms`);
  } catch (error) {
    console.error('Error seeding Faridpur Sadar unions:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
  }
};

// Run seed
connectDatabase()
  .then(() => seedFaridpurSadarUnions())
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
