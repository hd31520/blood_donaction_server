import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { reportService } from '../services/report.service.js';
import { asyncHandler } from '../shared/utils/async-handler.js';

const monthlyReportQuerySchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const getMonthlyDonorReport = asyncHandler(async (req, res) => {
  const query = monthlyReportQuerySchema.parse(req.query);

  if (query.format === 'csv') {
    const csv = await reportService.exportMonthlyDonorReport(req.currentUser, {
      year: query.year,
      month: query.month,
    });

    const filename = `monthly-donor-report-${query.year}-${String(query.month).padStart(2, '0')}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    return res.status(StatusCodes.OK).send(csv);
  }

  const report = await reportService.getMonthlyDonorReport(req.currentUser, {
    year: query.year,
    month: query.month,
  });

  return res.status(StatusCodes.OK).json({
    success: true,
    data: report,
  });
});
