import { Construct } from "constructs";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { SecretValue } from "aws-cdk-lib";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as path from "node:path";

export class ExternalApiConstruct extends Construct {
  public readonly apiKeySecret: string;
  public readonly apiGwUrl: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const apiKeySecret = new Secret(this, "ExternalApiKeySecret", {
      secretStringValue: SecretValue.unsafePlainText("this_is_my_secret_api_key"),
    });
    this.apiKeySecret = apiKeySecret.secretArn;

    const apigw = new RestApi(this, "ExternalApiGw");
    const apiKey = apigw.addApiKey("ExternalApiKey", {
      value: apiKeySecret.secretValue.unsafeUnwrap(),
    });
    const usagePlan = apigw.addUsagePlan("ExternalUsagePlan", {
      apiStages: [
        {
          api: apigw,
          stage: apigw.deploymentStage,
        },
      ],
    });
    usagePlan.addApiKey(apiKey);

    const lambda = new NodejsFunction(this, "ExternalLambda", {
      entry: path.join(__dirname, "external-lambda.ts"),
      handler: "handler",
      runtime: Runtime.NODEJS_22_X,
    });

    const integration = new LambdaIntegration(lambda);
    apigw.root.addMethod("POST", integration, {
      apiKeyRequired: true,
      methodResponses: [{ statusCode: "200" }, { statusCode: "500" }],
    });

    this.apiGwUrl = apigw.url;
  }
}
