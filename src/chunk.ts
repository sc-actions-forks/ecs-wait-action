import { MAX_CHUNK_SECS, MIN_WAITER_DELAY_SECS } from './constants';

export function calculateNextChunkSecs(
  maxTimeoutSecs: number,
  timeTakenSecs: number
): number {
  const remaining = maxTimeoutSecs - timeTakenSecs;
  if (remaining <= MIN_WAITER_DELAY_SECS) {
    return 0;
  }
  return Math.floor(Math.min(MAX_CHUNK_SECS, remaining));
}

export function formatRemainingSecs(maxTimeoutSecs: number, timeTakenSecs: number): number {
  return Math.max(0, Math.floor(maxTimeoutSecs - timeTakenSecs));
}
