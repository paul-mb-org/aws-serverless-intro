import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { Effect, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import {
  AwsIntegration,
  Cors,
  JsonSchemaType,
  LambdaIntegration,
  Model,
  PassthroughBehavior,
  RequestValidator,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";

type BarmanApiStackProps = StackProps & {
  table: ITable;
};

// CORS response parameters for method responses
const corsMethodResponseParameters = {
  "method.response.header.Access-Control-Allow-Origin": true,
  "method.response.header.Access-Control-Allow-Headers": true,
  "method.response.header.Access-Control-Allow-Methods": true,
};

// CORS response parameters for integration responses
const corsIntegrationResponseParameters = {
  "method.response.header.Access-Control-Allow-Origin": "'*'",
  "method.response.header.Access-Control-Allow-Headers":
    "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
  "method.response.header.Access-Control-Allow-Methods": "'GET,POST,OPTIONS'",
};

export class BarmanApiStack extends Stack {
  constructor(scope: Construct, id: string, props: BarmanApiStackProps) {
    super(scope, id, props);

    const { table } = props;

    // IAM Role for API Gateway (for DynamoDB direct integration)
    const apigwRole = new Role(this, "BarmanApiGwRole", {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
    });
    table.grantReadWriteData(apigwRole);

    // Callback Lambda - handles durable execution callbacks
    const callbackLambda = new NodejsFunction(this, "CallbackLambda", {
      runtime: Runtime.NODEJS_22_X,
      entry: path.join(__dirname, "lambdas", "callback.lambda.ts"),
      handler: "handler",
      bundling: {
        externalModules: ["aws-sdk"],
      },
    });

    // Grant durable execution callback permissions
    callbackLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "lambda:SendDurableExecutionCallbackSuccess",
          "lambda:SendDurableExecutionCallbackFailure",
        ],
        resources: ["*"],
      })
    );

    // REST API
    const api = new RestApi(this, "BarmanApi", {
      restApiName: "Barman API",
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
      },
    });

    // Request Validators
    const bodyValidator = new RequestValidator(this, "BodyValidator", {
      restApi: api,
      validateRequestBody: true,
      validateRequestParameters: false,
    });

    // Request Models
    const addBarmanModel = new Model(this, "AddBarmanModel", {
      restApi: api,
      contentType: "application/json",
      schema: {
        type: JsonSchemaType.OBJECT,
        required: ["name"],
        properties: {
          name: { type: JsonSchemaType.STRING, minLength: 1 },
        },
      },
    });

    const callbackModel = new Model(this, "CallbackModel", {
      restApi: api,
      contentType: "application/json",
      schema: {
        type: JsonSchemaType.OBJECT,
        required: ["taskToken", "output"],
        properties: {
          taskToken: { type: JsonSchemaType.STRING, minLength: 1 },
          output: {
            type: JsonSchemaType.OBJECT,
            required: ["status", "bartenderId"],
            properties: {
              status: { type: JsonSchemaType.STRING, minLength: 1 },
              bartenderId: { type: JsonSchemaType.STRING, minLength: 1 },
            },
          },
        },
      },
    });

    // POST /barman - DynamoDB PutItem (register barman)
    const barmanResource = api.root.addResource("barman");
    const addBarmanIntegration = new AwsIntegration({
      service: "dynamodb",
      action: "PutItem",
      options: {
        credentialsRole: apigwRole,
        requestTemplates: {
          "application/json": `{
            "TableName": "${table.tableName}",
            "Item": {
              "pk": { "S": "BARMAN#$context.requestId" },
              "sk": { "S": "PROFILE" },
              "name": { "S": "$input.path('$.name')" },
              "status": { "S": "ACTIVE" },
              "activeOrderCount": { "N": "0" },
              "createdOn": { "S": "$context.requestTimeEpoch" },
              "updatedOn": { "S": "$context.requestTimeEpoch" }
            }
          }`,
        },
        passthroughBehavior: PassthroughBehavior.NEVER,
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: corsIntegrationResponseParameters,
            responseTemplates: {
              "application/json": `{
                "id": "$context.requestId",
                "message": "Barman registered"
              }`,
            },
          },
          {
            selectionPattern: "400",
            statusCode: "400",
            responseParameters: corsIntegrationResponseParameters,
            responseTemplates: {
              "application/json": `{"error": "$input.path('$.message')"}`,
            },
          },
          {
            selectionPattern: "5\\d{2}",
            statusCode: "500",
            responseParameters: corsIntegrationResponseParameters,
            responseTemplates: {
              "application/json": `{"error": "$input.path('$.message')"}`,
            },
          },
        ],
      },
    });

    barmanResource.addMethod("POST", addBarmanIntegration, {
      requestValidator: bodyValidator,
      requestModels: { "application/json": addBarmanModel },
      methodResponses: [
        { statusCode: "200", responseParameters: corsMethodResponseParameters },
        { statusCode: "400", responseParameters: corsMethodResponseParameters },
        { statusCode: "500", responseParameters: corsMethodResponseParameters },
      ],
    });

    // POST /orders/callback - Lambda integration for durable execution callback
    const ordersResource = api.root.addResource("orders");
    const callbackResource = ordersResource.addResource("callback");

    callbackResource.addMethod("POST", new LambdaIntegration(callbackLambda), {
      requestValidator: bodyValidator,
      requestModels: { "application/json": callbackModel },
    });

    // GET /orders - DynamoDB Query for pending/accepted/ready orders
    const getOrdersIntegration = new AwsIntegration({
      service: "dynamodb",
      action: "Scan",
      options: {
        credentialsRole: apigwRole,
        requestTemplates: {
          "application/json": `{
            "TableName": "${table.tableName}",
            "FilterExpression": "begins_with(pk, :prefix) AND #status IN (:pending, :accepted, :ready)",
            "ExpressionAttributeNames": {
              "#status": "status"
            },
            "ExpressionAttributeValues": {
              ":prefix": { "S": "ORDER#" },
              ":pending": { "S": "pending" },
              ":accepted": { "S": "accepted" },
              ":ready": { "S": "ready" }
            }
          }`,
        },
        passthroughBehavior: PassthroughBehavior.NEVER,
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: corsIntegrationResponseParameters,
            responseTemplates: {
              "application/json": `#set($items = $input.path('$.Items'))
[
#foreach($item in $items)
  {
    "id": "$item.id.S",
    "customerId": "$item.customerId.S",
    "status": "$item.status.S",
    "bartenderId": "#if($item.bartenderId && $item.bartenderId.S)$item.bartenderId.S#end",
    "item": #if($item.item.S)$item.item.S#{else}#if($item.item.M){"id":"$item.item.M.id.S","name":"$item.item.M.name.S","price":$item.item.M.price.N}#{else}null#end#end,
    "createdAt": "$item.createdAt.S",
    "updatedAt": "$item.updatedAt.S"
  }#if($foreach.hasNext),#end
#end
]`,
            },
          },
          {
            selectionPattern: "400",
            statusCode: "400",
            responseParameters: corsIntegrationResponseParameters,
            responseTemplates: {
              "application/json": `{"error": "$input.path('$.message')"}`,
            },
          },
          {
            selectionPattern: "5\\d{2}",
            statusCode: "500",
            responseParameters: corsIntegrationResponseParameters,
            responseTemplates: {
              "application/json": `{"error": "Internal server error"}`,
            },
          },
        ],
      },
    });

    ordersResource.addMethod("GET", getOrdersIntegration, {
      methodResponses: [
        { statusCode: "200", responseParameters: corsMethodResponseParameters },
        { statusCode: "400", responseParameters: corsMethodResponseParameters },
        { statusCode: "500", responseParameters: corsMethodResponseParameters },
      ],
    });
  }
}
