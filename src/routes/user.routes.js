import { Router } from 'express';

import {
	createUserByAdmin,
	createUsersByAdminBulk,
	getUserById,
	getUsers,
	updateUserRoleByAdmin,
} from '../controllers/user.controller.js';
import {
	attachCurrentUser,
	authenticate,
	authorizeMinimumRole,
	authorizePermission,
	authorizeTargetUserAccess,
} from '../middleware/auth.middleware.js';
import { USER_ROLES } from '../config/access-control.js';

export const userRouter = Router();

userRouter.use(authenticate, attachCurrentUser);

userRouter.post(
	'/',
	authorizeMinimumRole(USER_ROLES.UNION_LEADER),
	authorizePermission('user:create:union'),
	createUserByAdmin,
);

userRouter.post(
	'/bulk',
	authorizeMinimumRole(USER_ROLES.UNION_LEADER),
	authorizePermission('user:create:union'),
	createUsersByAdminBulk,
);

userRouter.get(
	'/',
	authorizeMinimumRole(USER_ROLES.UNION_LEADER),
	authorizePermission('user:read:union'),
	getUsers,
);

userRouter.get(
	'/:userId',
	authorizeMinimumRole(USER_ROLES.UNION_LEADER),
	authorizePermission('user:read:union'),
	authorizeTargetUserAccess('userId'),
	getUserById,
);

userRouter.patch(
	'/:userId/role',
	authorizeMinimumRole(USER_ROLES.UNION_LEADER),
	authorizePermission('user:update:union'),
	authorizeTargetUserAccess('userId'),
	updateUserRoleByAdmin,
);
