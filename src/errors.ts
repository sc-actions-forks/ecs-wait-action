type EcsServiceSnapshot = {
  serviceName?: string;
  status?: string;
  runningCount?: number;
  desiredCount?: number;
  pendingCount?: number;
  deployments?: Array<{
    id?: string;
    status?: string;
    runningCount?: number;
    desiredCount?: number;
    rolloutState?: string;
  }>;
};

type WaiterFailurePayload = {
  state?: string;
  reason?: {
    services?: EcsServiceSnapshot[];
    failures?: Array<{ arn?: string; reason?: string }>;
  };
};

export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}

function summarizeService(service: EcsServiceSnapshot): string {
  const name = service.serviceName ?? 'unknown-service';
  const deploymentSummary = (service.deployments ?? [])
    .map(
      (deployment) =>
        `${deployment.id ?? 'unknown'}:${deployment.status ?? 'unknown'}(${deployment.runningCount ?? 0}/${deployment.desiredCount ?? 0}, rollout=${deployment.rolloutState ?? 'unknown'})`
    )
    .join(', ');

  return [
    `${name} status=${service.status ?? 'unknown'}`,
    `running=${service.runningCount ?? 0}/${service.desiredCount ?? 0}`,
    `pending=${service.pendingCount ?? 0}`,
    deploymentSummary ? `deployments=[${deploymentSummary}]` : 'deployments=[]',
  ].join(', ');
}

export function formatWaiterError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  try {
    const parsed = JSON.parse(error.message) as WaiterFailurePayload;
    if (parsed.state === 'FAILURE' && parsed.reason) {
      const serviceSummaries = (parsed.reason.services ?? []).map(summarizeService);
      const failureSummaries = (parsed.reason.failures ?? []).map(
        (failure) => `${failure.arn ?? 'unknown'}: ${failure.reason ?? 'unknown'}`
      );

      const parts = [
        'ECS service stability check failed with an unrecoverable state.',
        ...serviceSummaries,
        ...failureSummaries,
      ].filter(Boolean);

      return parts.join(' ');
    }
  } catch {
    // Fall through to the original message.
  }

  return error.message;
}
