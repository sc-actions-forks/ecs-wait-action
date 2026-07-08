import { getInput } from '@actions/core';
import {
  ECSClient,
  ECSClientConfig,
  ListServicesCommand,
  waitUntilServicesStable,
} from '@aws-sdk/client-ecs';
import { SESSION_TOKEN_WARN_THRESHOLD_MINS } from './constants';
import { parseMaxTimeoutMins } from './validation';

export type ActionParams = {
  maxTimeoutMins: number;
  cluster: string;
  services: string[];
  verbose: boolean;
  ecsConnection: ECSClient;
};

export function createEcsConnection({
  accessKeyId,
  secretAccessKey,
  region,
  sessionToken,
}: {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
}): ECSClient {
  const config: ECSClientConfig = {
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
      sessionToken,
    },
  };
  return new ECSClient(config);
}

function isStringArray(arr: unknown): arr is string[] {
  return Array.isArray(arr) && arr.every((item) => typeof item === 'string');
}

export async function checkServices(
  servicesString: string,
  ecsConnection: ECSClient,
  cluster: string
): Promise<string[]> {
  if (servicesString === '' || servicesString === undefined || servicesString === '*') {
    console.info('ECS services not provided, using all services in the cluster');
    const services = await ecsConnection.send(new ListServicesCommand({ cluster }));
    return services.serviceArns ?? [];
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

export function warnIfSessionMayExpire(maxTimeoutMins: number, sessionToken?: string): void {
  if (sessionToken && maxTimeoutMins >= SESSION_TOKEN_WARN_THRESHOLD_MINS) {
    console.warn(
      `max-timeout-mins is ${maxTimeoutMins}. Ensure your IAM role session duration exceeds this value or AWS credentials may expire before the wait completes.`
    );
  }
}

export async function extractParams(): Promise<ActionParams | null> {
  const accessKeyId = getInput('aws-access-key-id') || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = getInput('aws-secret-access-key') || process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const region = getInput('aws-region') || process.env.AWS_REGION;

  if (!accessKeyId || !secretAccessKey || !region) {
    return null;
  }

  const maxTimeoutMins = parseMaxTimeoutMins(getInput('max-timeout-mins'));
  const cluster = getInput('ecs-cluster', { required: true });
  const verbose = getInput('verbose') === 'true';
  const ecsConnection = createEcsConnection({
    accessKeyId,
    secretAccessKey,
    region,
    sessionToken,
  });
  const services = await checkServices(getInput('ecs-services'), ecsConnection, cluster);

  warnIfSessionMayExpire(maxTimeoutMins, sessionToken);

  return {
    maxTimeoutMins,
    cluster,
    verbose,
    ecsConnection,
    services,
  };
}

export function createStabilityWaitFn(params: ActionParams) {
  return (maxWaitTime: number) =>
    waitUntilServicesStable(
      { client: params.ecsConnection, maxWaitTime },
      { cluster: params.cluster, services: params.services }
    );
}
