import { describe, expect, it } from 'vitest';

import {
  buildSubmission,
  formatAcknowledgement,
  normalizeResponse
} from '../src/submission';

describe('normalizeResponse', () => {
  it('trims and collapses repeated whitespace', () => {
    expect(normalizeResponse('  hello   world  ')).toBe('hello world');
  });
});

describe('buildSubmission', () => {
  it('creates a typed submission object from the captured message', () => {
    const submission = buildSubmission({
      interactionId: 'abc123',
      user: {
        id: 'user-1',
        username: 'player-one'
      } as never,
      message: {
        channelId: 'dm-1',
        content: '  ready   to play ',
        createdAt: new Date('2026-03-17T16:00:00.000Z')
      } as never
    });

    expect(submission).toEqual({
      interactionId: 'abc123',
      userId: 'user-1',
      username: 'player-one',
      channelId: 'dm-1',
      response: 'ready to play',
      receivedAt: '2026-03-17T16:00:00.000Z'
    });
  });
});

describe('formatAcknowledgement', () => {
  it('includes the username and the captured response', () => {
    expect(
      formatAcknowledgement({
        interactionId: 'abc123',
        userId: 'user-1',
        username: 'player-one',
        channelId: 'dm-1',
        response: 'ready to play',
        receivedAt: '2026-03-17T16:00:00.000Z'
      })
    ).toContain('I recorded your response');
  });
});
