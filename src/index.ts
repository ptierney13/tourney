import { createBotClient } from './bot';
import { loadConfig } from './config';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = createBotClient();

  await client.login(config.token);
}

void main().catch((error) => {
  console.error('Failed to start the bot.', error);
  process.exitCode = 1;
});
