export function parseMaxTimeoutMins(input: string): number {
  const value = parseInt(input, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`max-timeout-mins must be a positive integer, got: ${input}`);
  }
  return value;
}
