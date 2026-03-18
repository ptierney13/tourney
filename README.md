# Tourney

A Discord bot for lightweight tournament setup and decklist collection. Tournament setup starts from a slash command, detailed input happens in DMs, and published results live in a dedicated Discord thread.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and fill in your Discord application values.
3. Register the development slash command with `npm run register`.
4. Start the bot locally with `npm run dev`.

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

## Behavior

- `/tourney` can be run in a standard server text channel.
- The bot opens a DM with the organizer, asks for the tournament name, then creates a dedicated thread in the original channel.
- `/submit` works only inside a Tourney-created thread.
- The bot opens a DM, asks whether the decklist is for the sender or someone else, then collects one free-form decklist and stores it durably on disk.
- Repeated submissions for the same player name overwrite the earlier saved version.
- `/publish` works only for the tournament creator inside the tournament thread.
- The bot walks the organizer through each saved decklist in DM, optionally collects placement or score text, and posts or updates one canonical tournament summary message in the thread.
- If DMs are disabled or the user never replies, the bot reports that gracefully.
