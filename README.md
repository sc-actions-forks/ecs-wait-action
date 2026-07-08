# AWS ECS `servicesStable` waiter (with retries)

AWS provides a way to wait for certain ECS services to become `stable`, but the built-in waiter times out after 10 minutes.\
This action waits for services to become stable and retries the waiter in 10-minute chunks until the configured total timeout is reached.

## Version pinning

Pin this action to a release tag rather than a branch:

```yaml
uses: sc-actions-forks/ecs-wait-action@v1.4.0
```

Using `@master` means every push to the default branch immediately affects your deployments.

## Inputs

### `ecs-cluster`

**Required** - _string_\
The ECS cluster that contains your services.

### `ecs-services`

_Optional_ - _string[]_\
A list of ECS services to make sure are stable. e.g. `'["service1","service2"]'`. Defaults to all services within the cluster.

### `max-timeout-mins`

_Optional_ - _integer_\
The total number of minutes to keep waiting for stability. Default `20`.\
The action retries the AWS waiter in chunks of up to 10 minutes until this budget is exhausted.

### `aws-access-key-id`

_Optional_ - _string_\
Your AWS `ACCESS_KEY_ID`.\
Must be provided as an input or defined as an environment variable.

### `aws-secret-access-key`

_Optional_ - _string_\
Your AWS `SECRET_ACCESS_KEY`.\
Must be provided as an input or defined as an environment variable.

### `aws-region`

_Optional_ - _string_\
Your AWS `REGION`.\
Must be provided as an input or defined as an environment variable.

### `verbose`

_Optional_ - _boolean_\
Whether to print additional debug messages to the console. Default `false`.

## Outputs

### `retries`

_integer_\
How many waiter chunks were attempted before success.

### `time-taken-secs`

_integer_\
How many seconds elapsed before the services became stable.

## AWS credentials and long waits

If your workflow assumes an IAM role via OIDC or another mechanism that issues short-lived session tokens, make sure the role session duration is longer than `max-timeout-mins`. Otherwise AWS credentials can expire while the action is still waiting.

The action logs a warning when `max-timeout-mins` is 55 minutes or more and a session token is present.

## Example usage

### Using all available options

```yaml
uses: sc-actions-forks/ecs-wait-action@v1.4.0
with:
  aws-access-key-id: ${{ env.AWS_ACCESS_KEY_ID }}
  aws-secret-access-key: ${{ env.AWS_SECRET_ACCESS_KEY }}
  aws-region: eu-central-1
  ecs-cluster: my-ecs-cluster
  ecs-services: '["my-ecs-service-1", "my-ecs-service-2"]'
  max-timeout-mins: 30
  verbose: false
```

### Minimal configuration

```yaml
uses: sc-actions-forks/ecs-wait-action@v1.4.0
with:
  ecs-cluster: my-ecs-cluster
```

## Development

```bash
npm install
npm test
npm run build
```
