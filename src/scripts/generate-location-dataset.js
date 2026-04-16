/**
 * Generates a structured JSON dataset of Bangladesh locations
 * where each union is linked with its upazilaId, districtId, and divisionId
 * for fast querying without database calls.
 *
 * Output: Creates location-dataset.json with hierarchical structure
 * Usage: node generate-location-dataset.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getAllDistricts,
  getAllDivisions,
  getAllUnions,
  getAllUpazilas,
} from 'bd-address-pro';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/**
 * Generates a flat array of unions with all parent IDs for fast querying
 */
const generateFlatDataset = () => {
  const divisions = getAllDivisions();
  const districts = getAllDistricts();
  const upazilas = getAllUpazilas();
  const allUnions = getAllUnions().sort((a, b) => a.id - b.id);
  const unions = allUnions.slice(0, EXPECTED_COUNTS.unions);

  // Validation
  if (divisions.length !== EXPECTED_COUNTS.divisions) {
    throw new Error(
      `Division count mismatch. Expected ${EXPECTED_COUNTS.divisions}, got ${divisions.length}`,
    );
  }
  if (districts.length !== EXPECTED_COUNTS.districts) {
    throw new Error(
      `District count mismatch. Expected ${EXPECTED_COUNTS.districts}, got ${districts.length}`,
    );
  }
  if (upazilas.length !== EXPECTED_COUNTS.upazilas) {
    throw new Error(
      `Upazila count mismatch. Expected ${EXPECTED_COUNTS.upazilas}, got ${upazilas.length}`,
    );
  }
  if (unions.length !== EXPECTED_COUNTS.unions) {
    throw new Error(
      `Union count mismatch. Expected ${EXPECTED_COUNTS.unions}, got ${unions.length}`,
    );
  }

  // Create lookup maps for fast access
  const divisionMap = new Map(divisions.map((item) => [item.id, item]));
  const districtMap = new Map(districts.map((item) => [item.id, item]));
  const upazilaMap = new Map(upazilas.map((item) => [item.id, item]));

  // Build flat array with all parent references
  const flatDataset = unions.map((union) => {
    const upazila = upazilaMap.get(union.upazilaId);
    if (!upazila) {
      throw new Error(`Union ${union.name} references unknown upazilaId ${union.upazilaId}`);
    }

    const district = districtMap.get(upazila.districtId);
    if (!district) {
      throw new Error(
        `Upazila ${upazila.name} references unknown districtId ${upazila.districtId}`,
      );
    }

    const division = divisionMap.get(district.divisionId);
    if (!division) {
      throw new Error(
        `District ${district.name} references unknown divisionId ${district.divisionId}`,
      );
    }

    return {
      id: union.id,
      name: union.name,
      bnName: union.bnName || null,
      code: toCode('UNION', union.id),
      areaType: detectAreaType(union),
      upazilaId: union.upazilaId,
      upazilaName: upazila.name,
      upazilaBnName: upazila.bnName || null,
      districtId: district.id,
      districtName: district.name,
      districtBnName: district.bnName || null,
      divisionId: division.id,
      divisionName: division.name,
      divisionBnName: division.bnName || null,
    };
  });

  return flatDataset;
};

/**
 * Generates a hierarchical nested structure for efficient browsing
 */
const generateHierarchicalDataset = () => {
  const divisions = getAllDivisions();
  const districts = getAllDistricts();
  const upazilas = getAllUpazilas();
  const allUnions = getAllUnions().sort((a, b) => a.id - b.id);
  const unions = allUnions.slice(0, EXPECTED_COUNTS.unions);

  // Create lookup maps
  const divisionMap = new Map(divisions.map((item) => [item.id, item]));
  const districtsByDivision = new Map();
  const upazilasByDistrict = new Map();
  const unionsByUpazila = new Map();

  // Organize data hierarchically
  districts.forEach((district) => {
    if (!districtsByDivision.has(district.divisionId)) {
      districtsByDivision.set(district.divisionId, []);
    }
    districtsByDivision.get(district.divisionId).push(district);
  });

  upazilas.forEach((upazila) => {
    if (!upazilasByDistrict.has(upazila.districtId)) {
      upazilasByDistrict.set(upazila.districtId, []);
    }
    upazilasByDistrict.get(upazila.districtId).push(upazila);
  });

  unions.forEach((union) => {
    if (!unionsByUpazila.has(union.upazilaId)) {
      unionsByUpazila.set(union.upazilaId, []);
    }
    unionsByUpazila.get(union.upazilaId).push(union);
  });

  // Build hierarchical structure
  const hierarchical = divisions
    .sort((a, b) => a.id - b.id)
    .map((division) => {
      const districtList = districtsByDivision.get(division.id) || [];
      districtList.sort((a, b) => a.id - b.id);

      return {
        id: division.id,
        name: division.name,
        bnName: division.bnName || null,
        code: toCode('DIV', division.id),
        districts: districtList.map((district) => {
          const upazilaList = upazilasByDistrict.get(district.id) || [];
          upazilaList.sort((a, b) => a.id - b.id);

          return {
            id: district.id,
            name: district.name,
            bnName: district.bnName || null,
            code: toCode('DIS', district.id),
            divisionId: division.id,
            upazilas: upazilaList.map((upazila) => {
              const unionList = unionsByUpazila.get(upazila.id) || [];
              unionList.sort((a, b) => a.id - b.id);

              return {
                id: upazila.id,
                name: upazila.name,
                bnName: upazila.bnName || null,
                code: toCode('UPAZILA', upazila.id),
                districtId: district.id,
                divisionId: division.id,
                unions: unionList.map((union) => ({
                  id: union.id,
                  name: union.name,
                  bnName: union.bnName || null,
                  code: toCode('UNION', union.id),
                  areaType: detectAreaType(union),
                  upazilaId: upazila.id,
                  districtId: district.id,
                  divisionId: division.id,
                })),
              };
            }),
          };
        }),
      };
    });

  return hierarchical;
};

/**
 * Generates optimized lookup indexes for fast queries
 */
const generateLookupIndexes = () => {
  const divisions = getAllDivisions();
  const districts = getAllDistricts();
  const upazilas = getAllUpazilas();
  const allUnions = getAllUnions().sort((a, b) => a.id - b.id);
  const unions = allUnions.slice(0, EXPECTED_COUNTS.unions);

  // Create maps for O(1) lookups
  const divisionMap = new Map(divisions.map((item) => [item.id, item]));
  const districtMap = new Map(districts.map((item) => [item.id, item]));
  const upazilaMap = new Map(upazilas.map((item) => [item.id, item]));
  const unionMap = new Map(unions.map((item) => [item.id, item]));

  return {
    divisions: Object.fromEntries(
      divisions.map((d) => [
        d.id,
        { id: d.id, name: d.name, bnName: d.bnName || null, code: toCode('DIV', d.id) },
      ]),
    ),
    districts: Object.fromEntries(
      districts.map((d) => [
        d.id,
        {
          id: d.id,
          name: d.name,
          bnName: d.bnName || null,
          code: toCode('DIS', d.id),
          divisionId: d.divisionId,
        },
      ]),
    ),
    upazilas: Object.fromEntries(
      upazilas.map((u) => [
        u.id,
        {
          id: u.id,
          name: u.name,
          bnName: u.bnName || null,
          code: toCode('UPAZILA', u.id),
          districtId: u.districtId,
          divisionId: districtMap.get(u.districtId).divisionId,
        },
      ]),
    ),
    unions: Object.fromEntries(
      unions.map((u) => {
        const upazila = upazilaMap.get(u.upazilaId);
        const district = districtMap.get(upazila.districtId);
        return [
          u.id,
          {
            id: u.id,
            name: u.name,
            bnName: u.bnName || null,
            code: toCode('UNION', u.id),
            areaType: detectAreaType(u),
            upazilaId: u.upazilaId,
            districtId: upazila.districtId,
            divisionId: district.divisionId,
          },
        ];
      }),
    ),
  };
};

const main = async () => {
  try {
    console.log('Generating Bangladesh location dataset...\n');

    console.log('📊 Generating flat dataset for fast union queries...');
    const flatDataset = generateFlatDataset();

    console.log('📊 Generating hierarchical dataset for browsing...');
    const hierarchicalDataset = generateHierarchicalDataset();

    console.log('📊 Generating optimized lookup indexes...');
    const lookupIndexes = generateLookupIndexes();

    // Combine all datasets
    const completeDataset = {
      metadata: {
        generatedAt: new Date().toISOString(),
        counts: {
          divisions: flatDataset.reduce(
            (acc, u) => (acc.has(u.divisionId) ? acc : acc.add(u.divisionId)),
            new Set(),
          ).size,
          districts: flatDataset
            .reduce((acc, u) => (acc.has(u.districtId) ? acc : acc.add(u.districtId)), new Set())
            .size,
          upazilas: flatDataset
            .reduce((acc, u) => (acc.has(u.upazilaId) ? acc : acc.add(u.upazilaId)), new Set())
            .size,
          unions: flatDataset.length,
        },
      },
      flat: flatDataset,
      hierarchical: hierarchicalDataset,
      indexes: lookupIndexes,
    };

    // Write to file
    const outputPath = path.join(__dirname, '..', '..', 'data', 'location-dataset.json');
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(completeDataset, null, 2));

    console.log('\n✅ Dataset generated successfully!\n');
    console.log(`📁 Output: ${outputPath}`);
    console.log(`\n📈 Dataset Summary:`);
    console.log(`   - Divisions: ${completeDataset.metadata.counts.divisions}`);
    console.log(`   - Districts: ${completeDataset.metadata.counts.districts}`);
    console.log(`   - Upazilas: ${completeDataset.metadata.counts.upazilas}`);
    console.log(`   - Unions: ${completeDataset.metadata.counts.unions}`);
    console.log(`\n💾 File Size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('❌ Error generating dataset:', error.message);
    process.exit(1);
  }
};

main();
