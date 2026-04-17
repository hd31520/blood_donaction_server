import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { chatService } from '../services/chat.service.js';
import { asyncHandler } from '../shared/utils/async-handler.js';

const createThreadSchema = z.object({
  participantUserId: z.string().min(1),
  contextType: z.enum(['general', 'patient_request']).optional(),
  contextRefId: z.string().optional(),
});

const listMessagesSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export const getChatThreads = asyncHandler(async (req, res) => {
  const data = await chatService.getThreads(req.currentUser);

  res.status(StatusCodes.OK).json({
    success: true,
    data,
  });
});

export const createOrGetChatThread = asyncHandler(async (req, res) => {
  const payload = createThreadSchema.parse(req.body);
  const data = await chatService.createOrGetThread(req.currentUser, payload);

  res.status(StatusCodes.CREATED).json({
    success: true,
    data,
  });
});

export const getChatMessages = asyncHandler(async (req, res) => {
  const query = listMessagesSchema.parse(req.query);
  const result = await chatService.getMessages(req.currentUser, req.params.threadId, query);

  res.status(StatusCodes.OK).json({
    success: true,
    data: result.data,
    meta: result.meta,
  });
});

export const sendChatMessage = asyncHandler(async (req, res) => {
  const payload = sendMessageSchema.parse(req.body);
  const data = await chatService.sendMessage(req.currentUser, req.params.threadId, payload);

  res.status(StatusCodes.CREATED).json({
    success: true,
    data,
  });
});
