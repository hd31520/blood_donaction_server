/**
 * Example usage of the Location Dataset Service
 * This file demonstrates practical applications
 */

/* eslint-disable no-console */

import { locationDatasetService } from '../services/location-dataset.service.js';

// ============================================================================
// EXAMPLE 1: Form Validation with Hierarchy Check
// ============================================================================

export const validateLocationSelection = (selectionData) => {
  const { unionId, upazilaId, districtId, divisionId } = selectionData;

  // Quick validation - all IDs should form a valid hierarchy
  const isValid = locationDatasetService.validateHierarchy(
    unionId,
    upazilaId,
    districtId,
    divisionId,
  );

  if (!isValid) {
    throw new Error('Invalid location hierarchy selected');
  }

  // Get additional context if needed
  const locationPath = locationDatasetService.getLocationPath(unionId);
  console.log(`User selected: ${locationPath.path}`);

  return true;
};

// ============================================================================
// EXAMPLE 2: Populate Cascading Dropdowns
// ============================================================================

export const getCascadeData = () => {
  // Load divisions (first dropdown)
  const divisions = locationDatasetService.getAllDivisions();

  return {
    divisions: divisions.map((d) => ({
      id: d.id,
      label: d.name,
      labelBn: d.bnName,
    })),

    // Get districts for a division
    getDistricts: (divisionId) => {
      const districts = locationDatasetService.getDistrictsByDivision(divisionId);
      return districts.map((d) => ({
        id: d.id,
        label: d.name,
        labelBn: d.bnName,
      }));
    },

    // Get upazilas for a district
    getUpazilas: (districtId) => {
      const upazilas = locationDatasetService.getUpazilasByDistrict(districtId);
      return upazilas.map((u) => ({
        id: u.id,
        label: u.name,
        labelBn: u.bnName,
      }));
    },

    // Get unions for an upazila
    getUnions: (upazilaId) => {
      const unions = locationDatasetService.getUnionsByUpazila(upazilaId);
      return unions.map((u) => ({
        id: u.id,
        label: u.name,
        labelBn: u.bnName,
      }));
    },
  };
};

// Usage in React:
/*
const LocationForm = () => {
  const cascadeData = getCascadeData();
  const [division, setDivision] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');
  const [union, setUnion] = useState('');

  const districts = division ? cascadeData.getDistricts(division) : [];
  const upazilas = district ? cascadeData.getUpazilas(district) : [];
  const unions = upazila ? cascadeData.getUnions(upazila) : [];

  return (
    <>
      <select value={division} onChange={e => setDivision(e.target.value)}>
        <option>Select Division</option>
        {cascadeData.divisions.map(d => (
          <option key={d.id} value={d.id}>{d.label}</option>
        ))}
      </select>

      <select value={district} onChange={e => setDistrict(e.target.value)}>
        <option>Select District</option>
        {districts.map(d => (
          <option key={d.id} value={d.id}>{d.label}</option>
        ))}
      </select>

      <select value={upazila} onChange={e => setUpazila(e.target.value)}>
        <option>Select Upazila</option>
        {upazilas.map(u => (
          <option key={u.id} value={u.id}>{u.label}</option>
        ))}
      </select>

      <select value={union} onChange={e => setUnion(e.target.value)}>
        <option>Select Union</option>
        {unions.map(u => (
          <option key={u.id} value={u.id}>{u.label}</option>
        ))}
      </select>
    </>
  );
};
*/

// ============================================================================
// EXAMPLE 3: API Endpoint - Location Search
// ============================================================================

export const locationSearchEndpoint = (req, res) => {
  const { q, limit = 50 } = req.query;

  if (!q || q.length < 2) {
    return res.json([]);
  }

  const results = locationDatasetService.searchUnions(q, limit);

  // Enrich results with hierarchy information
  const enriched = results.map((union) => {
    const upazila = locationDatasetService.findUpazila(union.upazilaId);
    const district = locationDatasetService.findDistrict(union.districtId);
    const division = locationDatasetService.findDivision(union.divisionId);

    return {
      id: union.id,
      name: union.name,
      bnName: union.bnName,
      code: union.code,
      hierarchy: {
        division: division.name,
        district: district.name,
        upazila: upazila.name,
      },
      hierarchyBn: {
        division: division.bnName,
        district: district.bnName,
        upazila: upazila.bnName,
      },
    };
  });

  res.json({
    success: true,
    data: enriched,
  });
};

// ============================================================================
// EXAMPLE 4: Donor Profile - Get Full Address Display
// ============================================================================

export const getFormattedDonorLocation = (locationIds) => {
  const { unionId } = locationIds;

  const locationPath = locationDatasetService.getLocationPath(unionId);

  if (!locationPath) {
    return null;
  }

  // Format for display
  return {
    english: locationPath.path,
    bengali: locationPath.pathBn,
    components: {
      division: locationPath.division.name,
      district: locationPath.district.name,
      upazila: locationPath.upazila.name,
      union: locationPath.union.name,
    },
    componentsBn: {
      division: locationPath.division.bnName,
      district: locationPath.district.bnName,
      upazila: locationPath.upazila.bnName,
      union: locationPath.union.bnName,
    },
  };
};

// ============================================================================
// EXAMPLE 5: Export Location Statistics
// ============================================================================

export const getLocationStats = () => {
  const stats = locationDatasetService.getStats();
  const metadata = locationDatasetService.getMetadata();

  console.log('Location Dataset Statistics:');
  console.log(`Generated: ${metadata.generatedAt}`);
  console.log(`Total Divisions: ${metadata.counts.divisions}`);
  console.log(`Total Districts: ${metadata.counts.districts}`);
  console.log(`Total Upazilas: ${metadata.counts.upazilas}`);
  console.log(`Total Unions: ${metadata.counts.unions}`);
  console.log(`Dataset Size: ${stats.sizeKB} KB`);

  return stats;
};

// ============================================================================
// EXAMPLE 6: Build Lookup Map for Client-Side Cache
// ============================================================================

export const buildClientLocationCache = () => {
  // This can be sent to the client once and cached
  const allUnions = locationDatasetService.getAllUnions();
  const allDivisions = locationDatasetService.getAllDivisions();
  const hierarchy = locationDatasetService.getFullHierarchy();

  return {
    divisions: allDivisions, // For division selector
    hierarchy: hierarchy, // For tree/cascading viewers
    unions: allUnions, // For search/autocomplete

    // Lookup functions (to be used on client)
    findUnion: (id) => allUnions.find((u) => u.id === id),
    findDivision: (id) => allDivisions.find((d) => d.id === id),
    getHierarchyPath: (unionId) => {
      for (const division of hierarchy) {
        for (const district of division.districts) {
          for (const upazila of district.upazilas) {
            for (const union of upazila.unions) {
              if (union.id === unionId) {
                return {
                  division,
                  district,
                  upazila,
                  union,
                };
              }
            }
          }
        }
      }
      return null;
    },
  };
};

// ============================================================================
// EXAMPLE 7: Filter Donors by Location
// ============================================================================

export const filterDonorsByLocation = (donors, filterCriteria) => {
  const { divisionId, districtId, upazilaId } = filterCriteria;

  return donors.filter((donor) => {
    // Get donor's location hierarchy
    const location = locationDatasetService.getLocationPath(donor.unionId);

    if (!location) return false;

    // Apply filters
    if (divisionId && location.division.id !== divisionId) return false;
    if (districtId && location.district.id !== districtId) return false;
    if (upazilaId && location.upazila.id !== upazilaId) return false;

    return true;
  });
};

// Usage:
/*
const filteredDonors = filterDonorsByLocation(donors, {
  divisionId: 1,
  districtId: 1,
  // upazilaId: 5, // optional
});
*/

// ============================================================================
// EXAMPLE 8: Validate Location Against Database
// ============================================================================

export const validateLocationAgainstDataset = (dbLocation) => {
  const { divisionId, districtId, upazilaId, unionId } = dbLocation;

  const isHierarchyValid = locationDatasetService.validateHierarchy(
    unionId,
    upazilaId,
    districtId,
    divisionId,
  );

  if (!isHierarchyValid) {
    console.warn(`Invalid location hierarchy in database:`);
    console.warn(`  Union: ${unionId}`);
    console.warn(`  Upazila: ${upazilaId}`);
    console.warn(`  District: ${districtId}`);
    console.warn(`  Division: ${divisionId}`);
    return false;
  }

  return true;
};

// ============================================================================
// EXAMPLE 9: Get Nearby Locations (Same upazila)
// ============================================================================

export const getNearbyUnions = (unionId) => {
  const union = locationDatasetService.findUnion(unionId);

  if (!union) {
    return null;
  }

  // Get all unions in the same upazila
  const nearbyUnions = locationDatasetService.getUnionsByUpazila(union.upazilaId);

  return {
    origin: union,
    nearby: nearbyUnions.filter((u) => u.id !== unionId),
    count: nearbyUnions.length - 1,
  };
};

// ============================================================================
// EXAMPLE 10: Performance Monitoring
// ============================================================================

export const benchmarkLocationLookups = () => {
  const start = performance.now();

  // Warm-up
  locationDatasetService.getAllDivisions();

  // Test various operations
  const operations = [
    () => locationDatasetService.findUnion(1),
    () => locationDatasetService.findUnion(2000),
    () => locationDatasetService.findUnion(4554),
    () => locationDatasetService.getUnionsByUpazila(1),
    () => locationDatasetService.searchUnions('Dhaka', 10),
    () => locationDatasetService.getLocationPath(1),
    () => locationDatasetService.validateHierarchy(1, 1, 1, 1),
  ];

  const times = operations.map((op) => {
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      op();
    }
    return performance.now() - t0;
  });

  const end = performance.now();

  console.log('Location Dataset Performance Benchmarks:');
  console.log(`Total time: ${(end - start).toFixed(2)}ms for 7000 operations`);
  console.log(`Average: ${(times.reduce((a, b) => a + b) / times.length / 1000).toFixed(3)}ms per op`);

  return {
    totalTime: end - start,
    operationTimes: times,
  };
};
