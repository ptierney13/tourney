# Tourney

A Discord bot for lightweight tournament setup and decklist collection. Tournament setup starts from a slash command, detailed input happens in DMs, and published results live in a dedicated Discord thread.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and fill in your Discord application values.
3. If you want organizer links to open on a different host or port, update the organizer-page env values.
4. Register the development slash command with `npm run register`.
5. Start the bot locally with `npm run dev`.

## Available scripts

- `npm run dev`: Run the bot with TypeScript watch mode.
- `npm run dev:sync`: Sync slash commands, then start the bot in watch mode.
- `npm run build`: Compile the project to `dist/`.
- `npm start`: Run the compiled bot.
- `npm run sync`: Sync slash commands to the configured development guild.
- `npm run register`: Register slash commands in the configured development guild.
- `npm test`: Run the test suite.
- `npm run lint`: Run ESLint.
- `npm run format`: Check formatting with Prettier.

## Workflow

- Use `npm run sync` after changing slash command definitions.
- Use `npm run dev:sync` when you want to sync commands and immediately start the bot locally.
- Repo changes should go through a branch-and-PR flow rather than direct pushes to `main`.
- For Codex-driven work in this repo, create a `codex/*` branch, push that branch, and open a pull request.
- Add a file in `Plans/` only for substantial changes that were actually driven by a formal plan shared during the workflow.
- Plan files should be the real implementation plan used for the work, not a small after-the-fact summary for every edit.
- Shared deferred work should be tracked in `TODO.md` so it stays visible across changes.

## Behavior

- `/tourney` can be run in a standard server text channel.
- The bot opens a DM with the organizer and offers either one-click default setup or a more detailed setup flow.
- Detailed tournament setup collects the tournament name, optional description, optional format, a stored deck-verification setting for later validation work, and how submitted players are shown in the thread summary.
- Tournament creation posts a thread summary immediately, including entry instructions and a running `players submitted` count.
- Tournament creation also sends the organizer a private status-page link that opens a lightweight local web view for reviewing submissions and removing players.
- The organizer status dashboard auto-refreshes every 5 seconds while it is open so recent submission and status changes show up without manual reloads.
- The bot tries to pin the current tournament status post and the latest published post, but falls back gracefully if it cannot manage messages in the thread.
- `/submit` works only inside a Tourney-created thread.
- The bot opens a DM, confirms the player name, collects a deck name, and accepts a pasted decklist, deck URL, or deck image upload.
- Repeated submissions for the same player name overwrite the earlier saved version.
- New submissions update the thread summary count, and can also update the public submitted-player list when that display mode is enabled.
- `/publish` works only for the tournament creator inside the tournament thread.
- The publish flow supports publishing decklists without standings, entering placements directly, or entering records and deriving placements.
- When republishing, the organizer can choose whether to update the existing published post or create a new one.
- Published tournament summaries always include player names and deck information, and can optionally include archetypes.
- The organizer status page is protected by a private signed link rather than a full account login, so it should be treated like any other secret admin URL.
- Actual format-aware deck verification and external deck-hub ingestion are still deferred and tracked in `TODO.md`.
- If DMs are disabled or the user never replies, the bot reports that gracefully.
