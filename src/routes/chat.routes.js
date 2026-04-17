import { Router } from 'express';

import {
  createOrGetChatThread,
  getChatMessages,
  getChatThreads,
  sendChatMessage,
} from '../controllers/chat.controller.js';
import { attachCurrentUser, authenticate } from '../middleware/auth.middleware.js';

export const chatRouter = Router();

chatRouter.use(authenticate, attachCurrentUser);

chatRouter.get('/threads', getChatThreads);
chatRouter.post('/threads', createOrGetChatThread);
chatRouter.get('/threads/:threadId/messages', getChatMessages);
chatRouter.post('/threads/:threadId/messages', sendChatMessage);
