import {
  ChannelType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel
} from 'discord.js';

import { openDm, promptForText } from '../dm';
import { tournamentStore } from '../store';
import { buildTournament, buildTournamentThreadName } from '../tournaments';
import type { TourneyCommand } from '../types';

function canCreateThreads(channel: ChatInputCommandInteraction['channel']): channel is TextChannel {
  return Boolean(channel && channel.type === ChannelType.GuildText);
}

export const tourneyCommand: TourneyCommand = {
  data: new SlashCommandBuilder()
    .setName('tourney')
    .setDescription('Create a tournament thread after a short DM setup.'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!canCreateThreads(interaction.channel)) {
      await interaction.editReply(
        'This command currently works in standard server text channels where I can create a thread.'
      );
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

    await interaction.editReply('I sent you a DM to set up your tournament.');

    const tournamentName = await promptForText({
      channel: dmChannel,
      userId: interaction.user.id,
      prompt: 'What is the name of your tournament?',
      invalidPrompt: 'Please send a non-empty tournament name.'
    });

    if (!tournamentName) {
      return;
    }

    const threadName = buildTournamentThreadName(tournamentName);

    const thread = await interaction.channel.threads.create({
      name: threadName,
      autoArchiveDuration: 1440,
      reason: `Tournament created by ${interaction.user.username}`
    });

    const tournament = buildTournament({
      name: tournamentName,
      creator: interaction.user,
      sourceChannelId: interaction.channel.id,
      threadId: thread.id,
      threadName
    });

    await tournamentStore.createTournament(tournament);

    await dmChannel.send(`Created your tournament thread: <#${thread.id}>`);
    await interaction.editReply(`Tournament created. Head to <#${thread.id}> to collect submissions.`);
  }
};
