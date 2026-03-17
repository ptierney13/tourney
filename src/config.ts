import dotenv from 'dotenv';

dotenv.config();

type ConfigKey = 'DISCORD_TOKEN' | 'DISCORD_CLIENT_ID' | 'DISCORD_GUILD_ID';

export type BotConfig = {
  token: string;
  clientId: string;
  guildId: string;
};

function readRequiredEnv(key: ConfigKey): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function loadConfig(): BotConfig {
  return {
    token: readRequiredEnv('DISCORD_TOKEN'),
    clientId: readRequiredEnv('DISCORD_CLIENT_ID'),
    guildId: readRequiredEnv('DISCORD_GUILD_ID')
  };
}
