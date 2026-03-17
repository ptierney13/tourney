import { REST, Routes } from 'discord.js';

import { commands } from '../commands';
import { loadConfig } from '../config';

async function main(): Promise<void> {
  const config = loadConfig();
  const rest = new REST().setToken(config.token);

  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: commands.map((command) => command.data.toJSON())
  });

  console.log(`Registered ${commands.length} guild command(s) for ${config.guildId}.`);
}

void main().catch((error) => {
  console.error('Failed to register commands.', error);
  process.exitCode = 1;
});
