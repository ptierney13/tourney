import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTournamentStore } from '../src/tournamentStore';
import type { Tournament, TournamentSubmission } from '../src/types';

async function createTempStore() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'tourney-store-'));
  return {
    tempDir,
    store: createTournamentStore(tempDir)
  };
}

function createTournamentFixture(): Tournament {
  return {
    id: 'tournament-1',
    name: 'Spring Showdown',
    description: 'Friday night event.',
    format: 'Standard',
    requireDeckVerification: true,
    submissionDisplayMode: 'count-plus-names',
    setupMode: 'custom',
    creatorUserId: 'user-1',
    creatorUsername: 'organizer',
    sourceChannelId: 'channel-1',
    threadId: 'thread-1',
    threadName: 'Tourney: Spring Showdown',
    threadSummaryMessageId: 'summary-1',
    organizerAccess: null,
    createdAt: '2026-03-17T00:00:00.000Z',
    publishedAt: null,
    publishedMessageId: null,
    submissions: {}
  };
}

function createSubmissionFixture(
  overrides: Partial<TournamentSubmission> = {}
): TournamentSubmission {
  return {
    playerName: 'Player One',
    normalizedPlayerName: 'player one',
    deckName: 'Izzet Phoenix',
    decklist: 'https://example.com/deck',
    decklistType: 'url',
    submittedByUserId: 'submitter-1',
    submittedByUsername: 'submitter',
    submittedAt: '2026-03-17T00:00:00.000Z',
    placementText: null,
    recordText: null,
    archetype: null,
    ...overrides
  };
}

describe('tournamentStore', () => {
  it('creates and reloads tournaments by thread id', async () => {
    const { tempDir, store } = await createTempStore();
    const tournament = createTournamentFixture();

    await store.createTournament(tournament);

    const reloadedStore = createTournamentStore(tempDir);
    await expect(
      reloadedStore.getTournamentByThreadId('thread-1')
    ).resolves.toEqual(tournament);
  });

  it('upserts submissions by normalized player name', async () => {
    const { store } = await createTempStore();
    const tournament = createTournamentFixture();

    await store.createTournament(tournament);
    await store.upsertSubmission({
      threadId: tournament.threadId,
      submission: createSubmissionFixture({
        deckName: 'Deck A',
        decklist: 'https://example.com/a'
      })
    });
    await store.upsertSubmission({
      threadId: tournament.threadId,
      submission: createSubmissionFixture({
        deckName: 'Deck B',
        decklist: 'https://example.com/b',
        submittedAt: '2026-03-17T01:00:00.000Z'
      })
    });

    await expect(store.listSubmissions(tournament.threadId)).resolves.toEqual([
      expect.objectContaining({
        playerName: 'Player One',
        deckName: 'Deck B',
        decklist: 'https://example.com/b'
      })
    ]);
  });

  it('stores thread summary and publish metadata', async () => {
    const { store } = await createTempStore();
    const tournament = createTournamentFixture();

    await store.createTournament(tournament);
    await store.saveThreadSummaryMessageId({
      threadId: tournament.threadId,
      threadSummaryMessageId: 'summary-2'
    });
    await store.savePublishMetadata({
      threadId: tournament.threadId,
      publishedMessageId: 'message-1',
      publishedAt: '2026-03-17T02:00:00.000Z'
    });

    await expect(
      store.getTournamentByThreadId(tournament.threadId)
    ).resolves.toEqual(
      expect.objectContaining({
        threadSummaryMessageId: 'summary-2',
        publishedMessageId: 'message-1'
      })
    );
  });

  it('removes stored submissions by normalized player name', async () => {
    const { store } = await createTempStore();
    const tournament = createTournamentFixture();

    await store.createTournament(tournament);
    await store.upsertSubmission({
      threadId: tournament.threadId,
      submission: createSubmissionFixture()
    });

    await store.removeSubmission({
      tournamentId: tournament.id,
      normalizedPlayerName: 'player one'
    });

    await expect(store.listSubmissions(tournament.threadId)).resolves.toEqual([]);
  });

  it('normalizes older stored tournaments that do not have the new fields', async () => {
    const { tempDir, store } = await createTempStore();
    const storePath = path.join(tempDir, 'tournaments.json');

    await writeFile(
      storePath,
      JSON.stringify({
        tournaments: [
          {
            id: 'tournament-1',
            name: 'Legacy Event',
            creatorUserId: 'user-1',
            creatorUsername: 'organizer',
            sourceChannelId: 'channel-1',
            threadId: 'thread-1',
            threadName: 'Tourney: Legacy Event',
            createdAt: '2026-03-17T00:00:00.000Z',
            publishedAt: null,
            publishedMessageId: null,
            submissions: {
              alpha: {
                playerName: 'Alpha',
                normalizedPlayerName: 'alpha',
                decklist: 'https://example.com/alpha',
                submittedByUserId: 'user-2',
                submittedByUsername: 'submitter',
                submittedAt: '2026-03-17T00:00:00.000Z',
                placementText: null
              }
            }
          }
        ]
      }),
      'utf8'
    );

    await expect(store.getTournamentByThreadId('thread-1')).resolves.toEqual(
      expect.objectContaining({
        description: null,
        format: 'Freeform',
        requireDeckVerification: false,
        submissionDisplayMode: 'count-only',
        setupMode: 'default',
        organizerAccess: null,
        submissions: {
          alpha: expect.objectContaining({
            deckName: 'Submitted Deck',
            decklist: 'https://example.com/alpha',
            decklistType: 'url',
            recordText: null,
            archetype: null
          })
        }
      })
    );
  });

  it('upgrades stored bare-domain deck entries into urls on reload', async () => {
    const { tempDir, store } = await createTempStore();
    const storePath = path.join(tempDir, 'tournaments.json');

    await writeFile(
      storePath,
      JSON.stringify({
        tournaments: [
          {
            ...createTournamentFixture(),
            submissions: {
              alpha: {
                playerName: 'Alpha',
                normalizedPlayerName: 'alpha',
                deckName: 'Deck Link',
                decklist: 'www.example.com/deck',
                decklistType: 'text',
                submittedByUserId: 'user-2',
                submittedByUsername: 'submitter',
                submittedAt: '2026-03-17T00:00:00.000Z',
                placementText: null,
                recordText: null,
                archetype: null
              }
            }
          }
        ]
      }),
      'utf8'
    );

    await expect(store.getTournamentByThreadId('thread-1')).resolves.toEqual(
      expect.objectContaining({
        submissions: {
          alpha: expect.objectContaining({
            decklist: 'https://www.example.com/deck',
            decklistType: 'url'
          })
        }
      })
    );
  });

  it('falls back to an empty store when the json is corrupt', async () => {
    const { tempDir, store } = await createTempStore();
    const storePath = path.join(tempDir, 'tournaments.json');

    await writeFile(storePath, '{not-json', 'utf8');

    await expect(store.getTournamentByThreadId('thread-1')).resolves.toBeNull();
    await expect(readFile(storePath, 'utf8')).resolves.toBe('{not-json');
  });
});
