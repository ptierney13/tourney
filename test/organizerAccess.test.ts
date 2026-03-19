import { describe, expect, it } from 'vitest';

import {
  buildOrganizerAccessToken,
  buildOrganizerStatusUrl,
  createOrganizerAccess,
  validateOrganizerAccessToken
} from '../src/organizerAccess';
import { renderOrganizerDashboardPage } from '../src/organizerServer';
import type { Tournament } from '../src/types';

describe('organizer access tokens', () => {
  it('validates a generated organizer token', () => {
    const credentials = createOrganizerAccess();
    const accessToken = buildOrganizerAccessToken({
      tokenId: credentials.organizerAccess.tokenId,
      tokenSecret: credentials.tokenSecret
    });

    expect(
      validateOrganizerAccessToken(credentials.organizerAccess, accessToken)
    ).toBe(true);
    expect(
      validateOrganizerAccessToken(
        credentials.organizerAccess,
        `${credentials.organizerAccess.tokenId}.wrong-secret`
      )
    ).toBe(false);
  });

  it('builds the organizer status url with the signed token', () => {
    expect(
      buildOrganizerStatusUrl({
        baseUrl: 'http://127.0.0.1:4318',
        tournamentId: 'tournament-1',
        accessToken: 'token.value'
      })
    ).toBe(
      'http://127.0.0.1:4318/organizer/tournament-1?access=token.value'
    );
  });
});

describe('renderOrganizerDashboardPage', () => {
  it('renders submission details and remove links for organizers', () => {
    const html = renderOrganizerDashboardPage({
      tournament: createTournamentFixture(),
      accessToken: 'token.value',
      notice: 'Player removed from the tournament.'
    });

    expect(html).toContain('Organizer Status');
    expect(html).toContain('Spring Showdown');
    expect(html).toContain('Player One');
    expect(html).toContain('Izzet Phoenix');
    expect(html).toContain('Remove Player');
    expect(html).toContain('Count Only');
    expect(html).toContain('Start Publish Flow');
    expect(html).toContain(
      'This page refreshes automatically every 5 seconds while it is open.'
    );
    expect(html).toContain(
      'window.setTimeout(() => { window.location.reload(); }, 5000);'
    );
    expect(html).toContain(
      'Anyone with the full organizer link can access and edit this tournament.'
    );
    expect(html).not.toContain('Setup Mode');
    expect(html).toContain(
      '/organizer/tournament-1/remove/confirm?access=token.value&amp;player=player+one'
    );
  });
});

function createTournamentFixture(): Tournament {
  const organizerAccess = createOrganizerAccess().organizerAccess;

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
    organizerAccess,
    createdAt: '2026-03-17T00:00:00.000Z',
    publishedAt: null,
    publishedMessageId: null,
    submissions: {
      'player one': {
        playerName: 'Player One',
        normalizedPlayerName: 'player one',
        deckName: 'Izzet Phoenix',
        decklist: 'https://example.com/deck',
        decklistType: 'url',
        submittedByUserId: 'user-2',
        submittedByUsername: 'submitter',
        submittedAt: '2026-03-17T01:00:00.000Z',
        placementText: null,
        recordText: null,
        archetype: null
      }
    }
  };
}
