/**
 * SLIDE 5: "FIRE AND FORGET"
 * ------------------------------------------------------------------
 * "User clicks 'Accept'. We must notify the 3rd Party Compliance API.
 * Crucial: We can NEVER lose this consent."
 *
 * [ Frontend UI ]
 * | "I Agree" ✅
 * |
 * v
 * +----------------------+      (Network Flaky? 🌩️)
 * |   OUR SYSTEM         | . . . > [ 3rd PARTY API ]
 * +----------------------+      (Service Down? ❌)
 *
 * * THE CHALLENGE:
 * 1. 3rd Party might be down or slow.
 * 2. We cannot make the user wait for the 3rd party response.
 * 3. We need guaranteed delivery (eventual consistency).
 */

/**
 * THE "OLD WAY" (Building Your Own Queue System)
 * ------------------------------------------------------------------
 * "To guarantee delivery, we had to become infrastructure engineers."
 *
 * [ Frontend ]
 * |
 * v
 * +-------------------+       +-----------------------+
 * |   EXISTING API    |------>|  REDIS / RABBITMQ 🐰  |
 * | (Producer Logic)  |       | (Self-Hosted Broker)  |
 * +-------------------+       +-----------+-----------+
 * |
 * (Queue of Pending Events)
 * v
 * +-----------------------+
 * |    WORKER SERVICE     |
 * | (Consumer Logic Code) |
 * |-----------------------|
 * | 1. Poll Queue         |
 * | 2. Backoff Strategy   |
 * | 3. Manage State       |
 * +-----------+-----------+
 * |
 * v
 * [ 3rd PARTY API ]
 *
 * * PAIN:
 * 1. Maintenance: Patching & scaling RabbitMQ/Redis.
 * 2. Complexity: Writing custom worker code to handle retries/jitter.
 * 3. Cost: Paying for idle compute on the broker and workers.
 */

/**
 * SLIDE 5.3: THE SERVERLESS WAY (Native Integration)
 * ------------------------------------------------------------------
 * "The Cloud handles the heavy lifting."
 *
 * [ Frontend ]
 * |
 * | (POST /consent)
 * v
 * +----------------------------------+
 * |        AWS API GATEWAY           |
 * | (Integration Type: AWS Service)  |
 * +----------------+-----------------+
 * |
 * | (PutEvents Action)
 * v
 * +----------------------------------+       (Built-in HTTP Retry)
 * |         EVENTBRIDGE BUS          |---------------------------> [ 3rd PARTY ]
 * |       (API Destinations)         |      (Auto Jitter/Backoff)
 * +----------------+-----------------+
 * |
 * | (Max Retries Exceeded?)
 * v
 * +----------------+
 * |      SQS       |
 * | (Dead Letter)  |  => worse case scenario redrive
 * |----------------+
 *
 * * ARCHITECTURE:
 * 1. API Gateway transforms HTTP request -> EventBridge Event.
 * 2. EventBridge handles the delivery guarantee to the 3rd party.
 * 3. ZERO application code. ZERO servers to manage.
 */

import { aws_events_targets, Duration, SecretValue, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ExternalApiConstruct } from "./external-api.construct";
import {
  ApiDestination,
  Authorization,
  Connection,
  EventBus,
  HttpMethod,
  Rule,
  RuleTargetInput,
} from "aws-cdk-lib/aws-events";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { AwsIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";

export class FireForgetStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const external = new ExternalApiConstruct(this, "ExternalApiConstruct");

    // 1. Connection
    const connection = new Connection(this, "ExternalApiConnection", {
      authorization: Authorization.apiKey(
        "x-api-key",
        SecretValue.secretsManager(external.apiKeySecret)
      ),
    });

    // 2. Destination
    const destination = new ApiDestination(this, "ExternalApiDestination", {
      connection,
      endpoint: external.apiGwUrl,
      httpMethod: HttpMethod.POST,
      rateLimitPerSecond: 100,
    });

    // 3. DLQ for failures
    const dlq = new Queue(this, "ExternalApiDLQ", {
      retentionPeriod: Duration.days(1),
    });

    // 4. Event Bus & rule
    const eb = new EventBus(this, "ConsentEventBus");
    new Rule(this, "ConsentRule", {
      eventBus: eb,
      description: "Send consent to external API",
      eventPattern: {
        source: ["com.masterborn.consent"],
        detailType: ["consent.granted"],
      },
      targets: [
        new aws_events_targets.ApiDestination(destination, {
          retryAttempts: 3,
          maxEventAge: Duration.minutes(1),
          deadLetterQueue: dlq,
          event: RuleTargetInput.fromEventPath("$.detail"),
        }),
      ],
    });

    // 5. Api GW
    const apiGwRole = new Role(this, "ConsentApiGwRole", {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
    });
    eb.grantPutEventsTo(apiGwRole);

    const ebIntegration = new AwsIntegration({
      service: "events",
      action: "PutEvents",
      options: {
        credentialsRole: apiGwRole,
        // Error tu mialem EventBridge expects AWS JSON protocol headers
        requestParameters: {
          "integration.request.header.X-Amz-Target": "'AWSEvents.PutEvents'",
          "integration.request.header.Content-Type": "'application/x-amz-json-1.1'",
        },
        requestTemplates: {
          "application/json": JSON.stringify({
            Entries: [
              {
                Source: "com.masterborn.consent",
                DetailType: "consent.granted",
                Detail: "$util.escapeJavaScript($input.body)",
                EventBusName: eb.eventBusName,
              },
            ],
          }),
        },
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              "application/json": JSON.stringify({ message: "Event sent successfully" }),
            },
          },
        ],
      },
    });

    const apiGw = new RestApi(this, "ConsentApiGw");
    apiGw.root.addMethod("POST", ebIntegration, {
      methodResponses: [{ statusCode: "200" }],
    });
  }
}
