import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type Interaction
} from 'discord.js';

import { commands } from './commands';

export function createBotClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commands.find(
      (entry) => entry.data.name === interaction.commandName
    );

    if (!command) {
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('Failed to handle slash command interaction.', error);

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: 'Something went wrong while handling that command.',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: 'Something went wrong while handling that command.',
          ephemeral: true
        });
      }
    }
  });

  return client;
}
