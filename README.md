# Tourney

A small Discord bot scaffold for Tourney that starts from a slash command, opens a DM conversation, asks for one free-form response, and acknowledges that response without executing anything else.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and fill in your Discord application values.
3. Register the development slash command with `npm run register`.
4. Start the bot locally with `npm run dev`.

## Available scripts

- `npm run dev`: Run the bot with TypeScript watch mode.
- `npm run build`: Compile the project to `dist/`.
- `npm start`: Run the compiled bot.
- `npm run register`: Register slash commands in the configured development guild.
- `npm test`: Run the test suite.
- `npm run lint`: Run ESLint.
- `npm run format`: Check formatting with Prettier.

## Behavior

- `/submit` opens or reuses a DM with the invoking user.
- The bot asks for one open-form response.
- The first reply within five minutes is accepted and acknowledged.
- If DMs are disabled or the user never replies, the bot reports that gracefully.
