import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from 'node:http';

import { validateOrganizerAccessToken } from './organizerAccess';
import type { TournamentStore } from './tournamentStore';
import type {
  SubmissionDisplayMode,
  Tournament,
  TournamentSubmission
} from './types';

type OrganizerServerOptions = {
  host: string;
  port: number;
  publicBaseUrl: string;
  tournamentStore: TournamentStore;
  onTournamentChanged?: (tournament: Tournament) => Promise<void> | void;
  onPublishRequested?: (
    tournament: Tournament
  ) =>
    | Promise<'started' | 'dm-unavailable' | 'no-submissions' | void>
    | 'started'
    | 'dm-unavailable'
    | 'no-submissions'
    | void;
};

type AuthorizedTournamentResult =
  | {
      kind: 'ok';
      tournament: Tournament;
      accessToken: string;
    }
  | {
      kind: 'forbidden' | 'not-found';
    };

export async function startOrganizerServer(
  options: OrganizerServerOptions
): Promise<Server> {
  const server = createServer((request, response) => {
    void handleRequest(options, request, response).catch((error) => {
      console.error('Failed to handle organizer page request.', error);

      if (!response.headersSent) {
        sendHtml(
          response,
          500,
          renderErrorPage({
            title: 'Organizer Page Error',
            message:
              'Something went wrong while loading the organizer page. Check the bot logs for more detail.'
          })
        );
      } else {
        response.end();
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  console.log(`Organizer status page listening at ${options.publicBaseUrl}`);
  return server;
}

export function renderOrganizerDashboardPage(options: {
  tournament: Tournament;
  accessToken: string;
  notice?: string | null;
}): string {
  const submissions = Object.values(options.tournament.submissions).sort(
    (left, right) => left.playerName.localeCompare(right.playerName)
  );
  const dashboardPath = buildOrganizerPath({
    tournamentId: options.tournament.id,
    accessToken: options.accessToken
  });
  const description = options.tournament.description
    ? `<p class="hero-copy__body">${escapeHtml(options.tournament.description)}</p>`
    : '';
  const submissionsMarkup =
    submissions.length > 0
      ? submissions
          .map((submission) =>
            renderSubmissionCard({
              tournamentId: options.tournament.id,
              accessToken: options.accessToken,
              submission
            })
          )
          .join('\n')
      : [
          '<section class="empty-state">',
          '<h3>No submissions yet</h3>',
          '<p>The organizer page is ready. Player submissions will appear here as they come in.</p>',
          '</section>'
        ].join('');

  return renderPageLayout({
    title: `${options.tournament.name} Organizer View`,
    extraBody: [
      '<script>',
      'window.setTimeout(() => { window.location.reload(); }, 5000);',
      '</script>'
    ].join('\n'),
    body: [
      '<div class="page-shell">',
      '<header class="hero">',
      '<div class="hero-copy">',
      '<p class="eyebrow">Organizer Status</p>',
      `<h1>${escapeHtml(options.tournament.name)}</h1>`,
      '<p class="hero-copy__lede">Quick status and manual controls for this tournament.</p>',
      description,
      '<p class="hero-copy__body">This page refreshes automatically every 5 seconds while it is open.</p>',
      '</div>',
      `<a class="secondary-button" href="${escapeAttribute(dashboardPath)}">Refresh View</a>`,
      '</header>',
      options.notice ? `<div class="notice">${escapeHtml(options.notice)}</div>` : '',
      '<section class="stats-grid">',
      renderStatCard('Format', options.tournament.format),
      renderThreadSummaryCard({
        tournamentId: options.tournament.id,
        accessToken: options.accessToken,
        submissionDisplayMode: options.tournament.submissionDisplayMode
      }),
      renderPublishStatusCard({
        tournamentId: options.tournament.id,
        accessToken: options.accessToken,
        publishedAt: options.tournament.publishedAt
      }),
      renderStatCard('Players Submitted', String(submissions.length)),
      renderStatCard('Created', formatDateTime(options.tournament.createdAt)),
      '</section>',
      '<section class="panel">',
      '<div class="panel-heading">',
      '<div>',
      '<p class="eyebrow">Manual Review</p>',
      '<h2>Deck Submissions</h2>',
      '</div>',
      `<p class="panel-heading__meta">${submissions.length} saved entry${submissions.length === 1 ? '' : 'ies'}</p>`,
      '</div>',
      '<p class="panel-copy">Use this page to review the current tournament state and remove incorrect submissions when needed.</p>',
      submissionsMarkup,
      '</section>',
      '<section class="panel panel--subtle">',
      '<div class="panel-heading">',
      '<div>',
      '<p class="eyebrow">Access</p>',
      '<h2>Organizer Link</h2>',
      '</div>',
      '</div>',
      '<p class="panel-copy">Anyone with the full organizer link can access and edit this tournament.</p>',
      `<p class="access-link"><a href="${escapeAttribute(dashboardPath)}">${escapeHtml(options.tournament.id)}</a></p>`,
      '</section>',
      '</div>'
    ].join('\n')
  });
}

export function renderOrganizerRemovalConfirmPage(options: {
  tournament: Tournament;
  submission: TournamentSubmission;
  accessToken: string;
}): string {
  const dashboardPath = buildOrganizerPath({
    tournamentId: options.tournament.id,
    accessToken: options.accessToken
  });
  const removeActionPath = buildOrganizerRemovalPath(options.tournament.id);

  return renderPageLayout({
    title: `Remove ${options.submission.playerName}`,
    body: [
      '<div class="page-shell page-shell--narrow">',
      '<header class="hero hero--compact">',
      '<div class="hero-copy">',
      '<p class="eyebrow">Confirm Removal</p>',
      `<h1>Remove ${escapeHtml(options.submission.playerName)}?</h1>`,
      '<p class="hero-copy__lede">This will permanently remove the saved submission from the tournament and refresh the Discord thread summary when possible.</p>',
      '</div>',
      '</header>',
      '<section class="panel">',
      '<div class="panel-heading">',
      '<div>',
      '<p class="eyebrow">Saved Submission</p>',
      '<h2>Review Before Removing</h2>',
      '</div>',
      '</div>',
      renderSubmissionSummary(options.submission),
      '</section>',
      '<form class="panel confirm-form" method="post" action="' +
        escapeAttribute(removeActionPath) +
        '">',
      `<input type="hidden" name="access" value="${escapeAttribute(options.accessToken)}" />`,
      `<input type="hidden" name="player" value="${escapeAttribute(options.submission.normalizedPlayerName)}" />`,
      '<div class="panel-heading">',
      '<div>',
      '<p class="eyebrow">Danger Zone</p>',
      '<h2>Remove Player</h2>',
      '</div>',
      '</div>',
      '<p class="panel-copy">If you continue, this player will disappear from the organizer page and from the tournament thread summary count.</p>',
      '<div class="action-row">',
      '<button class="danger-button" type="submit">Yes, Remove Player</button>',
      `<a class="secondary-button" href="${escapeAttribute(dashboardPath)}">Cancel</a>`,
      '</div>',
      '</form>',
      '</div>'
    ].join('\n')
  });
}

async function handleRequest(
  options: OrganizerServerOptions,
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>
): Promise<void> {
  const requestUrl = new URL(
    request.url ?? '/',
    `http://${request.headers.host ?? '127.0.0.1'}`
  );
  const organizerMatch = requestUrl.pathname.match(/^\/organizer\/([^/]+)$/);
  const threadSummaryMatch = requestUrl.pathname.match(
    /^\/organizer\/([^/]+)\/thread-summary$/
  );
  const publishRequestMatch = requestUrl.pathname.match(
    /^\/organizer\/([^/]+)\/publish-request$/
  );
  const removalConfirmMatch = requestUrl.pathname.match(
    /^\/organizer\/([^/]+)\/remove\/confirm$/
  );
  const removalMatch = requestUrl.pathname.match(
    /^\/organizer\/([^/]+)\/remove$/
  );

  if (request.method === 'GET' && organizerMatch) {
    await handleOrganizerDashboardRequest(
      options,
      response,
      decodeURIComponent(organizerMatch[1]),
      requestUrl
    );
    return;
  }

  if (request.method === 'POST' && threadSummaryMatch) {
    await handleThreadSummaryRequest(
      options,
      request,
      response,
      decodeURIComponent(threadSummaryMatch[1])
    );
    return;
  }

  if (request.method === 'POST' && publishRequestMatch) {
    await handlePublishRequest(
      options,
      request,
      response,
      decodeURIComponent(publishRequestMatch[1])
    );
    return;
  }

  if (request.method === 'GET' && removalConfirmMatch) {
    await handleRemovalConfirmRequest(
      options,
      response,
      decodeURIComponent(removalConfirmMatch[1]),
      requestUrl
    );
    return;
  }

  if (request.method === 'POST' && removalMatch) {
    await handleRemovalRequest(
      options,
      request,
      response,
      decodeURIComponent(removalMatch[1])
    );
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/') {
    sendHtml(
      response,
      200,
      renderErrorPage({
        title: 'Tourney Organizer Page',
        message:
          'Open the private organizer link from Discord to view a specific tournament.'
      })
    );
    return;
  }

  sendHtml(
    response,
    404,
    renderErrorPage({
      title: 'Page Not Found',
      message: 'That organizer page route does not exist.'
    })
  );
}

async function handleOrganizerDashboardRequest(
  options: OrganizerServerOptions,
  response: ServerResponse<IncomingMessage>,
  tournamentId: string,
  requestUrl: URL
): Promise<void> {
  const authorizedTournament = await loadAuthorizedTournament({
    tournamentStore: options.tournamentStore,
    tournamentId,
    accessToken: requestUrl.searchParams.get('access')
  });

  if (authorizedTournament.kind !== 'ok') {
    sendUnauthorizedOrMissingPage(response, authorizedTournament.kind);
    return;
  }

  sendHtml(
    response,
    200,
    renderOrganizerDashboardPage({
      tournament: authorizedTournament.tournament,
      accessToken: authorizedTournament.accessToken,
      notice: getNoticeMessage(requestUrl.searchParams.get('notice'))
    })
  );
}

async function handleThreadSummaryRequest(
  options: OrganizerServerOptions,
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
  tournamentId: string
): Promise<void> {
  const formValues = await readFormBody(request);
  const accessToken = formValues.get('access');
  const submissionDisplayMode = formValues.get('mode');

  if (
    typeof accessToken !== 'string' ||
    !isSubmissionDisplayMode(submissionDisplayMode)
  ) {
    sendHtml(
      response,
      400,
      renderErrorPage({
        title: 'Invalid Request',
        message: 'The thread summary update was missing required fields.'
      })
    );
    return;
  }

  const authorizedTournament = await loadAuthorizedTournament({
    tournamentStore: options.tournamentStore,
    tournamentId,
    accessToken
  });

  if (authorizedTournament.kind !== 'ok') {
    sendUnauthorizedOrMissingPage(response, authorizedTournament.kind);
    return;
  }

  if (
    authorizedTournament.tournament.submissionDisplayMode !==
    submissionDisplayMode
  ) {
    authorizedTournament.tournament.submissionDisplayMode =
      submissionDisplayMode;
    await options.tournamentStore.saveTournament(authorizedTournament.tournament);
  }

  let notice = 'thread-summary-updated';

  if (options.onTournamentChanged) {
    try {
      await options.onTournamentChanged(authorizedTournament.tournament);
    } catch (error) {
      console.warn('Failed to refresh thread summary after organizer edit.', error);
      notice = 'thread-summary-sync-warning';
    }
  }

  redirectToDashboard(response, {
    tournamentId,
    accessToken,
    notice
  });
}

async function handlePublishRequest(
  options: OrganizerServerOptions,
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
  tournamentId: string
): Promise<void> {
  const formValues = await readFormBody(request);
  const accessToken = formValues.get('access');

  if (typeof accessToken !== 'string') {
    sendHtml(
      response,
      400,
      renderErrorPage({
        title: 'Invalid Request',
        message: 'The publish request was missing required fields.'
      })
    );
    return;
  }

  const authorizedTournament = await loadAuthorizedTournament({
    tournamentStore: options.tournamentStore,
    tournamentId,
    accessToken
  });

  if (authorizedTournament.kind !== 'ok') {
    sendUnauthorizedOrMissingPage(response, authorizedTournament.kind);
    return;
  }

  let notice = 'publish-flow-started';

  if (options.onPublishRequested) {
    try {
      const publishResult = await options.onPublishRequested(
        authorizedTournament.tournament
      );

      if (publishResult === 'dm-unavailable') {
        notice = 'publish-flow-dm-unavailable';
      } else if (publishResult === 'no-submissions') {
        notice = 'publish-flow-no-submissions';
      }
    } catch (error) {
      console.warn('Failed to notify organizer about publish request.', error);
      notice = 'publish-flow-failed';
    }
  }

  redirectToDashboard(response, {
    tournamentId,
    accessToken,
    notice
  });
}

async function handleRemovalConfirmRequest(
  options: OrganizerServerOptions,
  response: ServerResponse<IncomingMessage>,
  tournamentId: string,
  requestUrl: URL
): Promise<void> {
  const authorizedTournament = await loadAuthorizedTournament({
    tournamentStore: options.tournamentStore,
    tournamentId,
    accessToken: requestUrl.searchParams.get('access')
  });

  if (authorizedTournament.kind !== 'ok') {
    sendUnauthorizedOrMissingPage(response, authorizedTournament.kind);
    return;
  }

  const normalizedPlayerName = requestUrl.searchParams.get('player') ?? '';
  const submission =
    authorizedTournament.tournament.submissions[normalizedPlayerName];

  if (!submission) {
    sendHtml(
      response,
      404,
      renderErrorPage({
        title: 'Submission Not Found',
        message:
          'That player submission could not be found. Return to the organizer page and refresh the list.'
      })
    );
    return;
  }

  sendHtml(
    response,
    200,
    renderOrganizerRemovalConfirmPage({
      tournament: authorizedTournament.tournament,
      submission,
      accessToken: authorizedTournament.accessToken
    })
  );
}

async function handleRemovalRequest(
  options: OrganizerServerOptions,
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
  tournamentId: string
): Promise<void> {
  const formValues = await readFormBody(request);
  const accessToken = formValues.get('access');
  const normalizedPlayerName = formValues.get('player');

  if (
    typeof accessToken !== 'string' ||
    typeof normalizedPlayerName !== 'string'
  ) {
    sendHtml(
      response,
      400,
      renderErrorPage({
        title: 'Invalid Request',
        message: 'The remove-player request was missing required fields.'
      })
    );
    return;
  }

  const authorizedTournament = await loadAuthorizedTournament({
    tournamentStore: options.tournamentStore,
    tournamentId,
    accessToken
  });

  if (authorizedTournament.kind !== 'ok') {
    sendUnauthorizedOrMissingPage(response, authorizedTournament.kind);
    return;
  }

  const existingSubmission =
    authorizedTournament.tournament.submissions[normalizedPlayerName];

  if (!existingSubmission) {
    redirectToDashboard(response, {
      tournamentId,
      accessToken,
      notice: 'missing'
    });
    return;
  }

  const updatedTournament = await options.tournamentStore.removeSubmission({
    tournamentId,
    normalizedPlayerName
  });

  let notice = 'removed';

  if (updatedTournament && options.onTournamentChanged) {
    try {
      await options.onTournamentChanged(updatedTournament);
    } catch (error) {
      console.warn('Failed to refresh tournament state after organizer edit.', error);
      notice = 'removed-sync-warning';
    }
  }

  redirectToDashboard(response, {
    tournamentId,
    accessToken,
    notice
  });
}

async function loadAuthorizedTournament(options: {
  tournamentStore: TournamentStore;
  tournamentId: string;
  accessToken: string | null;
}): Promise<AuthorizedTournamentResult> {
  const tournament = await options.tournamentStore.getTournamentById(
    options.tournamentId
  );

  if (!tournament) {
    return { kind: 'not-found' };
  }

  if (
    !validateOrganizerAccessToken(
      tournament.organizerAccess,
      options.accessToken
    )
  ) {
    return { kind: 'forbidden' };
  }

  return {
    kind: 'ok',
    tournament,
    accessToken: options.accessToken ?? ''
  };
}

function buildOrganizerPath(options: {
  tournamentId: string;
  accessToken: string;
  notice?: string;
  player?: string;
}): string {
  const params = new URLSearchParams();

  params.set('access', options.accessToken);

  if (options.notice) {
    params.set('notice', options.notice);
  }

  if (options.player) {
    params.set('player', options.player);
  }

  return `/organizer/${encodeURIComponent(options.tournamentId)}?${params.toString()}`;
}

function buildOrganizerThreadSummaryPath(tournamentId: string): string {
  return `/organizer/${encodeURIComponent(tournamentId)}/thread-summary`;
}

function buildOrganizerPublishRequestPath(tournamentId: string): string {
  return `/organizer/${encodeURIComponent(tournamentId)}/publish-request`;
}

function buildOrganizerRemovalConfirmPath(options: {
  tournamentId: string;
  accessToken: string;
  player: string;
}): string {
  const params = new URLSearchParams();

  params.set('access', options.accessToken);
  params.set('player', options.player);
  return `/organizer/${encodeURIComponent(options.tournamentId)}/remove/confirm?${params.toString()}`;
}

function buildOrganizerRemovalPath(tournamentId: string): string {
  return `/organizer/${encodeURIComponent(tournamentId)}/remove`;
}

function redirectToDashboard(
  response: ServerResponse<IncomingMessage>,
  options: {
    tournamentId: string;
    accessToken: string;
    notice?: string;
  }
): void {
  response.statusCode = 303;
  response.setHeader(
    'Location',
    buildOrganizerPath({
      tournamentId: options.tournamentId,
      accessToken: options.accessToken,
      notice: options.notice
    })
  );
  response.end();
}

function sendUnauthorizedOrMissingPage(
  response: ServerResponse<IncomingMessage>,
  kind: 'forbidden' | 'not-found'
): void {
  if (kind === 'not-found') {
    sendHtml(
      response,
      404,
      renderErrorPage({
        title: 'Tournament Not Found',
        message: 'That tournament could not be found in the local store.'
      })
    );
    return;
  }

  sendHtml(
    response,
    403,
    renderErrorPage({
      title: 'Organizer Link Required',
      message:
        'This page requires the full organizer link from Discord. Anyone with that link can access and edit the tournament.'
    })
  );
}

async function readFormBody(
  request: IncomingMessage
): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    let body = '';

    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;

      if (body.length > 64_000) {
        reject(new Error('Organizer form body exceeded the size limit.'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(new URLSearchParams(body)));
    request.on('error', reject);
  });
}

function sendHtml(
  response: ServerResponse<IncomingMessage>,
  statusCode: number,
  html: string
): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(html);
}

function renderPageLayout(options: {
  title: string;
  body: string;
  extraBody?: string;
}): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(options.title)}</title>`,
    '<style>',
    BASE_PAGE_STYLES,
    '</style>',
    '</head>',
    '<body>',
    options.body,
    options.extraBody ?? '',
    '</body>',
    '</html>'
  ].join('\n');
}

function renderErrorPage(options: {
  title: string;
  message: string;
}): string {
  return renderPageLayout({
    title: options.title,
    body: [
      '<div class="page-shell page-shell--narrow">',
      '<section class="panel error-panel">',
      '<p class="eyebrow">Tourney Organizer</p>',
      `<h1>${escapeHtml(options.title)}</h1>`,
      `<p class="panel-copy">${escapeHtml(options.message)}</p>`,
      '</section>',
      '</div>'
    ].join('\n')
  });
}

function renderStatCard(label: string, value: string): string {
  return [
    '<article class="stat-card">',
    `<p class="stat-card__label">${escapeHtml(label)}</p>`,
    `<p class="stat-card__value">${escapeHtml(value)}</p>`,
    '</article>'
  ].join('\n');
}

function renderThreadSummaryCard(options: {
  tournamentId: string;
  accessToken: string;
  submissionDisplayMode: SubmissionDisplayMode;
}): string {
  const actionPath = buildOrganizerThreadSummaryPath(options.tournamentId);

  return [
    '<article class="stat-card stat-card--interactive">',
    '<p class="stat-card__label">Thread Summary</p>',
    `<p class="stat-card__value">${escapeHtml(
      options.submissionDisplayMode === 'count-plus-names'
        ? 'Count + player names'
        : 'Count only'
    )}</p>`,
    `<form class="stat-card__actions" method="post" action="${escapeAttribute(actionPath)}">`,
    `<input type="hidden" name="access" value="${escapeAttribute(options.accessToken)}" />`,
    renderChipButton({
      label: 'Count Only',
      name: 'mode',
      value: 'count-only',
      isActive: options.submissionDisplayMode === 'count-only'
    }),
    renderChipButton({
      label: 'Count + Names',
      name: 'mode',
      value: 'count-plus-names',
      isActive: options.submissionDisplayMode === 'count-plus-names'
    }),
    '</form>',
    '</article>'
  ].join('\n');
}

function renderPublishStatusCard(options: {
  tournamentId: string;
  accessToken: string;
  publishedAt: string | null;
}): string {
  const actionPath = buildOrganizerPublishRequestPath(options.tournamentId);

  return [
    '<article class="stat-card stat-card--interactive">',
    '<p class="stat-card__label">Publish Status</p>',
    `<p class="stat-card__value">${escapeHtml(
      options.publishedAt
        ? `Published ${formatDateTime(options.publishedAt)}`
        : 'Not published yet'
    )}</p>`,
    `<form class="stat-card__actions" method="post" action="${escapeAttribute(actionPath)}">`,
    `<input type="hidden" name="access" value="${escapeAttribute(options.accessToken)}" />`,
    `<button class="secondary-button secondary-button--compact" type="submit">${
      options.publishedAt
        ? 'Start Republish Flow'
        : 'Start Publish Flow'
    }</button>`,
    '</form>',
    '</article>'
  ].join('\n');
}

function renderChipButton(options: {
  label: string;
  name: string;
  value: string;
  isActive: boolean;
}): string {
  return `<button class="chip-button${
    options.isActive ? ' chip-button--active' : ''
  }" type="submit" name="${escapeAttribute(options.name)}" value="${escapeAttribute(
    options.value
  )}">${escapeHtml(options.label)}</button>`;
}

function renderSubmissionCard(options: {
  tournamentId: string;
  accessToken: string;
  submission: TournamentSubmission;
}): string {
  const removeHref = buildOrganizerRemovalConfirmPath({
    tournamentId: options.tournamentId,
    accessToken: options.accessToken,
    player: options.submission.normalizedPlayerName
  });

  return [
    '<article class="submission-card">',
    '<div class="submission-card__header">',
    '<div>',
    `<h3>${escapeHtml(options.submission.playerName)}</h3>`,
    `<p class="submission-card__meta">Submitted by ${escapeHtml(
      options.submission.submittedByUsername || 'Unknown user'
    )} on ${escapeHtml(formatDateTime(options.submission.submittedAt))}</p>`,
    '</div>',
    `<a class="danger-button danger-button--link" href="${escapeAttribute(removeHref)}">Remove Player</a>`,
    '</div>',
    renderSubmissionSummary(options.submission),
    '</article>'
  ].join('\n');
}

function renderSubmissionSummary(submission: TournamentSubmission): string {
  const detailItems = [
    renderDetailItem('Deck Name', submission.deckName),
    renderDetailItem('Deck Entry Type', formatDeckEntryType(submission)),
    renderDetailItem('Placement', submission.placementText ?? 'Not entered'),
    renderDetailItem('Record', submission.recordText ?? 'Not entered'),
    renderDetailItem('Archetype', submission.archetype ?? 'Not entered')
  ].join('\n');

  return [
    '<dl class="detail-grid">',
    detailItems,
    '</dl>',
    '<div class="deck-entry">',
    '<p class="deck-entry__label">Deck Entry</p>',
    renderDeckEntry(submission),
    '</div>'
  ].join('\n');
}

function renderDetailItem(label: string, value: string): string {
  return [
    '<div class="detail-grid__item">',
    `<dt>${escapeHtml(label)}</dt>`,
    `<dd>${escapeHtml(value)}</dd>`,
    '</div>'
  ].join('\n');
}

function renderDeckEntry(submission: TournamentSubmission): string {
  if (submission.decklistType === 'url') {
    return `<a class="deck-link" href="${escapeAttribute(
      submission.decklist
    )}" target="_blank" rel="noreferrer">${escapeHtml(submission.decklist)}</a>`;
  }

  if (submission.decklistType === 'image') {
    return [
      '<div class="deck-entry__stack">',
      '<p class="deck-entry__hint">Image upload saved for later review.</p>',
      `<a class="deck-link" href="${escapeAttribute(
        submission.decklist
      )}" target="_blank" rel="noreferrer">Open uploaded image</a>`,
      '</div>'
    ].join('\n');
  }

  return `<pre>${escapeHtml(submission.decklist)}</pre>`;
}

function formatDeckEntryType(submission: TournamentSubmission): string {
  if (submission.decklistType === 'url') {
    return 'Deck URL';
  }

  if (submission.decklistType === 'image') {
    return 'Image upload';
  }

  return 'Pasted decklist';
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function getNoticeMessage(value: string | null): string | null {
  switch (value) {
    case 'removed':
      return 'Player removed from the tournament.';
    case 'removed-sync-warning':
      return 'Player removed, but the Discord thread summary could not be refreshed automatically.';
    case 'missing':
      return 'That player submission is no longer in the tournament.';
    case 'thread-summary-updated':
      return 'Thread summary display updated.';
    case 'thread-summary-sync-warning':
      return 'Thread summary display updated, but the Discord thread summary could not be refreshed automatically.';
    case 'publish-flow-started':
      return 'Publish flow started in Discord.';
    case 'publish-flow-dm-unavailable':
      return 'The publish flow could not start because the organizer DMs are unavailable.';
    case 'publish-flow-no-submissions':
      return 'There are no deck submissions to publish yet.';
    case 'publish-flow-failed':
      return 'The publish flow could not be started through Discord.';
    default:
      return null;
  }
}

function isSubmissionDisplayMode(
  value: string | null
): value is SubmissionDisplayMode {
  return value === 'count-only' || value === 'count-plus-names';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

const BASE_PAGE_STYLES = `
:root {
  color-scheme: light;
  --bg: #f5efe4;
  --ink: #1f2430;
  --ink-soft: #5c6473;
  --paper: rgba(255, 252, 245, 0.92);
  --paper-strong: #fffaf1;
  --line: rgba(62, 72, 95, 0.12);
  --accent: #a33f24;
  --accent-strong: #842c14;
  --accent-soft: #f5d5c7;
  --shadow: 0 20px 50px rgba(44, 37, 28, 0.12);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: "Avenir Next", "Trebuchet MS", sans-serif;
  color: var(--ink);
  background:
    radial-gradient(circle at top left, rgba(245, 213, 199, 0.9), transparent 32%),
    linear-gradient(180deg, #efe5d3 0%, var(--bg) 42%, #f8f3ea 100%);
}

a {
  color: inherit;
}

.page-shell {
  width: min(1180px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 40px 0 64px;
}

.page-shell--narrow {
  width: min(780px, calc(100vw - 32px));
}

.hero,
.panel,
.stat-card,
.submission-card {
  border: 1px solid var(--line);
  background: var(--paper);
  box-shadow: var(--shadow);
}

.hero,
.panel {
  border-radius: 28px;
}

.hero {
  padding: 28px;
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  backdrop-filter: blur(10px);
}

.hero--compact {
  margin-bottom: 20px;
}

.hero-copy h1,
.panel h2,
.submission-card h3,
.error-panel h1 {
  margin: 0;
  font-family: Georgia, "Palatino Linotype", serif;
  letter-spacing: -0.02em;
}

.hero-copy h1,
.error-panel h1 {
  font-size: clamp(2.1rem, 4vw, 3.3rem);
}

.hero-copy__lede,
.hero-copy__body,
.panel-copy,
.submission-card__meta,
.panel-heading__meta,
.deck-entry__hint {
  color: var(--ink-soft);
}

.hero-copy__lede,
.hero-copy__body,
.panel-copy {
  max-width: 68ch;
  margin: 12px 0 0;
  line-height: 1.6;
}

.eyebrow {
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.76rem;
  color: var(--accent-strong);
  font-weight: 700;
}

.secondary-button,
.danger-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 700;
  transition: transform 140ms ease, background-color 140ms ease;
}

.secondary-button {
  border: 1px solid rgba(31, 36, 48, 0.14);
  background: var(--paper-strong);
}

.secondary-button--compact {
  width: 100%;
}

.danger-button {
  border: 0;
  background: var(--accent);
  color: white;
  cursor: pointer;
}

.danger-button--link {
  text-decoration: none;
}

.secondary-button:hover,
.danger-button:hover,
.chip-button:hover {
  transform: translateY(-1px);
}

.notice {
  margin: 20px 0 0;
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(245, 213, 199, 0.72);
  border: 1px solid rgba(163, 63, 36, 0.18);
  font-weight: 600;
}

.stats-grid {
  margin: 22px 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.stat-card {
  border-radius: 22px;
  padding: 18px;
}

.stat-card--interactive {
  display: grid;
  gap: 14px;
}

.stat-card__label {
  margin: 0 0 10px;
  color: var(--ink-soft);
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.stat-card__value {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.4;
  font-weight: 700;
}

.stat-card__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.chip-button {
  border: 1px solid rgba(31, 36, 48, 0.14);
  background: var(--paper-strong);
  color: var(--ink);
  cursor: pointer;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  font-weight: 700;
  transition: transform 140ms ease, background-color 140ms ease;
}

.chip-button--active {
  background: var(--accent-soft);
  border-color: rgba(163, 63, 36, 0.24);
  color: var(--accent-strong);
}

.panel {
  padding: 24px;
  margin-top: 22px;
}

.panel--subtle {
  background: rgba(255, 250, 241, 0.72);
}

.panel-heading,
.submission-card__header,
.action-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.panel-heading__meta,
.submission-card__meta {
  margin: 8px 0 0;
}

.submission-card {
  margin-top: 16px;
  border-radius: 24px;
  padding: 20px;
  background: var(--paper-strong);
}

.detail-grid {
  margin: 18px 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.detail-grid__item {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(245, 239, 228, 0.9);
  border: 1px solid rgba(62, 72, 95, 0.08);
}

.detail-grid dt {
  margin: 0;
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ink-soft);
}

.detail-grid dd {
  margin: 8px 0 0;
  font-weight: 700;
}

.deck-entry {
  margin-top: 18px;
  padding: 18px;
  border-radius: 20px;
  background: #fffdf8;
  border: 1px solid rgba(62, 72, 95, 0.08);
}

.deck-entry__label {
  margin: 0 0 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.76rem;
  color: var(--ink-soft);
  font-weight: 700;
}

.deck-entry__stack {
  display: grid;
  gap: 8px;
}

.deck-link {
  color: var(--accent-strong);
  font-weight: 700;
  word-break: break-word;
}

pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  border-radius: 16px;
  background: #221f1b;
  color: #f6efe5;
  font-family: "Cascadia Code", "Consolas", monospace;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-state {
  padding: 28px;
  border-radius: 22px;
  background: rgba(255, 250, 241, 0.78);
  border: 1px dashed rgba(62, 72, 95, 0.18);
}

.empty-state h3 {
  margin: 0 0 8px;
  font-family: Georgia, "Palatino Linotype", serif;
}

.confirm-form {
  display: grid;
  gap: 10px;
}

.action-row {
  margin-top: 10px;
}

.access-link {
  margin: 14px 0 0;
  font-family: "Cascadia Code", "Consolas", monospace;
  word-break: break-all;
}

@media (max-width: 720px) {
  .hero,
  .panel-heading,
  .submission-card__header,
  .action-row,
  .stat-card__actions {
    flex-direction: column;
  }

  .secondary-button,
  .danger-button,
  .chip-button {
    width: 100%;
  }
}
`;
