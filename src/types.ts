import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder
} from 'discord.js';

export type TourneyCommand = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

export type Submission = {
  interactionId: string;
  userId: string;
  username: string;
  channelId: string;
  response: string;
  receivedAt: string;
};

export type TournamentSubmission = {
  playerName: string;
  normalizedPlayerName: string;
  decklist: string;
  submittedByUserId: string;
  submittedByUsername: string;
  submittedAt: string;
  placementText: string | null;
};

export type Tournament = {
  id: string;
  name: string;
  creatorUserId: string;
  creatorUsername: string;
  sourceChannelId: string;
  threadId: string;
  threadName: string;
  createdAt: string;
  publishedAt: string | null;
  publishedMessageId: string | null;
  submissions: Record<string, TournamentSubmission>;
};

export type TournamentStoreShape = {
  tournaments: Tournament[];
};
