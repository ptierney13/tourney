import { describe, expect, it } from 'vitest';

import {
  buildTournamentSubmission,
  buildTournamentThreadName,
  getDefaultPlayerName,
  normalizePlayerName,
  renderTournamentSummary
} from '../src/tournaments';
import type { Tournament } from '../src/types';

describe('normalizePlayerName', () => {
  it('normalizes spacing and casing', () => {
    expect(normalizePlayerName('  Player   One  ')).toBe('player one');
  });
});

describe('buildTournamentThreadName', () => {
  it('prefixes the tournament name for the thread', () => {
    expect(buildTournamentThreadName('Spring Showdown')).toBe('Tourney: Spring Showdown');
  });
});

describe('getDefaultPlayerName', () => {
  it('prefers global name and falls back to username', () => {
    expect(getDefaultPlayerName({ globalName: 'Visible Name', username: 'hidden' } as never)).toBe(
      'Visible Name'
    );
    expect(getDefaultPlayerName({ globalName: null, username: 'hidden' } as never)).toBe('hidden');
  });
});

describe('buildTournamentSubmission', () => {
  it('creates a persisted submission record', () => {
    expect(
      buildTournamentSubmission({
        playerName: 'Player One',
        decklist: '  Deck line 1\nDeck line 2 ',
        submitter: {
          id: 'user-1',
          username: 'submitter'
        } as never
      })
    ).toEqual(
      expect.objectContaining({
        playerName: 'Player One',
        normalizedPlayerName: 'player one',
        decklist: 'Deck line 1\nDeck line 2',
        submittedByUserId: 'user-1',
        submittedByUsername: 'submitter',
        placementText: null
      })
    );
  });
});

describe('renderTournamentSummary', () => {
  it('includes optional placement text only when present', () => {
    const tournament: Tournament = {
      id: 'tournament-1',
      name: 'Spring Showdown',
      creatorUserId: 'user-1',
      creatorUsername: 'organizer',
      sourceChannelId: 'channel-1',
      threadId: 'thread-1',
      threadName: 'Tourney: Spring Showdown',
      createdAt: '2026-03-17T00:00:00.000Z',
      publishedAt: null,
      publishedMessageId: null,
      submissions: {
        alpha: {
          playerName: 'Alpha',
          normalizedPlayerName: 'alpha',
          decklist: 'Deck A',
          submittedByUserId: 'user-1',
          submittedByUsername: 'submitter',
          submittedAt: '2026-03-17T00:00:00.000Z',
          placementText: '1st place'
        },
        beta: {
          playerName: 'Beta',
          normalizedPlayerName: 'beta',
          decklist: 'Deck B',
          submittedByUserId: 'user-2',
          submittedByUsername: 'submitter',
          submittedAt: '2026-03-17T00:00:00.000Z',
          placementText: null
        }
      }
    };

    const summary = renderTournamentSummary(tournament);

    expect(summary).toContain('# Spring Showdown');
    expect(summary).toContain('## Alpha');
    expect(summary).toContain('Placement/Score: 1st place');
    expect(summary).toContain('## Beta');
    expect(summary).toContain('Deck B');
  });
});
