export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  DISTRICT_ADMIN: 'district_admin',
  UPAZILA_ADMIN: 'upazila_admin',
  UNION_LEADER: 'union_leader',
  DONOR: 'donor',
  FINDER: 'finder',
};

export const ROLE_LABELS = {
  [USER_ROLES.SUPER_ADMIN]: 'Super Admin',
  [USER_ROLES.DISTRICT_ADMIN]: 'District Admin',
  [USER_ROLES.UPAZILA_ADMIN]: 'Upazila Admin',
  [USER_ROLES.UNION_LEADER]: 'Union Leader',
  [USER_ROLES.DONOR]: 'Donor',
  [USER_ROLES.FINDER]: 'Finder',
};

export const ROLE_LEVEL = {
  [USER_ROLES.DONOR]: 1,
  [USER_ROLES.FINDER]: 1,
  [USER_ROLES.UNION_LEADER]: 2,
  [USER_ROLES.UPAZILA_ADMIN]: 3,
  [USER_ROLES.DISTRICT_ADMIN]: 4,
  [USER_ROLES.SUPER_ADMIN]: 5,
};

export const ROLE_PERMISSIONS = {
  [USER_ROLES.SUPER_ADMIN]: [
    'user:create:any',
    'user:read:any',
    'user:update:any',
    'user:delete:any',
    'donor:read:any',
    'donor:update:any',
    'donor:history:any',
    'blood-need:create',
    'blood-need:read',
    'blood-need:update:self',
    'blood-need:donate',
    'blood-need:cancel:self',
    'report:read:any',
    'notification:read:any',
    'notification:create:any',
  ],
  [USER_ROLES.DISTRICT_ADMIN]: [
    'user:create:district',
    'user:read:district',
    'user:update:district',
    'donor:read:district',
    'donor:history:district',
    'blood-need:create',
    'blood-need:read',
    'blood-need:update:self',
    'blood-need:donate',
    'blood-need:cancel:self',
    'report:read:district',
    'notification:read:district',
    'notification:create:district',
  ],
  [USER_ROLES.UPAZILA_ADMIN]: [
    'user:create:upazila',
    'user:read:upazila',
    'user:update:upazila',
    'donor:read:upazila',
    'donor:history:upazila',
    'blood-need:create',
    'blood-need:read',
    'blood-need:update:self',
    'blood-need:donate',
    'blood-need:cancel:self',
    'report:read:upazila',
    'notification:read:upazila',
    'notification:create:upazila',
  ],
  [USER_ROLES.UNION_LEADER]: [
    'user:create:union',
    'user:read:union',
    'user:update:union',
    'donor:read:union',
    'donor:history:union',
    'blood-need:create',
    'blood-need:read',
    'blood-need:update:self',
    'blood-need:donate',
    'blood-need:cancel:self',
    'report:read:union',
    'notification:read:union',
    'notification:create:union',
  ],
  [USER_ROLES.DONOR]: [
    'profile:read:self',
    'donor:read:self',
    'donor:update:self',
    'donor:history:self',
    'blood-need:create',
    'blood-need:read',
    'blood-need:update:self',
    'blood-need:donate',
    'blood-need:cancel:self',
    'notification:read:self',
  ],
  [USER_ROLES.FINDER]: [
    'profile:read:self',
    'donor:read:self',
    'donor:update:self',
    'donor:history:self',
    'blood-need:create',
    'blood-need:read',
    'blood-need:update:self',
    'blood-need:donate',
    'blood-need:cancel:self',
    'notification:read:self',
  ],
};

const SCOPE_LEVEL = {
  self: 1,
  union: 2,
  upazila: 3,
  district: 4,
  any: 5,
};

export const hasPermission = (role, permission) => {
  const requested = permission.split(':');
  const rolePermissions = ROLE_PERMISSIONS[role] ?? [];

  return rolePermissions.some((grantedPermission) => {
    const granted = grantedPermission.split(':');
    if (granted.length !== 3 || requested.length !== 3) {
      return grantedPermission === permission;
    }

    const [gResource, gAction, gScope] = granted;
    const [rResource, rAction, rScope] = requested;

    if (gResource !== rResource || gAction !== rAction) {
      return false;
    }

    return (SCOPE_LEVEL[gScope] ?? 0) >= (SCOPE_LEVEL[rScope] ?? 0);
  });
};

export const canManageRole = (actorRole, targetRole) => {
  return ROLE_LEVEL[actorRole] > ROLE_LEVEL[targetRole];
};

export const buildScopeFilter = (user) => {
  switch (user.role) {
    case USER_ROLES.SUPER_ADMIN:
      return {};
    case USER_ROLES.DISTRICT_ADMIN:
      return { districtId: user.districtId };
    case USER_ROLES.UPAZILA_ADMIN:
      return { districtId: user.districtId, upazilaId: user.upazilaId };
    case USER_ROLES.UNION_LEADER:
      return { districtId: user.districtId, upazilaId: user.upazilaId, unionId: user.unionId };
    default:
      return { _id: user._id };
  }
};

export const isInManagedScope = (actor, target) => {
  if (actor.role === USER_ROLES.SUPER_ADMIN) {
    return true;
  }

  if (actor.role === USER_ROLES.DISTRICT_ADMIN) {
    return String(actor.districtId) === String(target.districtId);
  }

  if (actor.role === USER_ROLES.UPAZILA_ADMIN) {
    return (
      String(actor.districtId) === String(target.districtId) &&
      String(actor.upazilaId) === String(target.upazilaId)
    );
  }

  if (actor.role === USER_ROLES.UNION_LEADER) {
    return (
      String(actor.districtId) === String(target.districtId) &&
      String(actor.upazilaId) === String(target.upazilaId) &&
      String(actor.unionId) === String(target.unionId)
    );
  }

  return String(actor._id) === String(target._id);
};
