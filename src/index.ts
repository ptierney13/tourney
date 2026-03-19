import { createBotClient } from './bot';
import { startTournamentPublishFlow } from './commands/publish';
import { loadConfig } from './config';
import { startOrganizerServer } from './organizerServer';
import { tournamentStore } from './store';
import { syncTournamentThreadSummary } from './tournamentThreadSummary';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = createBotClient();

  await client.login(config.token);
  await startOrganizerServer({
    host: config.organizerHost,
    port: config.organizerPort,
    publicBaseUrl: config.organizerBaseUrl,
    tournamentStore,
    async onTournamentChanged(tournament) {
      await syncTournamentThreadSummary({
        client,
        tournament
      });
    },
    async onPublishRequested(tournament) {
      const thread = await client.channels.fetch(tournament.threadId);

      if (!thread?.isThread()) {
        throw new Error(
          `Tournament thread ${tournament.threadId} is not available.`
        );
      }

      const organizer = await client.users.fetch(tournament.creatorUserId);
      const result = await startTournamentPublishFlow({
        thread,
        organizer,
        tournament,
        requestedFrom: 'web'
      });

      if (result.status === 'dm-unavailable') {
        return 'dm-unavailable';
      }

      if (result.status === 'no-submissions') {
        return 'no-submissions';
      }

      return 'started';
    }
  });
}

void main().catch((error) => {
  console.error('Failed to start the bot.', error);
  process.exitCode = 1;
});
