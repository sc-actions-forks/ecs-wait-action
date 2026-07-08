import { DescribeServicesCommand, ECSClient } from '@aws-sdk/client-ecs';

export async function logServiceDiagnostics(
  ecsConnection: ECSClient,
  cluster: string,
  services: string[]
): Promise<void> {
  const result = await ecsConnection.send(
    new DescribeServicesCommand({ cluster, services })
  );

  console.error('ECS service state at timeout:');

  for (const service of result.services ?? []) {
    console.error(
      `  ${service.serviceName}: status=${service.status}, running=${service.runningCount}/${service.desiredCount}, pending=${service.pendingCount}, deployments=${service.deployments?.length ?? 0}`
    );

    for (const deployment of service.deployments ?? []) {
      console.error(
        `    deployment ${deployment.id}: status=${deployment.status}, running=${deployment.runningCount}/${deployment.desiredCount}, rolloutState=${deployment.rolloutState ?? 'n/a'}`
      );
    }
  }

  for (const failure of result.failures ?? []) {
    console.error(`  DescribeServices failure: ${failure.arn} - ${failure.reason}`);
  }
}
