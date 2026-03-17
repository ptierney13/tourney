import type { Message, User } from 'discord.js';

import type { Submission } from './types';

export const DM_PROMPT =
  'Please reply with a single open-form response. I will capture your first message and acknowledge it.';

const ACK_PREVIEW_LIMIT = 300;

export function normalizeResponse(content: string): string {
  return content.trim().replace(/\s+/g, ' ');
}

export function buildSubmission(options: {
  interactionId: string;
  user: User;
  message: Message;
}): Submission {
  return {
    interactionId: options.interactionId,
    userId: options.user.id,
    username: options.user.username,
    channelId: options.message.channelId,
    response: normalizeResponse(options.message.content),
    receivedAt: options.message.createdAt.toISOString()
  };
}

export function formatAcknowledgement(submission: Submission): string {
  const preview =
    submission.response.length > ACK_PREVIEW_LIMIT
      ? `${submission.response.slice(0, ACK_PREVIEW_LIMIT - 3)}...`
      : submission.response;

  return `Thanks, ${submission.username}. I recorded your response:\n> ${preview}`;
}
