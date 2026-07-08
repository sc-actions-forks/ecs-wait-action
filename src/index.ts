import { setFailed, setOutput } from '@actions/core';
import { logServiceDiagnostics } from './diagnostics';
import { formatWaiterError } from './errors';
import { createStabilityWaitFn, extractParams } from './params';
import { customWait } from './wait';

const main = async () => {
  try {
    const params = await extractParams();

    if (!params) {
      setFailed('AWS credentials were not found in inputs or environment variables.');
      return;
    }

    const outcome = await customWait({
      maxTimeoutMins: params.maxTimeoutMins,
      verbose: params.verbose,
      waitForStability: createStabilityWaitFn(params),
    });

    const timeTakenMins = Math.round(outcome.timeTakenSecs / 60);

    if (!outcome.isStable) {
      await logServiceDiagnostics(params.ecsConnection, params.cluster, params.services);
      setFailed(
        `Service(s): ${JSON.stringify(params.services)} are not stable after ${timeTakenMins} minutes!`
      );
      return;
    }

    if (params.verbose) {
      console.log(`Service is stable after ${timeTakenMins} minutes!`);
    }

    setOutput('retries', outcome.currTry.toString());
    setOutput('time-taken-seconds', outcome.timeTakenSecs.toString());
  } catch (error) {
    setFailed(formatWaiterError(error));
  }
};

main();
