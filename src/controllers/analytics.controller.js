import { StatusCodes } from 'http-status-codes';

import { analyticsService } from '../services/analytics.service.js';
import { asyncHandler } from '../shared/utils/async-handler.js';

export const trackVisit = asyncHandler(async (req, res) => {
  const data = await analyticsService.trackVisit({
    sessionId: req.body?.sessionId,
    path: req.body?.path || '/',
    referrer: req.headers.referer || '',
    userAgent: req.headers['user-agent'] || '',
  });

  res.status(StatusCodes.CREATED).json({ success: true, data });
});

export const getVisitStats = asyncHandler(async (req, res) => {
  const data = await analyticsService.getVisitStats();
  res.status(StatusCodes.OK).json({ success: true, data });
});
