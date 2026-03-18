import { randomUUID } from 'node:crypto';

import type { User } from 'discord.js';

import { normalizeFreeformText } from './dm';
import type { Tournament, TournamentSubmission } from './types';

const THREAD_NAME_LIMIT = 100;

export function normalizePlayerName(name: string): string {
  return normalizeFreeformText(name).replace(/\s+/g, ' ').toLowerCase();
}

export function buildTournament(options: {
  name: string;
  creator: User;
  sourceChannelId: string;
  threadId: string;
  threadName: string;
}): Tournament {
  return {
    id: randomUUID(),
    name: normalizeFreeformText(options.name),
    creatorUserId: options.creator.id,
    creatorUsername: options.creator.username,
    sourceChannelId: options.sourceChannelId,
    threadId: options.threadId,
    threadName: options.threadName,
    createdAt: new Date().toISOString(),
    publishedAt: null,
    publishedMessageId: null,
    submissions: {}
  };
}

export function buildTournamentSubmission(options: {
  playerName: string;
  decklist: string;
  submitter: User;
}): TournamentSubmission {
  return {
    playerName: normalizeFreeformText(options.playerName),
    normalizedPlayerName: normalizePlayerName(options.playerName),
    decklist: normalizeFreeformText(options.decklist),
    submittedByUserId: options.submitter.id,
    submittedByUsername: options.submitter.username,
    submittedAt: new Date().toISOString(),
    placementText: null
  };
}

export function buildTournamentThreadName(name: string): string {
  const base = normalizeFreeformText(name).replace(/\s+/g, ' ');
  const prefixed = `Tourney: ${base}`;
  return prefixed.slice(0, THREAD_NAME_LIMIT);
}

export function getDefaultPlayerName(user: User): string {
  return user.globalName?.trim() || user.username;
}

export function renderTournamentSummary(tournament: Tournament): string {
  const submissions = Object.values(tournament.submissions).sort((left, right) =>
    left.playerName.localeCompare(right.playerName)
  );

  const lines = [
    `# ${tournament.name}`,
    `Organizer: ${tournament.creatorUsername}`,
    `Deck submissions: ${submissions.length}`,
    ''
  ];

  if (submissions.length === 0) {
    lines.push('No decklists have been submitted yet.');
    return lines.join('\n');
  }

  for (const submission of submissions) {
    lines.push(`## ${submission.playerName}`);

    if (submission.placementText) {
      lines.push(`Placement/Score: ${submission.placementText}`);
    }

    lines.push(submission.decklist);
    lines.push('');
  }

  return lines.join('\n').trim();
}
