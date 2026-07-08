import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateNextChunkSecs, formatRemainingSecs } from '../src/chunk';
import { MAX_CHUNK_SECS, MIN_WAITER_DELAY_SECS } from '../src/constants';
import { formatWaiterError, isTimeoutError } from '../src/errors';
import { customWait } from '../src/wait';
import { parseMaxTimeoutMins } from '../src/validation';

describe('parseMaxTimeoutMins', () => {
  it('parses a valid positive integer', () => {
    assert.equal(parseMaxTimeoutMins('30'), 30);
  });

  it('rejects zero', () => {
    assert.throws(() => parseMaxTimeoutMins('0'), /positive integer/);
  });

  it('rejects non-numeric input', () => {
    assert.throws(() => parseMaxTimeoutMins('abc'), /positive integer/);
  });

  it('rejects empty input', () => {
    assert.throws(() => parseMaxTimeoutMins(''), /positive integer/);
  });
});

describe('calculateNextChunkSecs', () => {
  it('returns the max chunk size when plenty of time remains', () => {
    assert.equal(calculateNextChunkSecs(1800, 0), MAX_CHUNK_SECS);
  });

  it('returns the remaining budget for a partial final chunk', () => {
    assert.equal(calculateNextChunkSecs(1800, 1500), 300);
  });

  it('returns zero when remaining time is at the waiter minimum', () => {
    assert.equal(
      calculateNextChunkSecs(120, 120 - MIN_WAITER_DELAY_SECS),
      0
    );
  });

  it('returns zero when remaining time is below the waiter minimum', () => {
    assert.equal(calculateNextChunkSecs(120, 115), 0);
  });
});

describe('formatRemainingSecs', () => {
  it('never returns negative values', () => {
    assert.equal(formatRemainingSecs(60, 90), 0);
  });
});

describe('isTimeoutError', () => {
  it('detects AWS waiter timeout errors', () => {
    const error = new Error('timeout');
    error.name = 'TimeoutError';
    assert.equal(isTimeoutError(error), true);
  });

  it('rejects other errors', () => {
    assert.equal(isTimeoutError(new Error('boom')), false);
  });
});

describe('formatWaiterError', () => {
  it('summarizes FAILURE waiter payloads', () => {
    const error = new Error(
      JSON.stringify({
        state: 'FAILURE',
        reason: {
          services: [
            {
              serviceName: 'my-service',
              status: 'DRAINING',
              runningCount: 1,
              desiredCount: 2,
              pendingCount: 0,
              deployments: [
                {
                  id: 'ecs-svc/123',
                  status: 'PRIMARY',
                  runningCount: 1,
                  desiredCount: 2,
                  rolloutState: 'IN_PROGRESS',
                },
              ],
            },
          ],
        },
      })
    );

    const message = formatWaiterError(error);
    assert.match(message, /unrecoverable state/);
    assert.match(message, /my-service status=DRAINING/);
    assert.match(message, /running=1\/2/);
  });

  it('returns the original message for non-JSON errors', () => {
    const error = new Error('plain failure');
    assert.equal(formatWaiterError(error), 'plain failure');
  });
});

describe('customWait', () => {
  it('retries after a waiter chunk timeout and eventually succeeds', async () => {
    const start = 1_000_000;
    let now = start;
    let waiterCalls = 0;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
      const outcome = await customWait({
        maxTimeoutMins: 30,
        verbose: false,
        waitForStability: async () => {
          waiterCalls += 1;
          if (waiterCalls === 1) {
            now = start + 500_000;
            const error = new Error('{"state":"TIMEOUT"}');
            error.name = 'TimeoutError';
            throw error;
          }
          return { state: 'SUCCESS' };
        },
      });

      assert.equal(outcome.isStable, true);
      assert.equal(outcome.currTry, 2);
      assert.equal(waiterCalls, 2);
    } finally {
      Date.now = originalNow;
    }
  });

  it('fails after exhausting the total timeout budget', async () => {
    const start = 2_000_000;
    let now = start;
    let waiterCalls = 0;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
      const outcome = await customWait({
        maxTimeoutMins: 1,
        verbose: false,
        waitForStability: async () => {
          waiterCalls += 1;
          now = start + 70_000;
          const error = new Error('{"state":"TIMEOUT"}');
          error.name = 'TimeoutError';
          throw error;
        },
      });

      assert.equal(outcome.isStable, false);
      assert.equal(waiterCalls, 1);
      assert.ok(outcome.timeTakenSecs >= 60);
    } finally {
      Date.now = originalNow;
    }
  });

  it('rethrows non-timeout waiter errors', async () => {
    await assert.rejects(
      () =>
        customWait({
          maxTimeoutMins: 30,
          verbose: false,
          waitForStability: async () => {
            throw new Error('AccessDenied');
          },
        }),
      /AccessDenied/
    );
  });

  it('stops when remaining time is below the waiter minimum delay', async () => {
    const start = 3_000_000;
    let now = start;
    let waiterCalls = 0;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
      const outcome = await customWait({
        maxTimeoutMins: 0.5,
        verbose: false,
        waitForStability: async (maxWaitTime) => {
          waiterCalls += 1;
          assert.equal(maxWaitTime, 30);
          now = start + 20_000;
          const error = new Error('{"state":"TIMEOUT"}');
          error.name = 'TimeoutError';
          throw error;
        },
      });

      assert.equal(outcome.isStable, false);
      assert.equal(waiterCalls, 1);
    } finally {
      Date.now = originalNow;
    }
  });
});
