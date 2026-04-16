import { USER_ROLES } from '../config/access-control.js';
import { UpazilaSettings } from '../models/upazila-settings.model.js';
import { ApiError } from '../shared/utils/api-error.js';

const sanitizeSettings = (doc) => ({
  id: doc._id,
  upazilaId: doc.upazilaId,
  districtId: doc.districtId,
  hasImgbbApiKey: Boolean(doc.imgbbApiKey),
  updatedBy: doc.updatedBy,
  updatedAt: doc.updatedAt,
});

export const upazilaSettingsService = {
  getMyImgbbSettings: async (actor) => {
    if (actor.role !== USER_ROLES.UPAZILA_ADMIN) {
      throw new ApiError(403, 'Only upazila admin can access this setting');
    }

    const settings = await UpazilaSettings.findOne({ upazilaId: actor.upazilaId });
    if (!settings) {
      return {
        upazilaId: actor.upazilaId,
        districtId: actor.districtId,
        hasImgbbApiKey: false,
      };
    }

    return sanitizeSettings(settings);
  },

  saveMyImgbbApiKey: async (actor, imgbbApiKey) => {
    if (actor.role !== USER_ROLES.UPAZILA_ADMIN) {
      throw new ApiError(403, 'Only upazila admin can set this setting');
    }

    const settings = await UpazilaSettings.findOneAndUpdate(
      { upazilaId: actor.upazilaId },
      {
        $set: {
          districtId: actor.districtId,
          imgbbApiKey,
          updatedBy: actor._id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return sanitizeSettings(settings);
  },
};
