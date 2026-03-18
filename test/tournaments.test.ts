import { describe, expect, it } from 'vitest';

import {
  applyCalculatedPlacements,
  buildTournamentSubmission,
  buildTournamentThreadName,
  getDefaultPlayerName,
  isValidTournamentRecord,
  normalizePlayerName,
  renderPublishedTournamentSummary,
  renderTournamentThreadSummary
} from '../src/tournaments';
import type { Tournament, TournamentSubmission } from '../src/types';

describe('normalizePlayerName', () => {
  it('normalizes spacing and casing', () => {
    expect(normalizePlayerName('  Player   One  ')).toBe('player one');
  });
});

describe('buildTournamentThreadName', () => {
  it('prefixes the tournament name for the thread', () => {
    expect(buildTournamentThreadName('Spring Showdown')).toBe(
      'Tourney: Spring Showdown'
    );
  });
});

describe('getDefaultPlayerName', () => {
  it('prefers global name and falls back to username', () => {
    expect(
      getDefaultPlayerName({
        globalName: 'Visible Name',
        username: 'hidden'
      } as never)
    ).toBe('Visible Name');
    expect(
      getDefaultPlayerName({ globalName: null, username: 'hidden' } as never)
    ).toBe('hidden');
  });
});

describe('buildTournamentSubmission', () => {
  it('creates a persisted submission record with deck metadata', () => {
    expect(
      buildTournamentSubmission({
        playerName: 'Player One',
        deckName: '  Izzet Phoenix ',
        decklist: '  https://example.com/deck ',
        decklistType: 'url',
        submitter: {
          id: 'user-1',
          username: 'submitter'
        } as never
      })
    ).toEqual(
      expect.objectContaining({
        playerName: 'Player One',
        normalizedPlayerName: 'player one',
        deckName: 'Izzet Phoenix',
        decklist: 'https://example.com/deck',
        decklistType: 'url',
        submittedByUserId: 'user-1',
        submittedByUsername: 'submitter',
        placementText: null,
        recordText: null,
        archetype: null
      })
    );
  });
});

describe('isValidTournamentRecord', () => {
  it('accepts W-L and W-L-D formats', () => {
    expect(isValidTournamentRecord('6-1')).toBe(true);
    expect(isValidTournamentRecord('6-1-1')).toBe(true);
    expect(isValidTournamentRecord('x-y')).toBe(false);
  });
});

describe('applyCalculatedPlacements', () => {
  it('assigns ordinal placements from best to worst record', () => {
    const submissions = applyCalculatedPlacements([
      {
        playerName: 'Bravo',
        normalizedPlayerName: 'bravo',
        deckName: 'Deck B',
        decklist: 'https://example.com/b',
        decklistType: 'url',
        submittedByUserId: 'user-2',
        submittedByUsername: 'submitter',
        submittedAt: '2026-03-17T00:00:00.000Z',
        placementText: null,
        recordText: '5-2',
        archetype: null
      },
      {
        playerName: 'Alpha',
        normalizedPlayerName: 'alpha',
        deckName: 'Deck A',
        decklist: 'https://example.com/a',
        decklistType: 'url',
        submittedByUserId: 'user-1',
        submittedByUsername: 'submitter',
        submittedAt: '2026-03-17T00:00:00.000Z',
        placementText: null,
        recordText: '6-1',
        archetype: null
      }
    ]);

    expect(
      submissions.map((submission) => [
        submission.playerName,
        submission.placementText
      ])
    ).toEqual([
      ['Alpha', '1st'],
      ['Bravo', '2nd']
    ]);
  });
});

describe('renderTournamentThreadSummary', () => {
  it('shows the current count and public submitted-player names when enabled', () => {
    const tournament = createTournamentFixture({
      submissionDisplayMode: 'count-plus-names',
      submissions: {
        alpha: createSubmissionFixture({
          playerName: 'Alpha',
          normalizedPlayerName: 'alpha'
        }),
        beta: createSubmissionFixture({
          playerName: 'Beta',
          normalizedPlayerName: 'beta'
        })
      }
    });

    const summary = renderTournamentThreadSummary(tournament);

    expect(summary).toContain('# Spring Showdown');
    expect(summary).toContain('Format: Standard');
    expect(summary).toContain('2 players submitted');
    expect(summary).toContain('## Submitted Players');
    expect(summary).toContain('- Alpha');
    expect(summary).toContain('## How to Enter');
  });
});

describe('renderPublishedTournamentSummary', () => {
  it('renders compact rows for url decklists and includes result columns when present', () => {
    const tournament = createTournamentFixture({
      submissions: {
        alpha: createSubmissionFixture({
          playerName: 'Alpha',
          normalizedPlayerName: 'alpha',
          deckName: 'Izzet Phoenix',
          decklist: 'https://example.com/phoenix',
          decklistType: 'url',
          placementText: '1st',
          recordText: '6-1',
          archetype: 'Phoenix'
        }),
        beta: createSubmissionFixture({
          playerName: 'Beta',
          normalizedPlayerName: 'beta',
          deckName: 'Mono-Green Devotion',
          decklist: 'https://example.com/green',
          decklistType: 'url',
          placementText: '2nd',
          recordText: '5-2',
          archetype: 'Ramp'
        })
      }
    });

    const summary = renderPublishedTournamentSummary(tournament);

    expect(summary).toContain('Placement | Player | Record | Archetype | Deck');
    expect(summary).toContain(
      '1st | Alpha | 6-1 | Phoenix | Izzet Phoenix <https://example.com/phoenix>'
    );
    expect(summary).toContain(
      '2nd | Beta | 5-2 | Ramp | Mono-Green Devotion <https://example.com/green>'
    );
  });

  it('falls back to block rendering for multiline decklists and omits result columns when unpublished results are skipped', () => {
    const tournament = createTournamentFixture({
      submissions: {
        alpha: createSubmissionFixture({
          playerName: 'Alpha',
          normalizedPlayerName: 'alpha',
          deckName: 'Jeskai Control',
          decklist: '4 Lightning Bolt\n4 Counterspell',
          decklistType: 'text'
        })
      }
    });

    const summary = renderPublishedTournamentSummary(tournament);

    expect(summary).toContain('## Alpha');
    expect(summary).toContain('Deck: Jeskai Control');
    expect(summary).toContain('4 Lightning Bolt');
    expect(summary).not.toContain('Placement | Player');
  });
});

function createTournamentFixture(
  overrides: Partial<Tournament> = {}
): Tournament {
  return {
    id: 'tournament-1',
    name: 'Spring Showdown',
    description: 'Friday night event.',
    format: 'Standard',
    requireDeckVerification: false,
    submissionDisplayMode: 'count-only',
    setupMode: 'custom',
    creatorUserId: 'user-1',
    creatorUsername: 'organizer',
    sourceChannelId: 'channel-1',
    threadId: 'thread-1',
    threadName: 'Tourney: Spring Showdown',
    threadSummaryMessageId: 'message-1',
    createdAt: '2026-03-17T00:00:00.000Z',
    publishedAt: null,
    publishedMessageId: null,
    submissions: {},
    ...overrides
  };
}

function createSubmissionFixture(
  overrides: Partial<TournamentSubmission> = {}
): TournamentSubmission {
  return {
    playerName: 'Player One',
    normalizedPlayerName: 'player one',
    deckName: 'Deck A',
    decklist: 'Deck A',
    decklistType: 'text',
    submittedByUserId: 'user-1',
    submittedByUsername: 'submitter',
    submittedAt: '2026-03-17T00:00:00.000Z',
    placementText: null,
    recordText: null,
    archetype: null,
    ...overrides
  };
}
