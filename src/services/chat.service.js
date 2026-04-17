import mongoose from 'mongoose';

import { ChatMessage } from '../models/chat-message.model.js';
import { ChatThread } from '../models/chat-thread.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../shared/utils/api-error.js';

const buildParticipantKey = (a, b) => {
  return [String(a), String(b)].sort().join(':');
};

const isThreadParticipant = (thread, userId) => {
  return thread.participants.some((participantId) => String(participantId) === String(userId));
};

const sanitizeThread = (thread, currentUserId) => {
  const participants = thread.participants || [];
  const otherParticipant = participants.find(
    (participant) => String(participant?._id || participant) !== String(currentUserId),
  );

  return {
    id: thread._id,
    contextType: thread.contextType,
    contextRefId: thread.contextRefId || null,
    lastMessageAt: thread.lastMessageAt || thread.updatedAt,
    lastMessagePreview: thread.lastMessagePreview || '',
    otherParticipant: otherParticipant
      ? {
          id: otherParticipant._id || otherParticipant,
          name: otherParticipant.name || 'User',
          role: otherParticipant.role || null,
          profileImageUrl: otherParticipant.profileImageUrl || null,
        }
      : null,
    updatedAt: thread.updatedAt,
    createdAt: thread.createdAt,
  };
};

const sanitizeMessage = (message) => {
  return {
    id: message._id,
    threadId: message.threadId,
    senderUserId: message.senderUserId,
    content: message.content,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
};

const validateContext = ({ contextType, contextRefId }) => {
  const normalizedContextType = contextType || 'general';

  if (!['general', 'patient_request'].includes(normalizedContextType)) {
    throw new ApiError(400, 'contextType must be general or patient_request');
  }

  if (normalizedContextType === 'patient_request') {
    if (!contextRefId || !mongoose.isValidObjectId(contextRefId)) {
      throw new ApiError(400, 'contextRefId must be a valid id for patient_request context');
    }
  }

  return {
    contextType: normalizedContextType,
    contextRefId:
      normalizedContextType === 'patient_request' && contextRefId
        ? new mongoose.Types.ObjectId(contextRefId)
        : null,
  };
};

export const chatService = {
  getThreads: async (currentUser) => {
    const threads = await ChatThread.find({
      participants: currentUser._id,
    })
      .populate('participants', '_id name role profileImageUrl')
      .sort({ updatedAt: -1 })
      .lean();

    return threads.map((thread) => sanitizeThread(thread, currentUser._id));
  },

  createOrGetThread: async (currentUser, payload) => {
    const { participantUserId } = payload;

    if (!participantUserId || !mongoose.isValidObjectId(participantUserId)) {
      throw new ApiError(400, 'participantUserId must be a valid user id');
    }

    if (String(participantUserId) === String(currentUser._id)) {
      throw new ApiError(400, 'Cannot start chat with yourself');
    }

    const participantUser = await User.findById(participantUserId)
      .select('_id name role profileImageUrl')
      .lean();

    if (!participantUser) {
      throw new ApiError(404, 'Chat participant not found');
    }

    const context = validateContext({
      contextType: payload.contextType,
      contextRefId: payload.contextRefId,
    });

    const participantKey = buildParticipantKey(currentUser._id, participantUser._id);

    let thread = await ChatThread.findOne({
      participantKey,
      contextType: context.contextType,
      contextRefId: context.contextRefId,
    })
      .populate('participants', '_id name role profileImageUrl')
      .lean();

    if (!thread) {
      const created = await ChatThread.create({
        participants: [currentUser._id, participantUser._id],
        participantKey,
        contextType: context.contextType,
        contextRefId: context.contextRefId,
      });

      thread = await ChatThread.findById(created._id)
        .populate('participants', '_id name role profileImageUrl')
        .lean();
    }

    return sanitizeThread(thread, currentUser._id);
  },

  getMessages: async (currentUser, threadId, query = {}) => {
    if (!mongoose.isValidObjectId(threadId)) {
      throw new ApiError(400, 'Invalid thread id');
    }

    const thread = await ChatThread.findById(threadId).lean();
    if (!thread || !isThreadParticipant(thread, currentUser._id)) {
      throw new ApiError(404, 'Chat thread not found');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));

    const total = await ChatMessage.countDocuments({ threadId });

    const messages = await ChatMessage.find({ threadId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      data: [...messages].reverse().map(sanitizeMessage),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  sendMessage: async (currentUser, threadId, payload) => {
    if (!mongoose.isValidObjectId(threadId)) {
      throw new ApiError(400, 'Invalid thread id');
    }

    const thread = await ChatThread.findById(threadId);
    if (!thread || !isThreadParticipant(thread, currentUser._id)) {
      throw new ApiError(404, 'Chat thread not found');
    }

    const content = String(payload.content || '').trim();
    if (!content) {
      throw new ApiError(400, 'Message content is required');
    }

    const message = await ChatMessage.create({
      threadId: thread._id,
      senderUserId: currentUser._id,
      content,
    });

    thread.lastMessageAt = new Date();
    thread.lastMessagePreview = content.slice(0, 300);
    await thread.save();

    return sanitizeMessage(message);
  },
};
