/**
 * Location Dataset Query Service
 *
 * Provides fast, in-memory querying of Bangladesh location data
 * without requiring database calls. Useful for autocomplete, validation,
 * and cascading dropdowns on the client side.
 *
 * Features:
 * - O(1) lookup by ID for any location
 * - Hierarchical traversal (division → district → upazila → union)
 * - Search by name or code
 * - Enriched union data with all parent references
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedDataset = null;

const loadDataset = () => {
  if (cachedDataset) {
    return cachedDataset;
  }

  const dataPath = path.join(__dirname, '..', '..', 'data', 'location-dataset.json');

  if (!fs.existsSync(dataPath)) {
    throw new Error(
      `Location dataset not found at ${dataPath}. Run: npm run generate:location-data`,
    );
  }

  const rawData = fs.readFileSync(dataPath, 'utf-8');
  cachedDataset = JSON.parse(rawData);
  return cachedDataset;
};

export const locationDatasetService = {
  /**
   * Get complete dataset (use sparingly)
   */
  getDataset: () => loadDataset(),

  /**
   * Get metadata (counts, generated timestamp)
   */
  getMetadata: () => loadDataset().metadata,

  /**
   * Find a union by ID with all parent references
   * @param {number} unionId
   * @returns {Object|null} - Union with divisionId, districtId, upazilaId
   */
  findUnion: (unionId) => {
    const dataset = loadDataset();
    return dataset.indexes.unions[unionId] || null;
  },

  /**
   * Find an upazila by ID with parent references
   * @param {number} upazilaId
   * @returns {Object|null} - Upazila with districtId, divisionId
   */
  findUpazila: (upazilaId) => {
    const dataset = loadDataset();
    return dataset.indexes.upazilas[upazilaId] || null;
  },

  /**
   * Find a district by ID with parent reference
   * @param {number} districtId
   * @returns {Object|null} - District with divisionId
   */
  findDistrict: (districtId) => {
    const dataset = loadDataset();
    return dataset.indexes.districts[districtId] || null;
  },

  /**
   * Find a division by ID
   * @param {number} divisionId
   * @returns {Object|null}
   */
  findDivision: (divisionId) => {
    const dataset = loadDataset();
    return dataset.indexes.divisions[divisionId] || null;
  },

  /**
   * Get all unions for a specific upazila
   * @param {number} upazilaId
   * @returns {Array<Object>} - Array of unions with all parent references
   */
  getUnionsByUpazila: (upazilaId) => {
    const dataset = loadDataset();
    return dataset.flat.filter((union) => union.upazilaId === upazilaId);
  },

  /**
   * Get all upazilas for a specific district
   * @param {number} districtId
   * @returns {Array<Object>}
   */
  getUpazilasByDistrict: (districtId) => {
    const dataset = loadDataset();
    const indexes = dataset.indexes.upazilas;
    return Object.values(indexes).filter((upazila) => upazila.districtId === districtId);
  },

  /**
   * Get all districts for a specific division
   * @param {number} divisionId
   * @returns {Array<Object>}
   */
  getDistrictsByDivision: (divisionId) => {
    const dataset = loadDataset();
    const indexes = dataset.indexes.districts;
    return Object.values(indexes).filter((district) => district.divisionId === divisionId);
  },

  /**
   * Get all divisions
   * @returns {Array<Object>}
   */
  getAllDivisions: () => {
    const dataset = loadDataset();
    return Object.values(dataset.indexes.divisions);
  },

  /**
   * Get hierarchical data starting from a division
   * @param {number} divisionId
   * @returns {Object|null} - Division with nested districts, upazilas, and unions
   */
  getHierarchyByDivision: (divisionId) => {
    const dataset = loadDataset();
    return dataset.hierarchical.find((div) => div.id === divisionId) || null;
  },

  /**
   * Get complete hierarchy
   * @returns {Array<Object>} - All divisions with nested structure
   */
  getFullHierarchy: () => {
    const dataset = loadDataset();
    return dataset.hierarchical;
  },

  /**
   * Search unions by partial name match (client-side)
   * @param {string} searchTerm
   * @param {number} limit - Max results to return
   * @returns {Array<Object>}
   */
  searchUnions: (searchTerm, limit = 50) => {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    const dataset = loadDataset();
    const term = searchTerm.toLowerCase();

    return dataset.flat
      .filter(
        (union) =>
          union.name.toLowerCase().includes(term) ||
          union.bnName?.toLowerCase().includes(term) ||
          union.code.toLowerCase().includes(term),
      )
      .slice(0, limit);
  },

  /**
   * Get all locations in flat array with parent references
   * Useful for building autocomplete or indexed searches
   * @returns {Array<Object>} - All unions with complete parent references
   */
  getAllUnions: () => {
    const dataset = loadDataset();
    return dataset.flat;
  },

  /**
   * Get location path from union to division
   * @param {number} unionId
   * @returns {Object|null} - Object with union, upazila, district, division hierarchy
   */
  getLocationPath: (unionId) => {
    const dataset = loadDataset();
    const union = dataset.indexes.unions[unionId];

    if (!union) {
      return null;
    }

    const upazila = dataset.indexes.upazilas[union.upazilaId];
    const district = dataset.indexes.districts[union.districtId];
    const division = dataset.indexes.divisions[union.divisionId];

    return {
      union,
      upazila,
      district,
      division,
      path: `${division.name} > ${district.name} > ${upazila.name} > ${union.name}`,
      pathBn: `${division.bnName} > ${district.bnName} > ${upazila.bnName} > ${union.bnName}`,
    };
  },

  /**
   * Validate if a union-upazila-district-division hierarchy is correct
   * @param {number} unionId
   * @param {number} upazilaId
   * @param {number} districtId
   * @param {number} divisionId
   * @returns {boolean}
   */
  validateHierarchy: (unionId, upazilaId, districtId, divisionId) => {
    const dataset = loadDataset();
    const union = dataset.indexes.unions[unionId];

    if (!union) return false;

    return (
      union.upazilaId === upazilaId &&
      union.districtId === districtId &&
      union.divisionId === divisionId
    );
  },

  /**
   * Get statistics about the dataset
   * @returns {Object}
   */
  getStats: () => {
    const dataset = loadDataset();
    return {
      metadata: dataset.metadata,
      sizeKB: (JSON.stringify(dataset).length / 1024).toFixed(2),
      generatedAt: dataset.metadata.generatedAt,
    };
  },
};
