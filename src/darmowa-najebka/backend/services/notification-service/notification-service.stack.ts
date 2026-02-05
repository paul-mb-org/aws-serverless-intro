import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { IEventBus, Rule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { CfnPolicy } from "aws-cdk-lib/aws-iot";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import path from "node:path";

type NotificationServiceStackProps = StackProps & {
  eventBus: IEventBus;
};

export class NotificationServiceStack extends Stack {
  public readonly iotEndpoint: string;

  constructor(scope: Construct, id: string, props: NotificationServiceStackProps) {
    super(scope, id, props);

    const { eventBus } = props;

    // Get the actual IoT endpoint for this account/region
    const iotEndpointResource = new AwsCustomResource(this, "IoTEndpoint", {
      onCreate: {
        service: "IoT",
        action: "describeEndpoint",
        parameters: {
          endpointType: "iot:Data-ATS",
        },
        physicalResourceId: PhysicalResourceId.of("IoTEndpointResource"),
      },
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          actions: ["iot:DescribeEndpoint"],
          resources: ["*"],
        }),
      ]),
    });

    const iotEndpointAddress = iotEndpointResource.getResponseField("endpointAddress");
    this.iotEndpoint = iotEndpointAddress;

    // IoT endpoint URL for Lambda
    const iotEndpoint = `https://${iotEndpointAddress}`;

    // IoT Policy for Cognito users (both authenticated and unauthenticated)
    new CfnPolicy(this, "CognitoIoTPolicy", {
      policyName: "DarmowaNajebkaIoTPolicy",
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["iot:Connect"],
            Resource: [
              `arn:aws:iot:${this.region}:${this.account}:client/*`,
            ],
          },
          {
            Effect: "Allow",
            Action: ["iot:Subscribe"],
            Resource: [
              `arn:aws:iot:${this.region}:${this.account}:topicfilter/orders/*`,
            ],
          },
          {
            Effect: "Allow",
            Action: ["iot:Receive"],
            Resource: [
              `arn:aws:iot:${this.region}:${this.account}:topic/orders/*`,
            ],
          },
        ],
      },
    });

    // Notification Lambda
    const notificationLambda = new NodejsFunction(this, "NotificationHandler", {
      runtime: Runtime.NODEJS_22_X,
      entry: path.join(__dirname, "lambdas/notification.lambda.ts"),
      handler: "handler",
      environment: {
        IOT_ENDPOINT: iotEndpoint,
      },
    });

    // Grant IoT publish permission
    notificationLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["iot:Publish"],
        resources: [`arn:aws:iot:${this.region}:${this.account}:topic/orders/*`],
      })
    );

    // EventBridge rule to capture all order events
    new Rule(this, "OrderEventsRule", {
      eventBus,
      eventPattern: {
        source: ["bartender.orders"],
      },
      targets: [new LambdaFunction(notificationLambda)],
    });

    // Output the IoT endpoint for frontend configuration
    new CfnOutput(this, "IoTEndpointOutput", {
      value: iotEndpointAddress,
      description: "IoT Core endpoint for WebSocket connections",
      exportName: "DarmowaNajebkaIoTEndpoint",
    });
  }
}
