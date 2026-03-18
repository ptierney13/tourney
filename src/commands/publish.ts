import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';

import { openDm, promptForChoice, promptForText } from '../dm';
import { tournamentStore } from '../store';
import { renderTournamentSummary } from '../tournaments';
import type { TourneyCommand } from '../types';

export const publishCommand: TourneyCommand = {
  data: new SlashCommandBuilder()
    .setName('publish')
    .setDescription('Publish or update the tournament summary for this thread.'),
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

    if (tournament.creatorUserId !== interaction.user.id) {
      await interaction.editReply('Only the tournament creator can publish this thread.');
      return;
    }

    const submissions = await tournamentStore.listSubmissions(interaction.channel.id);

    if (submissions.length === 0) {
      await interaction.editReply('There are no deck submissions to publish yet.');
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

    await interaction.editReply('I sent you a DM to walk through tournament publishing.');

    for (const submission of submissions) {
      const includePlacement = await promptForChoice({
        channel: dmChannel,
        userId: interaction.user.id,
        prompt: `For ${submission.playerName}, reply \`yes\` to include placement/score text or \`no\` to skip.`,
        choices: ['yes', 'no']
      });

      if (!includePlacement) {
        return;
      }

      if (includePlacement === 'yes') {
        const placementText = await promptForText({
          channel: dmChannel,
          userId: interaction.user.id,
          prompt: `Send the placement or score text for ${submission.playerName}.`,
          invalidPrompt: 'Please send a non-empty placement or score value.'
        });

        if (!placementText) {
          return;
        }

        await tournamentStore.updateSubmissionPlacement({
          threadId: interaction.channel.id,
          normalizedPlayerName: submission.normalizedPlayerName,
          placementText
        });
      } else {
        await tournamentStore.updateSubmissionPlacement({
          threadId: interaction.channel.id,
          normalizedPlayerName: submission.normalizedPlayerName,
          placementText: null
        });
      }
    }

    const updatedTournament = await tournamentStore.getTournamentByThreadId(interaction.channel.id);

    if (!updatedTournament) {
      await dmChannel.send('Something went wrong while loading the tournament for publishing.');
      return;
    }

    const content = renderTournamentSummary(updatedTournament);

    let publishedMessageId = updatedTournament.publishedMessageId;

    if (publishedMessageId) {
      try {
        const existingMessage = await interaction.channel.messages.fetch(publishedMessageId);
        await existingMessage.edit(content);
      } catch {
        const newMessage = await interaction.channel.send(content);
        publishedMessageId = newMessage.id;
      }
    } else {
      const newMessage = await interaction.channel.send(content);
      publishedMessageId = newMessage.id;
    }

    await tournamentStore.savePublishMetadata({
      threadId: interaction.channel.id,
      publishedMessageId,
      publishedAt: new Date().toISOString()
    });

    await dmChannel.send(`Published the tournament summary in <#${interaction.channel.id}>.`);
  }
};
