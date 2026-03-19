import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from 'node:crypto';

import type { OrganizerAccess } from './types';

const ORGANIZER_SECRET_BYTES = 24;

export function createOrganizerAccess(): {
  organizerAccess: OrganizerAccess;
  tokenSecret: string;
} {
  const tokenSecret = randomBytes(ORGANIZER_SECRET_BYTES).toString('base64url');

  return {
    organizerAccess: {
      tokenId: randomUUID(),
      tokenSecretHash: hashOrganizerSecret(tokenSecret).toString('hex'),
      createdAt: new Date().toISOString()
    },
    tokenSecret
  };
}

export function buildOrganizerAccessToken(options: {
  tokenId: string;
  tokenSecret: string;
}): string {
  return `${options.tokenId}.${options.tokenSecret}`;
}

export function buildOrganizerStatusUrl(options: {
  baseUrl: string;
  tournamentId: string;
  accessToken: string;
}): string {
  const baseUrl = options.baseUrl.endsWith('/')
    ? options.baseUrl
    : `${options.baseUrl}/`;
  const url = new URL(`organizer/${options.tournamentId}`, baseUrl);

  url.searchParams.set('access', options.accessToken);
  return url.toString();
}

export function validateOrganizerAccessToken(
  organizerAccess: OrganizerAccess | null | undefined,
  accessToken: string | null | undefined
): boolean {
  if (!organizerAccess) {
    return false;
  }

  const parsedToken = parseOrganizerAccessToken(accessToken);
  const expectedHash = parseSecretHash(organizerAccess.tokenSecretHash);

  if (
    !parsedToken ||
    !expectedHash ||
    parsedToken.tokenId !== organizerAccess.tokenId
  ) {
    return false;
  }

  const actualHash = hashOrganizerSecret(parsedToken.tokenSecret);

  return (
    actualHash.length === expectedHash.length &&
    timingSafeEqual(actualHash, expectedHash)
  );
}

function parseOrganizerAccessToken(
  accessToken: string | null | undefined
): { tokenId: string; tokenSecret: string } | null {
  if (typeof accessToken !== 'string') {
    return null;
  }

  const trimmed = accessToken.trim();
  const separatorIndex = trimmed.indexOf('.');

  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    return null;
  }

  return {
    tokenId: trimmed.slice(0, separatorIndex),
    tokenSecret: trimmed.slice(separatorIndex + 1)
  };
}

function parseSecretHash(secretHash: string): Buffer | null {
  return /^[a-f0-9]{64}$/i.test(secretHash)
    ? Buffer.from(secretHash, 'hex')
    : null;
}

function hashOrganizerSecret(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}
