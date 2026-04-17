import mongoose from 'mongoose';

const chatThreadSchema = new mongoose.Schema(
  {
    participants: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 2,
        message: 'Chat thread requires exactly 2 participants',
      },
    },
    participantKey: {
      type: String,
      required: true,
      index: true,
    },
    contextType: {
      type: String,
      enum: ['general', 'patient_request'],
      default: 'general',
    },
    contextRefId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastMessagePreview: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

chatThreadSchema.index({ participantKey: 1, contextType: 1, contextRefId: 1 }, { unique: true });
chatThreadSchema.index({ participants: 1, updatedAt: -1 });

export const ChatThread = mongoose.model('ChatThread', chatThreadSchema);
