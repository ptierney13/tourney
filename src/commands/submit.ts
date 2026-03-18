import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';

import { openDm, promptForChoice, promptForText } from '../dm';
import { tournamentStore } from '../store';
import {
  buildTournamentSubmission,
  getDefaultPlayerName
} from '../tournaments';
import type { TourneyCommand } from '../types';

export const submitCommand: TourneyCommand = {
  data: new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Submit or update a decklist for this tournament thread.'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.channel?.isThread()) {
      await interaction.editReply('This command only works inside a Tourney-created thread.');
      return;
    }

    const tournament = await tournamentStore.getTournamentByThreadId(interaction.channel.id);

    if (!tournament) {
      await interaction.editReply('This thread is not registered as a tournament thread.');
      return;
    }

    let dmChannel;

    try {
      dmChannel = await openDm(interaction.user);
    } catch {
      await interaction.editReply(
        'I could not open a DM with you. Please enable direct messages and try again.'
      );
      return;
    }

    await interaction.editReply('I sent you a DM to collect the decklist for this tournament.');

    const identityChoice = await promptForChoice({
      channel: dmChannel,
      userId: interaction.user.id,
      prompt:
        'Are you submitting for `self` or `other`? Reply with exactly `self` or `other`.',
      choices: ['self', 'other']
    });

    if (!identityChoice) {
      return;
    }

    const playerName =
      identityChoice === 'self'
        ? getDefaultPlayerName(interaction.user)
        : await promptForText({
            channel: dmChannel,
            userId: interaction.user.id,
            prompt: 'What player name should this decklist be stored under?',
            invalidPrompt: 'Please send a non-empty player name.'
          });

    if (!playerName) {
      return;
    }

    const decklist = await promptForText({
      channel: dmChannel,
      userId: interaction.user.id,
      prompt: `Send the decklist for ${playerName}.`,
      invalidPrompt: 'Please send a non-empty decklist.'
    });

    if (!decklist) {
      return;
    }

    const submission = buildTournamentSubmission({
      playerName,
      decklist,
      submitter: interaction.user
    });

    await tournamentStore.upsertSubmission({
      threadId: interaction.channel.id,
      submission
    });

    await dmChannel.send(
      `Saved the decklist for ${submission.playerName} in ${tournament.name}.`
    );
  }
};
