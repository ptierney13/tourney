import type { Message } from 'discord.js';

const PIN_WARNING =
  'I could not pin the tournament status post. If you want it pinned, make sure the bot can manage messages in this thread.';

export async function syncPinnedStatusMessage(options: {
  message: Message;
  previousPinnedMessageId?: string | null;
}): Promise<{ warning: string | null }> {
  if (
    options.previousPinnedMessageId &&
    options.previousPinnedMessageId !== options.message.id
  ) {
    try {
      const previousMessage = await options.message.channel.messages.fetch(
        options.previousPinnedMessageId
      );

      if (previousMessage.pinned) {
        await previousMessage.unpin();
      }
    } catch {
      // Ignore failures while cleaning up an older pinned message. The latest
      // status post is still more important to keep moving forward with.
    }
  }

  try {
    if (!options.message.pinned) {
      await options.message.pin();
    }

    return { warning: null };
  } catch {
    return { warning: PIN_WARNING };
  }
}
