import { Router } from 'express';

import { getMe, login, register, updateMe, uploadMyProfileImage } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authLimiter } from '../shared/middleware/rate-limiter.js';

export const authRouter = Router();

authRouter.post('/register', authLimiter, register);
authRouter.post('/login', authLimiter, login);
authRouter.get('/me', authenticate, getMe);
authRouter.put('/me', authenticate, updateMe);
authRouter.post('/me/profile-image', authenticate, uploadMyProfileImage);
