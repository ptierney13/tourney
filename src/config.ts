import dotenv from 'dotenv';

dotenv.config();

type ConfigKey = 'DISCORD_TOKEN' | 'DISCORD_CLIENT_ID' | 'DISCORD_GUILD_ID';

export type BotConfig = {
  token: string;
  clientId: string;
  guildId: string;
  dataDir: string;
  organizerHost: string;
  organizerPort: number;
  organizerBaseUrl: string;
};

function readRequiredEnv(key: ConfigKey): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function loadConfig(): BotConfig {
  const organizerHost = process.env.TOURNEY_ORGANIZER_HOST?.trim() || '127.0.0.1';
  const organizerPort = readOptionalPort(
    process.env.TOURNEY_ORGANIZER_PORT,
    4318
  );
  const organizerBaseUrl =
    process.env.TOURNEY_ORGANIZER_BASE_URL?.trim() ||
    `http://127.0.0.1:${organizerPort}`;

  return {
    token: readRequiredEnv('DISCORD_TOKEN'),
    clientId: readRequiredEnv('DISCORD_CLIENT_ID'),
    guildId: readRequiredEnv('DISCORD_GUILD_ID'),
    dataDir: process.env.TOURNEY_DATA_DIR?.trim() || './data',
    organizerHost,
    organizerPort,
    organizerBaseUrl
  };
}

function readOptionalPort(
  value: string | undefined,
  fallback: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(
      `Invalid TOURNEY_ORGANIZER_PORT value: ${value}. Expected an integer between 1 and 65535.`
    );
  }

  return parsed;
}
