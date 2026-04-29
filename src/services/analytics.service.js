import { USER_ROLES } from '../config/access-control.js';
import { ensureDatabaseConnection } from '../config/db.js';
import { BloodNeed } from '../models/blood-need.model.js';
import { Visit } from '../models/visit.model.js';

const toVisitDate = (value = new Date()) => new Date(value).toISOString().slice(0, 10);

const normalizeObjectId = (value) => {
  const normalized = String(value || '').trim();
  return normalized || undefined;
};

const buildVisitLocation = (location = {}) => ({
  division: normalizeObjectId(location.divisionId || location.division),
  district: normalizeObjectId(location.districtId || location.district),
  upazila: normalizeObjectId(location.upazilaId || location.upazila),
  union: normalizeObjectId(location.unionId || location.union),
});

const removeEmptyValues = (value) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''),
);

const buildAdminBloodNeedScope = (user) => {
  switch (user?.role) {
    case USER_ROLES.SUPER_ADMIN:
      return {};
    case USER_ROLES.DISTRICT_ADMIN:
      return { 'location.district': user.districtId };
    case USER_ROLES.UPAZILA_ADMIN:
      return { 'location.district': user.districtId, 'location.upazila': user.upazilaId };
    case USER_ROLES.UNION_LEADER:
    case USER_ROLES.WARD_ADMIN:
      return { 'location.district': user.districtId, 'location.upazila': user.upazilaId, 'location.union': user.unionId };
    default:
      return { _id: null };
  }
};

const buildAdminVisitScope = (user) => {
  switch (user?.role) {
    case USER_ROLES.SUPER_ADMIN:
      return {};
    case USER_ROLES.DISTRICT_ADMIN:
      return { 'location.district': user.districtId };
    case USER_ROLES.UPAZILA_ADMIN:
      return { 'location.district': user.districtId, 'location.upazila': user.upazilaId };
    case USER_ROLES.UNION_LEADER:
    case USER_ROLES.WARD_ADMIN:
      return { 'location.district': user.districtId, 'location.upazila': user.upazilaId, 'location.union': user.unionId };
    default:
      return { _id: null };
  }
};

export const analyticsService = {
  trackVisit: async ({ sessionId, path, referrer, userAgent, location }) => {
    await ensureDatabaseConnection('analytics:trackVisit');

    const normalizedSessionId = String(sessionId || '').trim().slice(0, 120);
    const normalizedPath = String(path || '/').trim().slice(0, 300);

    if (!normalizedSessionId) {
      return null;
    }

    const item = await Visit.create({
      sessionId: normalizedSessionId,
      path: normalizedPath || '/',
      referrer: String(referrer || '').slice(0, 500),
      userAgent: String(userAgent || '').slice(0, 500),
      location: removeEmptyValues(buildVisitLocation(location)),
      visitDate: toVisitDate(),
    });

    return {
      id: item._id,
      sessionId: item.sessionId,
      path: item.path,
      visitDate: item.visitDate,
      visitedAt: item.visitedAt,
    };
  },

  getVisitStats: async () => {
    await ensureDatabaseConnection('analytics:getVisitStats');

    const today = toVisitDate();

    const [totalVisits, todayVisits, uniqueVisitors, todayUniqueVisitors, topPages, dailyVisits] = await Promise.all([
      Visit.countDocuments(),
      Visit.countDocuments({ visitDate: today }),
      Visit.distinct('sessionId').then((items) => items.length),
      Visit.distinct('sessionId', { visitDate: today }).then((items) => items.length),
      Visit.aggregate([
        { $group: { _id: '$path', visits: { $sum: 1 }, uniqueVisitors: { $addToSet: '$sessionId' } } },
        { $project: { path: '$_id', visits: 1, uniqueVisitors: { $size: '$uniqueVisitors' }, _id: 0 } },
        { $sort: { visits: -1 } },
        { $limit: 8 },
      ]),
      Visit.aggregate([
        { $group: { _id: '$visitDate', visits: { $sum: 1 }, uniqueVisitors: { $addToSet: '$sessionId' } } },
        { $project: { date: '$_id', visits: 1, uniqueVisitors: { $size: '$uniqueVisitors' }, _id: 0 } },
        { $sort: { date: -1 } },
        { $limit: 14 },
        { $sort: { date: 1 } },
      ]),
    ]);

    return {
      totalVisits,
      todayVisits,
      uniqueVisitors,
      todayUniqueVisitors,
      topPages,
      dailyVisits,
      generatedAt: new Date().toISOString(),
    };
  },

  getAdminAreaSummary: async (user) => {
    await ensureDatabaseConnection('analytics:getAdminAreaSummary');

    const bloodNeedScope = buildAdminBloodNeedScope(user);
    const visitScope = buildAdminVisitScope(user);
    const today = toVisitDate();
    const patientsPageFilter = { path: /^\/patients/, ...visitScope };

    const [
      totalBloodRequests,
      pendingBloodRequests,
      fulfilledBloodRequests,
      totalPatientPageVisits,
      uniquePatientVisitors,
      todayPatientPageVisits,
      dailyPatientVisits,
    ] = await Promise.all([
      BloodNeed.countDocuments(bloodNeedScope),
      BloodNeed.countDocuments({ ...bloodNeedScope, status: 'pending' }),
      BloodNeed.countDocuments({ ...bloodNeedScope, status: 'fulfilled' }),
      Visit.countDocuments(patientsPageFilter),
      Visit.distinct('sessionId', patientsPageFilter).then((items) => items.length),
      Visit.countDocuments({ ...patientsPageFilter, visitDate: today }),
      Visit.aggregate([
        { $match: patientsPageFilter },
        { $group: { _id: '$visitDate', visits: { $sum: 1 }, uniqueVisitors: { $addToSet: '$sessionId' } } },
        { $project: { date: '$_id', visits: 1, uniqueVisitors: { $size: '$uniqueVisitors' }, _id: 0 } },
        { $sort: { date: -1 } },
        { $limit: 14 },
        { $sort: { date: 1 } },
      ]),
    ]);

    return {
      scope: {
        role: user.role,
        divisionId: user.divisionId || null,
        districtId: user.districtId || null,
        upazilaId: user.upazilaId || null,
        unionId: user.unionId || null,
        locationNames: user.locationNames || {},
      },
      bloodRequests: {
        total: totalBloodRequests,
        pending: pendingBloodRequests,
        fulfilled: fulfilledBloodRequests,
      },
      patientVisitors: {
        totalVisits: totalPatientPageVisits,
        uniqueVisitors: uniquePatientVisitors,
        todayVisits: todayPatientPageVisits,
        dailyVisits: dailyPatientVisits,
      },
      generatedAt: new Date().toISOString(),
    };
  },
};
