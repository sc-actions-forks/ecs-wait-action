import { calculateNextChunkSecs, formatRemainingSecs } from './chunk';
import { isTimeoutError } from './errors';

export type WaiterResult = {
  state: string;
};

export type StabilityWaitFn = (maxWaitTime: number) => Promise<WaiterResult>;

export type CustomWaitParams = {
  maxTimeoutMins: number;
  verbose: boolean;
  waitForStability: StabilityWaitFn;
};

export type CustomWaitOutcome = {
  isStable: boolean;
  currTry: number;
  timeTakenSecs: number;
};

export async function customWait(params: CustomWaitParams): Promise<CustomWaitOutcome> {
  const maxTimeoutSecs = params.maxTimeoutMins * 60;
  let timeTakenSecs = 0;
  const startTime = Date.now();
  let isStable = false;
  let currTry = 0;
  let thisTimeoutSecs = calculateNextChunkSecs(maxTimeoutSecs, timeTakenSecs);

  while (thisTimeoutSecs > 0 && timeTakenSecs < maxTimeoutSecs && !isStable) {
    currTry++;
    const remainingSecs = formatRemainingSecs(maxTimeoutSecs, timeTakenSecs);

    console.info(
      `Waiting for service stability, try #${currTry} (${thisTimeoutSecs}s chunk, ${remainingSecs}s remaining)`
    );

    if (params.verbose) {
      console.info(`Starting waiter chunk #${currTry} with maxWaitTime=${thisTimeoutSecs}s`);
    }

    let result: WaiterResult;
    try {
      result = await params.waitForStability(thisTimeoutSecs);
    } catch (error) {
      if (isTimeoutError(error)) {
        timeTakenSecs = (Date.now() - startTime) / 1000;
        const remainingAfterTimeout = formatRemainingSecs(maxTimeoutSecs, timeTakenSecs);
        console.info(
          `Waiter chunk #${currTry} timed out after ${Math.floor(timeTakenSecs)}s, ${remainingAfterTimeout}s remaining — retrying...`
        );
        thisTimeoutSecs = calculateNextChunkSecs(maxTimeoutSecs, timeTakenSecs);
        continue;
      }
      throw error;
    }

    if (result.state === 'SUCCESS') {
      console.info('Services are stable!');
      isStable = true;
    }

    timeTakenSecs = (Date.now() - startTime) / 1000;
    thisTimeoutSecs = calculateNextChunkSecs(maxTimeoutSecs, timeTakenSecs);
  }

  return { isStable, currTry, timeTakenSecs };
}
