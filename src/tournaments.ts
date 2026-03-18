import { randomUUID } from 'node:crypto';

import type { User } from 'discord.js';

import { normalizeFreeformText } from './dm';
import type {
  DeckEntryType,
  SubmissionDisplayMode,
  Tournament,
  TournamentFormat,
  TournamentSetupMode,
  TournamentSubmission
} from './types';

const THREAD_NAME_LIMIT = 100;
const COMPACT_DECK_URL_LIMIT = 120;

type ParsedRecord = {
  wins: number;
  losses: number;
  draws: number;
  matchPoints: number;
};

export function normalizePlayerName(name: string): string {
  return normalizeFreeformText(name).replace(/\s+/g, ' ').toLowerCase();
}

export function buildTournament(options: {
  name: string;
  description: string | null;
  format: TournamentFormat;
  requireDeckVerification: boolean;
  submissionDisplayMode: SubmissionDisplayMode;
  setupMode: TournamentSetupMode;
  creator: User;
  sourceChannelId: string;
  threadId: string;
  threadName: string;
  threadSummaryMessageId?: string | null;
}): Tournament {
  return {
    id: randomUUID(),
    name: normalizeFreeformText(options.name),
    description: normalizeOptionalText(options.description),
    format: options.format,
    requireDeckVerification: options.requireDeckVerification,
    submissionDisplayMode: options.submissionDisplayMode,
    setupMode: options.setupMode,
    creatorUserId: options.creator.id,
    creatorUsername: options.creator.username,
    sourceChannelId: options.sourceChannelId,
    threadId: options.threadId,
    threadName: options.threadName,
    threadSummaryMessageId: options.threadSummaryMessageId ?? null,
    createdAt: new Date().toISOString(),
    publishedAt: null,
    publishedMessageId: null,
    submissions: {}
  };
}

export function buildTournamentSubmission(options: {
  playerName: string;
  deckName: string;
  decklist: string;
  decklistType: DeckEntryType;
  submitter: User;
}): TournamentSubmission {
  return {
    playerName: normalizeFreeformText(options.playerName),
    normalizedPlayerName: normalizePlayerName(options.playerName),
    deckName: normalizeFreeformText(options.deckName),
    decklist: normalizeFreeformText(options.decklist),
    decklistType: options.decklistType,
    submittedByUserId: options.submitter.id,
    submittedByUsername: options.submitter.username,
    submittedAt: new Date().toISOString(),
    placementText: null,
    recordText: null,
    archetype: null
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

export function isFreeformFormat(format: TournamentFormat): boolean {
  return format === 'Freeform';
}

export function isLikelyUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(normalizeFreeformText(value));
}

export function renderTournamentThreadSummary(tournament: Tournament): string {
  const submissions = sortAlphabetically(Object.values(tournament.submissions));
  const lines = [`# ${tournament.name}`];

  if (tournament.description) {
    lines.push(tournament.description);
  }

  lines.push(`Format: ${tournament.format}`);
  lines.push(`${submissions.length} players submitted`);

  if (tournament.submissionDisplayMode === 'count-plus-names') {
    lines.push('');
    lines.push('## Submitted Players');

    if (submissions.length === 0) {
      lines.push('No submitted players yet.');
    } else {
      for (const submission of submissions) {
        lines.push(`- ${submission.playerName}`);
      }
    }
  }

  lines.push('');
  lines.push('## How to Enter');
  lines.push('- Use /submit in this thread to enter the tournament.');
  lines.push('- You’ll get a direct message to submit your deck.');
  lines.push(
    '- If you need to make changes, run /submit again to update your entry.'
  );

  return lines.join('\n');
}

export function renderPublishedTournamentSummary(
  tournament: Tournament
): string {
  const submissions = sortSubmissionsForPublishedView(
    Object.values(tournament.submissions)
  );
  const showPlacement = submissions.some(
    (submission) => submission.placementText
  );
  const showRecord = submissions.some((submission) => submission.recordText);
  const showArchetype = submissions.some((submission) => submission.archetype);
  const shouldUseCompactRows = canUseCompactPublishedRows(submissions);

  const lines = [`# ${tournament.name}`];

  if (tournament.description) {
    lines.push(tournament.description);
  }

  lines.push(`Format: ${tournament.format}`);
  lines.push(`${submissions.length} players submitted`);

  if (submissions.length === 0) {
    lines.push('');
    lines.push('No decklists have been submitted yet.');
    return lines.join('\n');
  }

  lines.push('');

  if (shouldUseCompactRows) {
    const header = buildPublishedRowHeader({
      showPlacement,
      showRecord,
      showArchetype
    });

    lines.push(header.join(' | '));
    lines.push(header.map(() => '---').join(' | '));

    for (const submission of submissions) {
      lines.push(
        buildPublishedCompactRow(submission, {
          showPlacement,
          showRecord,
          showArchetype
        }).join(' | ')
      );
    }

    return lines.join('\n');
  }

  for (const submission of submissions) {
    const headingParts: string[] = [];

    if (showPlacement && submission.placementText) {
      headingParts.push(submission.placementText);
    }

    headingParts.push(submission.playerName);

    if (showRecord && submission.recordText) {
      headingParts.push(submission.recordText);
    }

    if (showArchetype && submission.archetype) {
      headingParts.push(submission.archetype);
    }

    lines.push(`## ${headingParts.join(' | ')}`);
    lines.push(`Deck: ${submission.deckName}`);

    if (submission.decklistType === 'url') {
      lines.push(`<${submission.decklist}>`);
    } else if (submission.decklistType === 'image') {
      lines.push(`Image: <${submission.decklist}>`);
    } else {
      lines.push(submission.decklist);
    }

    lines.push('');
  }

  return lines.join('\n').trim();
}

export function parseTournamentRecord(recordText: string): ParsedRecord | null {
  const match = normalizeFreeformText(recordText).match(
    /^(\d+)-(\d+)(?:-(\d+))?$/
  );

  if (!match) {
    return null;
  }

  const wins = Number(match[1]);
  const losses = Number(match[2]);
  const draws = Number(match[3] ?? 0);

  return {
    wins,
    losses,
    draws,
    matchPoints: wins * 3 + draws
  };
}

export function isValidTournamentRecord(recordText: string): boolean {
  return parseTournamentRecord(recordText) !== null;
}

export function applyCalculatedPlacements(
  submissions: TournamentSubmission[]
): TournamentSubmission[] {
  const rankedSubmissions = [...submissions].sort((left, right) => {
    const leftRecord = parseTournamentRecord(left.recordText ?? '');
    const rightRecord = parseTournamentRecord(right.recordText ?? '');

    if (!leftRecord && !rightRecord) {
      return left.playerName.localeCompare(right.playerName);
    }

    if (!leftRecord) {
      return 1;
    }

    if (!rightRecord) {
      return -1;
    }

    return (
      rightRecord.matchPoints - leftRecord.matchPoints ||
      rightRecord.wins - leftRecord.wins ||
      leftRecord.losses - rightRecord.losses ||
      rightRecord.draws - leftRecord.draws ||
      left.playerName.localeCompare(right.playerName)
    );
  });

  rankedSubmissions.forEach((submission, index) => {
    submission.placementText = formatOrdinal(index + 1);
  });

  return rankedSubmissions;
}

function normalizeOptionalText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeFreeformText(value);
  return normalized.length > 0 ? normalized : null;
}

function buildPublishedRowHeader(options: {
  showPlacement: boolean;
  showRecord: boolean;
  showArchetype: boolean;
}): string[] {
  const header: string[] = [];

  if (options.showPlacement) {
    header.push('Placement');
  }

  header.push('Player');

  if (options.showRecord) {
    header.push('Record');
  }

  if (options.showArchetype) {
    header.push('Archetype');
  }

  header.push('Deck');
  return header;
}

function buildPublishedCompactRow(
  submission: TournamentSubmission,
  options: {
    showPlacement: boolean;
    showRecord: boolean;
    showArchetype: boolean;
  }
): string[] {
  const row: string[] = [];

  if (options.showPlacement) {
    row.push(submission.placementText ?? '-');
  }

  row.push(submission.playerName);

  if (options.showRecord) {
    row.push(submission.recordText ?? '-');
  }

  if (options.showArchetype) {
    row.push(submission.archetype ?? '-');
  }

  row.push(renderCompactDeckValue(submission));
  return row;
}

function canUseCompactPublishedRows(
  submissions: TournamentSubmission[]
): boolean {
  return submissions.every(
    (submission) =>
      submission.decklistType === 'url' &&
      submission.decklist.length <= COMPACT_DECK_URL_LIMIT &&
      submission.deckName.length > 0
  );
}

function renderCompactDeckValue(submission: TournamentSubmission): string {
  return `${submission.deckName} <${submission.decklist}>`;
}

function sortAlphabetically(
  submissions: TournamentSubmission[]
): TournamentSubmission[] {
  return [...submissions].sort((left, right) =>
    left.playerName.localeCompare(right.playerName)
  );
}

function sortSubmissionsForPublishedView(
  submissions: TournamentSubmission[]
): TournamentSubmission[] {
  const hasPlacement = submissions.some(
    (submission) => submission.placementText
  );

  if (!hasPlacement) {
    return sortAlphabetically(submissions);
  }

  return [...submissions].sort((left, right) => {
    const leftPlacement = parsePlacementValue(left.placementText);
    const rightPlacement = parsePlacementValue(right.placementText);

    if (leftPlacement === null && rightPlacement === null) {
      return left.playerName.localeCompare(right.playerName);
    }

    if (leftPlacement === null) {
      return 1;
    }

    if (rightPlacement === null) {
      return -1;
    }

    return (
      leftPlacement - rightPlacement ||
      left.playerName.localeCompare(right.playerName)
    );
  });
}

function parsePlacementValue(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function formatOrdinal(value: number): string {
  const tens = value % 100;

  if (tens >= 11 && tens <= 13) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}
