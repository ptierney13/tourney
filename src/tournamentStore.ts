import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  Tournament,
  TournamentStoreShape,
  TournamentSubmission
} from './types';

const STORE_FILE_NAME = 'tournaments.json';

export type TournamentStore = ReturnType<typeof createTournamentStore>;

export function createTournamentStore(dataDir: string) {
  const resolvedDataDir = path.resolve(dataDir);
  const storePath = path.join(resolvedDataDir, STORE_FILE_NAME);

  async function ensureDataDir(): Promise<void> {
    await mkdir(resolvedDataDir, { recursive: true });
  }

  async function loadStore(): Promise<TournamentStoreShape> {
    await ensureDataDir();

    try {
      const file = await readFile(storePath, 'utf8');
      const parsed = JSON.parse(file) as Partial<TournamentStoreShape>;

      if (!parsed || !Array.isArray(parsed.tournaments)) {
        return { tournaments: [] };
      }

      return { tournaments: parsed.tournaments };
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code !== 'ENOENT') {
        console.warn(`Failed to read tournament store at ${storePath}. Starting with an empty store.`, error);
      }

      return { tournaments: [] };
    }
  }

  async function saveStore(store: TournamentStoreShape): Promise<void> {
    await ensureDataDir();

    const nextContents = JSON.stringify(store, null, 2);
    const tempPath = `${storePath}.tmp`;

    await writeFile(tempPath, nextContents, 'utf8');
    await rename(tempPath, storePath);
  }

  async function upsertTournament(nextTournament: Tournament): Promise<Tournament> {
    const store = await loadStore();
    const existingIndex = store.tournaments.findIndex(
      (tournament) => tournament.id === nextTournament.id
    );

    if (existingIndex >= 0) {
      store.tournaments[existingIndex] = nextTournament;
    } else {
      store.tournaments.push(nextTournament);
    }

    await saveStore(store);
    return nextTournament;
  }

  async function getTournamentByThreadId(threadId: string): Promise<Tournament | null> {
    const store = await loadStore();
    return store.tournaments.find((tournament) => tournament.threadId === threadId) ?? null;
  }

  return {
    async createTournament(tournament: Tournament): Promise<Tournament> {
      return upsertTournament(tournament);
    },

    getTournamentByThreadId,

    async upsertSubmission(options: {
      threadId: string;
      submission: TournamentSubmission;
    }): Promise<Tournament | null> {
      const tournament = await getTournamentByThreadId(options.threadId);

      if (!tournament) {
        return null;
      }

      tournament.submissions[options.submission.normalizedPlayerName] = options.submission;
      await upsertTournament(tournament);
      return tournament;
    },

    async listSubmissions(threadId: string): Promise<TournamentSubmission[]> {
      const tournament = await getTournamentByThreadId(threadId);

      if (!tournament) {
        return [];
      }

      return Object.values(tournament.submissions).sort((left, right) =>
        left.playerName.localeCompare(right.playerName)
      );
    },

    async updateSubmissionPlacement(options: {
      threadId: string;
      normalizedPlayerName: string;
      placementText: string | null;
    }): Promise<Tournament | null> {
      const tournament = await getTournamentByThreadId(options.threadId);

      if (!tournament) {
        return null;
      }

      const submission = tournament.submissions[options.normalizedPlayerName];

      if (!submission) {
        return tournament;
      }

      submission.placementText = options.placementText;
      await upsertTournament(tournament);
      return tournament;
    },

    async savePublishMetadata(options: {
      threadId: string;
      publishedMessageId: string;
      publishedAt: string;
    }): Promise<Tournament | null> {
      const tournament = await getTournamentByThreadId(options.threadId);

      if (!tournament) {
        return null;
      }

      tournament.publishedMessageId = options.publishedMessageId;
      tournament.publishedAt = options.publishedAt;
      await upsertTournament(tournament);
      return tournament;
    }
  };
}
