# V1 Bootstrap Discord Bot

## Summary

Create a new Node/TypeScript Discord bot repository using `discord.js` and `npm`, with balanced default tooling. The initial product scope is intentionally narrow: a slash command starts a DM conversation, the bot asks the user for one open-form response, stores that response in memory for the interaction, and acknowledges it without executing anything else.

## Key Changes

- Initialize a fresh Git repository and Node project in `C:\Users\ptier\repos\Codex\Tourney`.
- Add balanced baseline tooling:
  - TypeScript config for modern Node
  - basic test setup
  - lint/format scripts
  - `.env.example`, `.gitignore`, and a concise `README`
- Implement the bot scaffold:
  - application entrypoint that logs in and registers handlers
  - development command registration flow for a single guild
  - one slash command such as `/submit`
- Implement the v1 DM flow:
  - slash command responds by opening or attempting to open a DM with the user
  - bot sends one prompt asking for a single free-form reply
  - bot waits for one user message and accepts the first valid response as the submission
  - bot sends an acknowledgement message echoing or summarizing the received text
  - no task execution, persistence, or downstream processing
- Structure the code so the captured response is represented as a typed internal value that can later feed real business logic.

## Public Interfaces / Behavior

- One slash command exposed in Discord to begin the DM flow.
- Environment variables for bot token, client ID, and guild ID.
- A typed conversation/submission object containing the single captured response plus basic interaction metadata if needed.
- `npm` scripts for build, run, test, and slash-command registration.

## Test Plan

- Verify the project installs and builds cleanly from the repo root.
- Verify the slash command registers in the configured development guild.
- Verify invoking the command successfully opens a DM and sends the single prompt.
- Verify the first DM reply is accepted and acknowledged.
- Verify graceful handling when DMs are disabled or the user never replies.
- Verify no execution or side effects occur after the response is captured.

## Assumptions

- `C:\Users\ptier\repos\Codex\Tourney` is the intended repo root.
- `discord.js` and `npm` are the selected SDK and package manager.
- The single-response DM flow is the full v1 scope; persistence, multi-step dialogs, and task execution are deferred.
- Command registration should target a development guild first for faster iteration.
