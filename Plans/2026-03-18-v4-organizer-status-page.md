# V4 Organizer Status Page

## Summary

Add an organizer-only tournament status page that gives the tournament creator a fast way to inspect submissions and make light manual edits outside Discord. When a tournament is created, the organizer should receive a private link that opens a simple local web page for that tournament. The first shipped admin action is removing a submitted player after an explicit confirmation.

This plan is the execution record for the work being implemented in this change.

## Goals

- Give the organizer a private, clickable link immediately after tournament creation.
- Render a simple organizer-facing web page with tournament metadata and current submission status.
- Make it easy to scroll through player submissions and inspect deck names and deck entries.
- Support removing a submitted player from the organizer page with a confirmation step.
- Keep the feature lightweight and local to the existing app instead of introducing a separate frontend stack.

## Non-Goals

- Do not add multi-user organizer roles or shared admin access in this change.
- Do not build a full browser-authenticated account system.
- Do not introduce deck verification, deck-hub ingestion, or OCR in this change.
- Do not replace existing Discord publish or submission flows.
- Do not add rich inline editing for every tournament field in this first version.

## Product Decisions

- The organizer status page is private by possession of a signed link that is only sent to the tournament creator in DM.
- The local bot process should also host the organizer page so the feature works without deploying a second service.
- The organizer page should show:
  - tournament name
  - description when present
  - format
  - created and published status
  - total submissions
  - each submitted player with deck name and deck entry
- The main organizer dashboard should auto-refresh on a short interval so recent submission changes show up without requiring a manual reload.
- Deck entries should render in a readable way:
  - URLs stay clickable
  - image submissions show the stored image URL
  - text decklists preserve line breaks
- Each player row/card should include a `Remove Player` action.
- Removing a player must require an explicit confirmation step before deletion.
- After a player is removed from the organizer page, the tournament store should update immediately.
- When a player is removed, the tournament thread summary in Discord should also refresh so the count stays accurate.

## Technical Approach

- Extend tournament persistence with organizer access metadata:
  - organizer access token id
  - organizer access secret hash
- Add config for the local organizer web server:
  - enabled host
  - port
  - public base URL used in organizer links
- Start a minimal HTTP server from the existing Node process.
- Implement signed organizer links using a token id plus secret value in the URL. Persist only a hash of the secret.
- Add server routes for:
  - viewing the organizer page
  - confirming player removal
  - submitting the removal action
- Build the HTML response directly from TypeScript with a small embedded stylesheet and no frontend build step.
- Add a small app-level callback so web-driven tournament changes can ask the Discord client to refresh the thread summary message.

## Implementation Outline

- Extend shared types and the tournament store for organizer access data and player removal.
- Add server config loading and organizer-link helpers.
- Implement an organizer web server module with HTML rendering and token validation.
- Wire the server into app startup and expose a tournament-update callback for Discord thread summary refresh.
- Update `/tourney` so organizer creation results include the private organizer page link.
- Add tests for:
  - organizer token persistence normalization
  - token validation helpers
  - player removal store behavior
  - organizer page rendering basics where practical

## Risks / Watchouts

- The generated organizer link must be stable enough to use, but not stored as raw secret material in JSON.
- The page should degrade clearly if the configured public base URL is missing or incorrect.
- A locally hosted page will only be reachable where the process is reachable; the feature should therefore document the assumption through config and README updates.
- Discord summary refreshes can fail if the bot no longer has access to the thread or message, so web actions should not crash on sync failures.

## Expected User Flow

1. Organizer runs `/tourney`.
2. Tournament is created as usual.
3. The organizer receives a DM summary that includes a private organizer status link.
4. Opening the link shows the current tournament status page.
5. The organizer scrolls through player submissions and can remove a player if needed.
6. Removal updates persisted state and refreshes the thread summary count in Discord.
