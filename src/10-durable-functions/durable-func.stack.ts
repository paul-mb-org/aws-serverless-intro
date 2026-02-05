/**
 * SLIDE AWS: DURABLE FUNCTIONS
 * ------------------------------------------------------------------
 * "The Workflow is the Code. No external orchestrator needed."
 *
 * import { withDurableExecution } from '@aws/durable-execution-sdk-js';
 *
 * export const handler = withDurableExecution(async (event, context) => {
 *
 * // STEP 1: PREPARE (Executed Immediately) 🏃‍♂️
 * const docId = await context.step("prepare-doc",async () => {
 *     ....
 * });
 *
 * // STEP 2: THE PAUSE (Wait for Human/Callback) ⏸️
 * // Lambda 'Stops' here. You stop paying. State is saved to storage.
 * // It can wait up to 1 year
 * await context.waitForCallback("wait", asycn () => {
 *   ....
 * });
 *
 * // STEP 3: RESUME (
 * // Function wakes up exactly here with all local variables restored.
 * await s3.upload(docId);
 *
 *
 * });
 *
 *
 * PRICING
 * ------------------------------------------------------------------
 * $8.00/million checkpoints await context.step.. context.waitForCallbck
 * $0.25/gb persisted data (used by durable execution)
 * $0.15/gb per month (state logs)
 */

import { CfnOutput, Duration, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Alias, Runtime } from "aws-cdk-lib/aws-lambda";
import * as path from "node:path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";

export class DurableFuncStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vipLambda = new NodejsFunction(this, "DfVipOrderHandler", {
      entry: path.join(__dirname, "lambdas/vip-order.lambda.ts"),
      runtime: Runtime.NODEJS_22_X,
      bundling: {
        externalModules: ["aws-sdk"],
      },
    });

    const standardLambda = new NodejsFunction(this, "DfStandardOrderHandler", {
      entry: path.join(__dirname, "lambdas/standard-order.lambda.ts"),
      runtime: Runtime.NODEJS_22_X,
      bundling: {
        externalModules: ["aws-sdk"],
      },
    });

    const queue = new Queue(this, "DfOrderQueue", {
      visibilityTimeout: Duration.minutes(5),
    });

    queue.grantConsumeMessages(standardLambda);
    standardLambda.addEventSource(new SqsEventSource(queue));

    const durableFunction = new NodejsFunction(this, "DurableFunction", {
      runtime: Runtime.NODEJS_22_X,
      entry: path.join(__dirname, "lambdas/order.orchestrator.ts"),
      durableConfig: {
        executionTimeout: Duration.minutes(15),
        retentionPeriod: Duration.days(1),
      },
      environment: {
        VIP_LAMBDA: vipLambda.functionArn,
        QUEUE_URL: queue.queueUrl,
      },
    });
    const version = durableFunction.currentVersion;
    const alias = new Alias(this, "Live", {
      aliasName: "Live",
      version,
    });
    const durablePolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "lambda:SendDurableExecutionCallbackSuccess",
        "lambda:SendDurableExecutionCallbackFailure",
      ],
      resources: ["*"],
    });

    vipLambda.addToRolePolicy(durablePolicy);
    standardLambda.addToRolePolicy(durablePolicy);

    vipLambda.grantInvoke(durableFunction);
    queue.grantSendMessages(durableFunction);

    new CfnOutput(this, "VipOrderCommand", {
      value: `aws lambda invoke --profile PR-Admin --function-name ${alias.functionName} --cli-binary-format raw-in-base64-out --payload '{"body":"{\\"title\\":\\"Car\\",\\"price\\":150}"}' response.json`,
    });
    new CfnOutput(this, "StandardOrderCommand", {
      value: `aws lambda invoke --profile PR-Admin --function-name ${alias.functionName} --cli-binary-format raw-in-base64-out --payload '{"body":"{\\"title\\":\\"Bike\\",\\"price\\":50}"}' response.json`,
    });
  }
}

// Standard
// aws lambda invoke --profile PR-Admin --function-name DurableFuncStack-DurableFunction8FC9485F-7l4Fwts0UGyC:Live --cli-binary-format raw-in-base64-out --payload '{"body":"{\"title\":\"Bike\",\"price\":50}"}' response.json

// VIP
// aws lambda invoke --profile PR-Admin --function-name DurableFuncStack-DurableFunction8FC9485F-7l4Fwts0UGyC:Live --cli-binary-format raw-in-base64-out --payload '{"body":"{\"title\":\"Car\",\"price\":150}"}' response.json
