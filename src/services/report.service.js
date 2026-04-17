import { buildScopeFilter, USER_ROLES } from '../config/access-control.js';
import { ensureDatabaseConnection } from '../config/db.js';
import { DonorProfile } from '../models/donor-profile.model.js';
import { User } from '../models/user.model.js';
import { buildCacheKey, getOrSetCached } from '../shared/utils/query-cache.js';
import { ApiError } from '../shared/utils/api-error.js';

const REPORT_CACHE_TTL_MS = 5 * 60 * 1000;

const getMonthRange = (year, month) => {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start, end };
};

const toCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value).replace(/"/g, '""');
  return `"${stringValue}"`;
};

const toCsvRows = (rows) => {
  return rows.map((row) => row.map(toCsvValue).join(',')).join('\n');
};

const buildCsvReport = (report) => {
  const summaryRows = [
    ['metric', 'value'],
    ['year', report.year],
    ['month', report.month],
    ['periodStart', report.period.start],
    ['periodEnd', report.period.end],
    ['totalDonors', report.donorActivity.totalDonors],
    ['activeDonors', report.donorActivity.activeDonors],
    ['inactiveDonors', report.donorActivity.inactiveDonors],
    ['activityRate', report.donorActivity.activityRate],
    ['totalDonations', report.donationFrequency.totalDonations],
    ['averagePerActiveDonor', report.donationFrequency.averagePerActiveDonor],
    ['averagePerTotalDonor', report.donationFrequency.averagePerTotalDonor],
  ];

  const inactiveRows = [
    ['inactiveDonorUserId', 'name', 'email', 'phone', 'bloodGroup', 'lastDonationDate'],
    ...report.inactiveDonors.map((donor) => [
      donor.userId,
      donor.name,
      donor.email,
      donor.phone,
      donor.bloodGroup,
      donor.lastDonationDate || '',
    ]),
  ];

  return `${toCsvRows(summaryRows)}\n\n${toCsvRows(inactiveRows)}\n`;
};

export const reportService = {
  getMonthlyDonorReport: async (currentUser, { year, month }) => {
    await ensureDatabaseConnection('report:getMonthlyDonorReport');

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new ApiError(400, 'year must be a valid year between 2000 and 2100');
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new ApiError(400, 'month must be between 1 and 12');
    }

    const scope = buildScopeFilter(currentUser);
    const cacheKey = buildCacheKey('monthly-report', {
      userId: currentUser._id,
      role: currentUser.role,
      scope,
      year,
      month,
    });

    return getOrSetCached(cacheKey, REPORT_CACHE_TTL_MS, async () => {
      const { start, end } = getMonthRange(year, month);

      const scopedDonors = await User.find({ role: USER_ROLES.DONOR, ...scope })
        .select('_id name email phone')
        .lean();

      if (scopedDonors.length === 0) {
        return {
          year,
          month,
          period: { start: start.toISOString(), end: end.toISOString() },
          donorActivity: {
            totalDonors: 0,
            activeDonors: 0,
            inactiveDonors: 0,
            activityRate: 0,
          },
          donationFrequency: {
            totalDonations: 0,
            averagePerActiveDonor: 0,
            averagePerTotalDonor: 0,
          },
          inactiveDonors: [],
        };
      }

      const donorIds = scopedDonors.map((donor) => donor._id);

      const donationAggregation = await DonorProfile.aggregate([
      {
        $match: {
          userId: { $in: donorIds },
        },
      },
      {
        $project: {
          userId: 1,
          bloodGroup: 1,
          lastDonationDate: 1,
          donationHistory: {
            $filter: {
              input: '$donationHistory',
              as: 'history',
              cond: {
                $and: [
                  { $gte: ['$$history.donationDate', start] },
                  { $lt: ['$$history.donationDate', end] },
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          monthlyDonationCount: { $size: '$donationHistory' },
        },
      },
    ]);

      const profileMap = new Map(donationAggregation.map((item) => [String(item.userId), item]));

      const activeProfiles = donationAggregation.filter((item) => item.monthlyDonationCount > 0);
      const activeDonorUserIds = new Set(activeProfiles.map((item) => String(item.userId)));

      const totalDonors = scopedDonors.length;
      const activeDonors = activeDonorUserIds.size;
      const inactiveDonors = totalDonors - activeDonors;

      const totalDonations = activeProfiles.reduce((sum, item) => sum + item.monthlyDonationCount, 0);

      const inactiveDonorDetails = scopedDonors
        .filter((donor) => !activeDonorUserIds.has(String(donor._id)))
        .map((donor) => {
          const profile = profileMap.get(String(donor._id));
          return {
            userId: donor._id,
            name: donor.name,
            email: donor.email,
            phone: donor.phone,
            bloodGroup: profile?.bloodGroup || null,
            lastDonationDate: profile?.lastDonationDate ? new Date(profile.lastDonationDate).toISOString() : null,
          };
        });

      return {
        year,
        month,
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        donorActivity: {
          totalDonors,
          activeDonors,
          inactiveDonors,
          activityRate: totalDonors ? Number(((activeDonors / totalDonors) * 100).toFixed(2)) : 0,
        },
        donationFrequency: {
          totalDonations,
          averagePerActiveDonor: activeDonors ? Number((totalDonations / activeDonors).toFixed(2)) : 0,
          averagePerTotalDonor: totalDonors ? Number((totalDonations / totalDonors).toFixed(2)) : 0,
        },
        inactiveDonors: inactiveDonorDetails,
      };
    });
  },

  exportMonthlyDonorReport: async (currentUser, params) => {
    const report = await reportService.getMonthlyDonorReport(currentUser, params);
    return buildCsvReport(report);
  },
};
