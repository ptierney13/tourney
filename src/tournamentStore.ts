import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { normalizePlayerName } from './tournaments';
import type {
  DeckEntryType,
  SubmissionDisplayMode,
  Tournament,
  TournamentSetupMode,
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

      return {
        tournaments: parsed.tournaments.map(normalizeTournament)
      };
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code !== 'ENOENT') {
        console.warn(
          `Failed to read tournament store at ${storePath}. Starting with an empty store.`,
          error
        );
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

  async function upsertTournament(
    nextTournament: Tournament
  ): Promise<Tournament> {
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

  async function getTournamentByThreadId(
    threadId: string
  ): Promise<Tournament | null> {
    const store = await loadStore();
    return (
      store.tournaments.find(
        (tournament) => tournament.threadId === threadId
      ) ?? null
    );
  }

  return {
    createTournament(tournament: Tournament): Promise<Tournament> {
      return upsertTournament(tournament);
    },

    saveTournament(tournament: Tournament): Promise<Tournament> {
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

      tournament.submissions[options.submission.normalizedPlayerName] =
        options.submission;
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

    async saveThreadSummaryMessageId(options: {
      threadId: string;
      threadSummaryMessageId: string;
    }): Promise<Tournament | null> {
      const tournament = await getTournamentByThreadId(options.threadId);

      if (!tournament) {
        return null;
      }

      tournament.threadSummaryMessageId = options.threadSummaryMessageId;
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

function normalizeTournament(value: Partial<Tournament>): Tournament {
  return {
    id: value.id ?? '',
    name: value.name ?? 'Community Tournament',
    description: normalizeOptionalString(value.description),
    format: normalizeFormat(value.format),
    requireDeckVerification: Boolean(value.requireDeckVerification),
    submissionDisplayMode: normalizeSubmissionDisplayMode(
      value.submissionDisplayMode
    ),
    setupMode: normalizeSetupMode(value.setupMode),
    creatorUserId: value.creatorUserId ?? '',
    creatorUsername: value.creatorUsername ?? '',
    sourceChannelId: value.sourceChannelId ?? '',
    threadId: value.threadId ?? '',
    threadName: value.threadName ?? '',
    threadSummaryMessageId: value.threadSummaryMessageId ?? null,
    createdAt: value.createdAt ?? new Date(0).toISOString(),
    publishedAt: value.publishedAt ?? null,
    publishedMessageId: value.publishedMessageId ?? null,
    submissions: normalizeSubmissions(value.submissions)
  };
}

function normalizeSubmissions(
  submissions: Record<string, Partial<TournamentSubmission>> | undefined
): Record<string, TournamentSubmission> {
  if (!submissions) {
    return {};
  }

  return Object.fromEntries(
    Object.values(submissions).map((submission) => {
      const playerName = submission.playerName ?? 'Unknown Player';
      const normalizedPlayer =
        submission.normalizedPlayerName ?? normalizePlayerName(playerName);
      const decklist = submission.decklist ?? '';
      const decklistType = normalizeDeckEntryType(
        submission.decklistType,
        decklist
      );

      return [
        normalizedPlayer,
        {
          playerName,
          normalizedPlayerName: normalizedPlayer,
          deckName:
            normalizeOptionalString(submission.deckName) ?? 'Submitted Deck',
          decklist,
          decklistType,
          submittedByUserId: submission.submittedByUserId ?? '',
          submittedByUsername: submission.submittedByUsername ?? '',
          submittedAt: submission.submittedAt ?? new Date(0).toISOString(),
          placementText: normalizeOptionalString(submission.placementText),
          recordText: normalizeOptionalString(submission.recordText),
          archetype: normalizeOptionalString(submission.archetype)
        } satisfies TournamentSubmission
      ];
    })
  );
}

function normalizeOptionalString(
  value: string | null | undefined
): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeFormat(value: unknown): Tournament['format'] {
  return typeof value === 'string' && value.trim().length > 0
    ? (value as Tournament['format'])
    : 'Freeform';
}

function normalizeSubmissionDisplayMode(value: unknown): SubmissionDisplayMode {
  return value === 'count-plus-names' ? 'count-plus-names' : 'count-only';
}

function normalizeSetupMode(value: unknown): TournamentSetupMode {
  return value === 'custom' ? 'custom' : 'default';
}

function normalizeDeckEntryType(
  value: unknown,
  decklist: string
): DeckEntryType {
  if (value === 'image' || value === 'url' || value === 'text') {
    return value;
  }

  return /^https?:\/\/\S+$/i.test(decklist) ? 'url' : 'text';
}
