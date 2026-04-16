import { Router } from 'express';

import { getMe, login, register, updateMe, uploadMyProfileImage } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.get('/me', authenticate, getMe);
authRouter.put('/me', authenticate, updateMe);
authRouter.post('/me/profile-image', authenticate, uploadMyProfileImage);
