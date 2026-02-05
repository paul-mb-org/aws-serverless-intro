/**
 * AWS WORKFLOW ARCHITECTURE
 * * [ CLIENT ]
 * │ (HTTP POST)
 * ▼
 * [ API GATEWAY ]
 * │ (StartExecution)
 * ▼
 * [ STEP FUNCTIONS ]───────────────────────────────────────┐
 * │                                                        │
 * ▼                                                        │
 * < CHOICE STATE >                                         │
 * │                                                        │
 * ├─(price > 100)──┐           ┌──(price <= 100)───────────┤
 * │                ▼           ▼                           │
 * │         [ vipLambda ]   [ SQS QUEUE ]                  │
 * │                │           │ (includes Task Token)     │
 * │       ┌────────┴──────┐    ▼                           │
 * │       │ RETRY CONFIG  │ [ Worker Lambda ]              │
 * │       │ - Max: 3      │    │                           │
 * │       │ - TO: 2 min   │    │ (Processing...)           │
 * │       └────────┬──────┘    │                           │
 * │                │           ▼                           │
 * │         Success? ────► [ SendTaskSuccess ] ◄── Success?│
 * │         (Mark Done)         (w/ Token)      (Mark Done)│
 * │                │           │                           │
 * │         All Fail?          ▼                           │
 * │         (Task End)      15m Timeout? ──► [ Task Fail ] │
 * └────────────────────────────────────────────────────────┘
 */
import { Construct } from "constructs";
import { Duration, Stack } from "aws-cdk-lib";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Effect, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { LambdaInvoke, SqsSendMessage } from "aws-cdk-lib/aws-stepfunctions-tasks";
import {
  Choice,
  Condition,
  DefinitionBody,
  Fail,
  IntegrationPattern,
  JsonPath,
  Pass,
  StateMachine,
  TaskInput,
  Timeout,
} from "aws-cdk-lib/aws-stepfunctions";
import { ApigwConstruct } from "../_shared/constructs/apigw.construct";
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { AwsIntegration } from "aws-cdk-lib/aws-apigateway";

export class StepFuncStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Part 1: Infrastructure
    // 1.1 Queues
    const dlq = new Queue(this, "StandardOrderSfDlq", {
      retentionPeriod: Duration.days(14),
    });
    const queue = new Queue(this, "StandardOrderSfQueue", {
      visibilityTimeout: Duration.seconds(30),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    });

    // 1.2 Standard order Lambda
    const standardOrderLambda = new Function(this, "StandardOrderLambda", {
      runtime: Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: Code.fromInline(`
        const { SFNClient, SendTaskSuccessCommand } = require("@aws-sdk/client-sfn");
        const client = new SFNClient();

        exports.handler = async (event) => {
          for (const record of event.Records) {
            const body = JSON.parse(record.body);
            console.log("Worker processing from SQS:", body);
            
            // The Token was inside the SQS message
            const taskToken = body.token; 

            const command = new SendTaskSuccessCommand({
              taskToken: taskToken,
              output: JSON.stringify({ status: "STANDARD_COMPLETED", processedBy: "WorkerLambda" })
            });
            
            await client.send(command);
          }
        };
      `),
    });

    // 1.3 callbackPolicy for Lambda
    const callbackPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["states:SendTaskSuccess", "states:SendTaskFailure", "states:SendTaskHeartbeat"],
      resources: ["*"],
    });
    standardOrderLambda.addToRolePolicy(callbackPolicy);

    // 1.4 Grant permissions Queues
    queue.grantConsumeMessages(standardOrderLambda);
    dlq.grantSendMessages(standardOrderLambda);

    // 1.5 Queue integration with Standard Lambda
    standardOrderLambda.addEventSource(new SqsEventSource(queue));

    // 1.6 Vip Order Lambda
    const vipLambda = new Function(this, "ProcessVIPOrder", {
      runtime: Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: Code.fromInline(`
                const { SFNClient, SendTaskSuccessCommand } = require("@aws-sdk/client-sfn");
                const client = new SFNClient();
        
                exports.handler = async (event) => {
                  console.log("VIP Lambda processing:", event);
                  
                  const command = new SendTaskSuccessCommand({
                    taskToken: event.token, // We passed this in from the State Machine
                    output: JSON.stringify({ status: "VIP_COMPLETED", processedBy: "VipLambda" })
                  });
                  
                  await client.send(command);
                  return "Work initiated";
                };
              `),
    });
    vipLambda.addToRolePolicy(callbackPolicy);

    // States
    const success = new Pass(this, "OrderSuccess");
    const fail = new Fail(this, "OrderFailed");

    // Part 2: Branch A: Vip order processor
    const vipTask = new LambdaInvoke(this, "ProcessVIPOrderTask", {
      lambdaFunction: vipLambda,
      integrationPattern: IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      payload: TaskInput.fromObject({
        token: JsonPath.taskToken,
        input: JsonPath.entirePayload,
      }),
      taskTimeout: Timeout.duration(Duration.minutes(2)), // Timeout if no callback within 2min
    }).addCatch(fail, { resultPath: "$.error" });

    vipTask.addRetry({
      errors: ["States.Timeout"], // only retry on timeout (not on other errors)
      interval: Duration.seconds(5), // wait 5 seconds between retries
      maxAttempts: 3,
      backoffRate: 2.0, // exponential backoff, 2x the previous retry interval 10s, 20s...
    });

    // Part 3: Branch B: Standard order processor
    const standardTask = new SqsSendMessage(this, "EnqueueStandardOrderTask", {
      queue,
      integrationPattern: IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      messageBody: TaskInput.fromObject({
        token: JsonPath.taskToken,
        input: JsonPath.entirePayload,
      }),
    }).addCatch(fail, { resultPath: "$.error" });

    // Part 4: Choice
    const choice = new Choice(this, "OrderPriceCheck")
      .when(Condition.numberGreaterThan("$.price", 100), vipTask.next(success))
      .otherwise(standardTask.next(success));

    // Part 6. State Machine
    const stateMachine = new StateMachine(this, "OrderStateMachine", {
      definitionBody: DefinitionBody.fromChainable(choice),
      timeout: Duration.minutes(6),
    });

    // Part 7: Api GW
    const api = new ApigwConstruct(this, "OrderApiGw");
    const apiRole = new Role(this, "ApiRoleStepFunc", {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
    });

    // grant permissions
    stateMachine.grantStartExecution(apiRole);

    const smIntegration = new AwsIntegration({
      service: "states",
      action: "StartExecution",
      options: {
        credentialsRole: apiRole,
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              // Return the Execution ARN to the client so they can track it
              "application/json":
                '{"executionId": "$util.parseJson($input.json(\'$\')).executionArn"}',
            },
          },
        ],
        requestTemplates: {
          "application/json": JSON.stringify({
            stateMachineArn: stateMachine.stateMachineArn,
            input: "$util.escapeJavaScript($input.json('$'))",
          }),
        },
      },
    });

    api.apiGw.root.addMethod(HttpMethod.POST, smIntegration, {
      methodResponses: [{ statusCode: "200" }],
      apiKeyRequired: true,
    });
  }
}
