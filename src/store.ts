import { loadConfig } from './config';
import { createTournamentStore } from './tournamentStore';

const config = loadConfig();

export const tournamentStore = createTournamentStore(config.dataDir);
