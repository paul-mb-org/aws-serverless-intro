import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Archive, EventBus, Match, Rule } from "aws-cdk-lib/aws-events";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { CloudWatchLogGroup, LambdaFunction, SqsQueue } from "aws-cdk-lib/aws-events-targets";

export class EventbridgeStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Part 1: Infra
    const orderBus = new EventBus(this, "OrderBus");

    const warehouseQueue = new Queue(this, "StandardOrderQueue", {
      retentionPeriod: Duration.days(14),
      // intentionally I'm not adding dlq just for testing
    });

    const vipLambda = new Function(this, "VipOrderHandler", {
      runtime: Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: Code.fromInline(`
                exports.handler = async (event) => {
                  console.log("VIP HANDLING:", event);
                  return "VIP Processed";
                };
            `),
    });

    const eventLogGroup = new LogGroup(this, "EventLogGroup", {
      logGroupName: "/aws/events/showcase-catchall",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Part 2: Rules (logic for event bridge)
    // 2.1 Vip order price > 100
    new Rule(this, "VipOrderRule", {
      eventBus: orderBus,
      eventPattern: {
        source: ["com.masterborn.orders"],
        detailType: ["order.created"],
        detail: {
          price: Match.greaterThan(100),
        },
      },
      targets: [new LambdaFunction(vipLambda)],
    });

    // 2.2 Standard order price <= 100
    new Rule(this, "StandardOrderRule", {
      eventBus: orderBus,
      eventPattern: {
        source: ["com.masterborn.orders"],
        detailType: ["order.created"],
        detail: {
          price: Match.lessThanOrEqual(100),
        },
      },
      targets: [new SqsQueue(warehouseQueue)],
    });

    // 2.3 Catch all rule
    new Rule(this, "CatchAllRule", {
      eventBus: orderBus,
      eventPattern: { source: ["com.masterborn.orders"] },
      targets: [new CloudWatchLogGroup(eventLogGroup)],
    });

    // Part 3: time machine => event replay
    new Archive(this, "OrderBusArchive", {
      sourceEventBus: orderBus,
      archiveName: "OrderBusArchive",
      description: "Archive for order events for 30 days",
      retention: Duration.days(30),
      eventPattern: { source: ["com.masterborn.orders"] },
    });

    // Outputs for demo
    new CfnOutput(this, "Command_StandardOrder", {
      value: `aws events put-events --profile PR-Admin --entries '[{"Source":"com.masterborn.orders","DetailType":"order.created","Detail":"{\\"price\\":100}","EventBusName":"${orderBus.eventBusName}"}]'`,
    });

    new CfnOutput(this, "Command_VipOrder", {
      value: `aws events put-events --profile PR-Admin --entries '[{"Source":"com.masterborn.orders","DetailType":"order.created","Detail":"{\\"price\\":150}","EventBusName":"${orderBus.eventBusName}"}]'`,
    });
  }
}

// VIP
// aws events put-events --profile PR-Admin --entries '[{"Source":"com.masterborn.orders","DetailType":"order.created","Detail":"{\"price\":150}","EventBusName":"EventbridgeStackOrderBus6B270494"}]'

// Standard
// aws events put-events --profile PR-Admin --entries '[{"Source":"com.masterborn.orders","DetailType":"order.created","Detail":"{\"price\":100}","EventBusName":"EventbridgeStackOrderBus6B270494"}]'
