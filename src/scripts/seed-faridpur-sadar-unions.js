import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
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

    // Note: Pouroshavas (wards) can be created separately if needed
    // They would require additional bulkWrite operations similar to unions above

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
