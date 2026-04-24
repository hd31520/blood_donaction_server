import { ensureDatabaseConnection } from '../config/db.js';
import { Visit } from '../models/visit.model.js';

const toVisitDate = (value = new Date()) => new Date(value).toISOString().slice(0, 10);

export const analyticsService = {
  trackVisit: async ({ sessionId, path, referrer, userAgent }) => {
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
};
