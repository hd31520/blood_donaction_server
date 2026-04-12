import { Router } from 'express';

import { createUser, getUsers } from '../controllers/user.controller.js';

export const userRouter = Router();

userRouter.get('/', getUsers);
userRouter.post('/', createUser);
