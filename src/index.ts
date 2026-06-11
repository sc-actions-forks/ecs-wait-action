import {getInput, setFailed, setOutput} from '@actions/core';
import {ECSClient, ECSClientConfig, waitUntilServicesStable, ListServicesCommand} from '@aws-sdk/client-ecs';

type Params = {
  maxTimeoutMins: number;
  cluster: string;
  services: string[];
  verbose: boolean;
  ecsConnection: ECSClient;
};

const waitForStability = async (params: Params,maxWaitTime: number) =>
  waitUntilServicesStable({client: params.ecsConnection, maxWaitTime},{ cluster: params.cluster, services: params.services });

const customWait = async (params:Params) => {
  const maxTimeoutSecs = params.maxTimeoutMins * 60;
  let timeTakenSecs = 0;
  const startTime = Date.now(); // milliseconds
  let isStable = false;
  let currTry = 0;
  let thisTimeoutSecs = Math.floor(Math.min(600, maxTimeoutSecs));
  while (thisTimeoutSecs > 0 && timeTakenSecs < maxTimeoutSecs && !isStable) {
      currTry++;
      if (params.verbose) {
        console.info(`Waiting for service stability, try #${currTry}`);
      }
      let res = await waitForStability(params, thisTimeoutSecs);
      if (res.state === 'SUCCESS') {
        console.info('Services are stable!');
        isStable = true;
      }
      timeTakenSecs = (Date.now() - startTime) / 1000;
      thisTimeoutSecs = Math.floor(Math.min(600, maxTimeoutSecs - timeTakenSecs));
  }
  return {isStable, currTry, timeTakenSecs};
};

const createEcsConnection = ({ accessKeyId, secretAccessKey, region, sessionToken }: {accessKeyId: string, secretAccessKey: string, region: string, sessionToken?: string}) => {
  let config: ECSClientConfig = {
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
      sessionToken
    }
  } ;
  return new ECSClient(config);
  }

function isStringArray(arr: unknown): arr is string[] {
  return Array.isArray(arr) && arr.every(item => typeof item === 'string');
}

const checkServices = async (servicesString: string, ecsConnection: ECSClient, cluster: string) => {
  if (servicesString === '' || servicesString === undefined || servicesString === '*') {
    console.info('ECS services not provided, using all services in the cluster');
    const services = await ecsConnection.send(new ListServicesCommand({ cluster }));
    return services.serviceArns;
  }
  const services = JSON.parse(servicesString);

  if (!isStringArray(services)) {
    throw new Error('ECS services array must contain only strings');
  }
  if (services.length === 0) {
    throw new Error('ECS services array cannot be empty');
  }
  return services;
}

/**
 * Extracts step params from environment and context
 * @returns {Object} The params needed to run this action
 */
const extractParams = async () => {
  const accessKeyId = getInput('aws-access-key-id') || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = getInput('aws-secret-access-key') || process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const region = getInput('aws-region') || process.env.AWS_REGION;
  if (!accessKeyId || !secretAccessKey || !region) {
    setFailed(
      'AWS credentials were not found in inputs or environment variables.'
    );
    return null;
  }
  const maxTimeoutMins = parseInt(getInput('max-timeout-mins'));
  const cluster = getInput('ecs-cluster', { required: true });
  const verbose = getInput('verbose') === 'true';
  const ecsConnection = createEcsConnection({ accessKeyId, secretAccessKey, region, sessionToken });
  const services = await checkServices(getInput('ecs-services'), ecsConnection, cluster);

  const params: Params = {
    maxTimeoutMins,
    cluster,
    verbose,
    ecsConnection,
    services
  };
  return params;
};

/**
 * The GitHub Action entry point.
 */
const main = async () => {
  try {
    const params = await extractParams();

    if (!params) {
      return;
    }

    const outcome = await customWait(params);
    const timeTakenMins = Math.round(outcome.timeTakenSecs / 60);
    if (!outcome.isStable) {
      setFailed(`Service(s): ${JSON.stringify(params.services)} are not stable after ${timeTakenMins} minutes!`);
    } else {
      if (params.verbose) {
        console.log(`Service is stable after ${timeTakenMins} minutes!`);
      }
      setOutput('retries', outcome.currTry.toString());
      setOutput('time-taken-seconds', outcome.timeTakenSecs.toString());
    }
  } catch (error) {
    setFailed(error.message);
  }
};

main();
