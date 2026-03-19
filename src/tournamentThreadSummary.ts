import type { Client } from 'discord.js';

import { syncPinnedStatusMessage } from './messagePins';
import { tournamentStore } from './store';
import { renderTournamentThreadSummary } from './tournaments';
import type { Tournament } from './types';

export async function syncTournamentThreadSummary(options: {
  client: Client;
  tournament: Tournament;
}): Promise<void> {
  const thread = await options.client.channels.fetch(options.tournament.threadId);

  if (!thread?.isThread()) {
    throw new Error(
      `Tournament thread ${options.tournament.threadId} is not available.`
    );
  }

  const content = renderTournamentThreadSummary(options.tournament);

  if (options.tournament.threadSummaryMessageId) {
    try {
      const existingMessage = await thread.messages.fetch(
        options.tournament.threadSummaryMessageId
      );
      await existingMessage.edit(content);
      await syncPinnedStatusMessage({
        message: existingMessage
      });
      return;
    } catch {
      // Recreate the summary message if the original post can no longer be fetched.
    }
  }

  const message = await thread.send(content);
  await syncPinnedStatusMessage({
    message,
    previousPinnedMessageId: options.tournament.threadSummaryMessageId
  });
  options.tournament.threadSummaryMessageId = message.id;
  await tournamentStore.saveTournament(options.tournament);
}
