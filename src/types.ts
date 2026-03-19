import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder
} from 'discord.js';

export const TOURNAMENT_FORMATS = [
  'Freeform',
  'Standard',
  'Pioneer',
  'Modern',
  'Legacy',
  'Vintage',
  'Pauper',
  'Commander',
  'Historic',
  'Explorer',
  'Timeless',
  'Brawl',
  'Alchemy'
] as const;

export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];
export type TournamentSetupMode = 'default' | 'custom';
export type SubmissionDisplayMode = 'count-only' | 'count-plus-names';
export type DeckEntryType = 'text' | 'url' | 'image';
export type PublishResultMode = 'none' | 'placement' | 'record';
export type OrganizerAccess = {
  tokenId: string;
  tokenSecretHash: string;
  createdAt: string;
};

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
  deckName: string;
  decklist: string;
  decklistType: DeckEntryType;
  submittedByUserId: string;
  submittedByUsername: string;
  submittedAt: string;
  placementText: string | null;
  recordText: string | null;
  archetype: string | null;
};

export type Tournament = {
  id: string;
  name: string;
  description: string | null;
  format: TournamentFormat;
  requireDeckVerification: boolean;
  submissionDisplayMode: SubmissionDisplayMode;
  setupMode: TournamentSetupMode;
  creatorUserId: string;
  creatorUsername: string;
  sourceChannelId: string;
  threadId: string;
  threadName: string;
  threadSummaryMessageId: string | null;
  organizerAccess: OrganizerAccess | null;
  createdAt: string;
  publishedAt: string | null;
  publishedMessageId: string | null;
  submissions: Record<string, TournamentSubmission>;
};

export type TournamentStoreShape = {
  tournaments: Tournament[];
};
