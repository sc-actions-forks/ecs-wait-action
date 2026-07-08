/** ECS servicesStable waiter requires maxWaitTime > minDelay (15s). */
export const MIN_WAITER_DELAY_SECS = 16;

/** Maximum duration of a single AWS waiter chunk. */
export const MAX_CHUNK_SECS = 600;

/** Warn when session tokens may expire before the wait completes. */
export const SESSION_TOKEN_WARN_THRESHOLD_MINS = 55;
