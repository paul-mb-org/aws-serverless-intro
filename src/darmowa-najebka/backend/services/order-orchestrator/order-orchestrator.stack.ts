import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Alias, Runtime } from "aws-cdk-lib/aws-lambda";
import path from "node:path";
import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { IEventBus } from "aws-cdk-lib/aws-events";

type OrderOrchestratorProps = StackProps & {
  table: ITable;
  eventBus: IEventBus;
};

export class OrderOrchestratorStack extends Stack {
  public readonly orchestratorLambda: NodejsFunction;
  public readonly orchestratorAlias: Alias;

  constructor(scope: Construct, id: string, props: OrderOrchestratorProps) {
    super(scope, id, props);
    const { table, eventBus } = props as OrderOrchestratorProps;

    this.orchestratorLambda = new NodejsFunction(this, "DurableFunction", {
      runtime: Runtime.NODEJS_22_X,
      entry: path.join(__dirname, "lambdas/order.orchestrator.ts"),
      durableConfig: {
        executionTimeout: Duration.minutes(15),
        retentionPeriod: Duration.days(1),
      },
      environment: {
        TABLE: table.tableName,
        EVENT_BUS: eventBus.eventBusName,
      },
    });

    // Create alias for stable qualified ARN (durable functions require qualified ARN)
    this.orchestratorAlias = new Alias(this, "DurableFunctionAlias", {
      aliasName: "live",
      version: this.orchestratorLambda.currentVersion,
    });

    // Grant permissions
    table.grantReadWriteData(this.orchestratorLambda);
    eventBus.grantPutEventsTo(this.orchestratorLambda);
  }
}
