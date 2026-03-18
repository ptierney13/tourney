import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTournamentStore } from '../src/tournamentStore';
import type { Tournament } from '../src/types';

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
    creatorUserId: 'user-1',
    creatorUsername: 'organizer',
    sourceChannelId: 'channel-1',
    threadId: 'thread-1',
    threadName: 'Tourney: Spring Showdown',
    createdAt: '2026-03-17T00:00:00.000Z',
    publishedAt: null,
    publishedMessageId: null,
    submissions: {}
  };
}

describe('tournamentStore', () => {
  it('creates and reloads tournaments by thread id', async () => {
    const { tempDir, store } = await createTempStore();
    const tournament = createTournamentFixture();

    await store.createTournament(tournament);

    const reloadedStore = createTournamentStore(tempDir);
    await expect(reloadedStore.getTournamentByThreadId('thread-1')).resolves.toEqual(tournament);
  });

  it('upserts submissions by normalized player name', async () => {
    const { store } = await createTempStore();
    const tournament = createTournamentFixture();

    await store.createTournament(tournament);
    await store.upsertSubmission({
      threadId: tournament.threadId,
      submission: {
        playerName: 'Player One',
        normalizedPlayerName: 'player one',
        decklist: 'Deck A',
        submittedByUserId: 'submitter-1',
        submittedByUsername: 'submitter',
        submittedAt: '2026-03-17T00:00:00.000Z',
        placementText: null
      }
    });
    await store.upsertSubmission({
      threadId: tournament.threadId,
      submission: {
        playerName: 'Player One',
        normalizedPlayerName: 'player one',
        decklist: 'Deck B',
        submittedByUserId: 'submitter-1',
        submittedByUsername: 'submitter',
        submittedAt: '2026-03-17T01:00:00.000Z',
        placementText: null
      }
    });

    await expect(store.listSubmissions(tournament.threadId)).resolves.toEqual([
      expect.objectContaining({
        playerName: 'Player One',
        decklist: 'Deck B'
      })
    ]);
  });

  it('stores publish metadata and placement text', async () => {
    const { store } = await createTempStore();
    const tournament = createTournamentFixture();

    await store.createTournament(tournament);
    await store.upsertSubmission({
      threadId: tournament.threadId,
      submission: {
        playerName: 'Player One',
        normalizedPlayerName: 'player one',
        decklist: 'Deck A',
        submittedByUserId: 'submitter-1',
        submittedByUsername: 'submitter',
        submittedAt: '2026-03-17T00:00:00.000Z',
        placementText: null
      }
    });
    await store.updateSubmissionPlacement({
      threadId: tournament.threadId,
      normalizedPlayerName: 'player one',
      placementText: '1st place - 9 points'
    });
    await store.savePublishMetadata({
      threadId: tournament.threadId,
      publishedMessageId: 'message-1',
      publishedAt: '2026-03-17T02:00:00.000Z'
    });

    await expect(store.getTournamentByThreadId(tournament.threadId)).resolves.toEqual(
      expect.objectContaining({
        publishedMessageId: 'message-1',
        submissions: {
          'player one': expect.objectContaining({
            placementText: '1st place - 9 points'
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
