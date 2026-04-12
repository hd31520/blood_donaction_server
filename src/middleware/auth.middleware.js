import jwt from 'jsonwebtoken';

import {
  ROLE_LEVEL,
  USER_ROLES,
  canManageRole,
  hasPermission,
  isInManagedScope,
} from '../config/access-control.js';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../shared/utils/api-error.js';

const getBearerToken = (authorizationHeader = '') => {
  if (!authorizationHeader.startsWith('Bearer ')) {
    return null;
  }

  return authorizationHeader.slice('Bearer '.length).trim();
};

export const authenticate = (req, res, next) => {
  void res;

  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return next(new ApiError(401, 'Authentication token is required'));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return next(new ApiError(401, 'Invalid or expired token'));
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    void res;

    if (!req.user?.role) {
      return next(new ApiError(403, 'Access denied'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'Insufficient permissions'));
    }

    return next();
  };
};

export const authorizePermission = (permission) => {
  return (req, res, next) => {
    void res;

    if (!req.user?.role || !hasPermission(req.user.role, permission)) {
      return next(new ApiError(403, 'Insufficient permissions'));
    }

    return next();
  };
};

export const authorizeMinimumRole = (minimumRole) => {
  return (req, res, next) => {
    void res;

    if (!req.user?.role) {
      return next(new ApiError(403, 'Access denied'));
    }

    if (ROLE_LEVEL[req.user.role] < ROLE_LEVEL[minimumRole]) {
      return next(new ApiError(403, 'Insufficient hierarchy level'));
    }

    return next();
  };
};

export const attachCurrentUser = (req, res, next) => {
  void res;

  User.findById(req.user.sub)
    .then((currentUser) => {
      if (!currentUser) {
        return next(new ApiError(401, 'Authenticated user no longer exists'));
      }

      req.currentUser = currentUser;
      return next();
    })
    .catch(next);
};

export const authorizeTargetUserAccess = (paramName = 'userId') => {
  return (req, res, next) => {
    void res;

    User.findById(req.params[paramName])
      .then((targetUser) => {
        if (!targetUser) {
          return next(new ApiError(404, 'Target user not found'));
        }

        if (!isInManagedScope(req.currentUser, targetUser)) {
          return next(new ApiError(403, 'Target user is out of your administrative scope'));
        }

        if (
          req.currentUser.role !== USER_ROLES.SUPER_ADMIN &&
          !canManageRole(req.currentUser.role, targetUser.role)
        ) {
          return next(new ApiError(403, 'Cannot access users at equal or higher hierarchy'));
        }

        req.targetUser = targetUser;
        return next();
      })
      .catch(next);
  };
};
