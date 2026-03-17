import {
  ChannelType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type DMChannel,
  type SlashCommandOptionsOnlyBuilder
} from 'discord.js';

import {
  buildSubmission,
  DM_PROMPT,
  formatAcknowledgement,
  normalizeResponse
} from '../submission';
import type { Submission } from '../types';

const RESPONSE_TIMEOUT_MS = 5 * 60 * 1000;

export const submitCommand = {
  data: new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Start a DM flow and capture one free-form response.'),
  async execute(interaction: ChatInputCommandInteraction): Promise<Submission | null> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let dmChannel: DMChannel;

    try {
      dmChannel = await interaction.user.createDM();
    } catch {
      await interaction.editReply(
        'I could not open a DM with you. Please enable direct messages and try again.'
      );
      return null;
    }

    await interaction.editReply(
      'I sent you a DM. Please reply there with one message within five minutes.'
    );

    await dmChannel.send(DM_PROMPT);

    try {
      const collected = await dmChannel.awaitMessages({
        filter: (message) =>
          message.author.id === interaction.user.id &&
          message.channel.type === ChannelType.DM &&
          normalizeResponse(message.content).length > 0,
        max: 1,
        time: RESPONSE_TIMEOUT_MS,
        errors: ['time']
      });

      const responseMessage = collected.first();

      if (!responseMessage) {
        await dmChannel.send('I did not receive a valid response. Please run `/submit` again.');
        return null;
      }

      const submission = buildSubmission({
        interactionId: interaction.id,
        user: interaction.user,
        message: responseMessage
      });

      await dmChannel.send(formatAcknowledgement(submission));
      return submission;
    } catch {
      await dmChannel.send('Timed out waiting for your response. Please run `/submit` again.');
      return null;
    }
  }
};

export const submitCommandData =
  submitCommand.data satisfies SlashCommandOptionsOnlyBuilder | SlashCommandBuilder;
