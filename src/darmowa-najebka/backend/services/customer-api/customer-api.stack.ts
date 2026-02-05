import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import {
  AwsIntegration,
  Cors,
  PassthroughBehavior,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";

type CustomerApiStackProps = StackProps & {
  table: ITable;
  orchestratorLambda: IFunction;
  orchestratorQualifiedArn: string; // Durable functions require qualified ARN
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

export class CustomerApiStack extends Stack {
  constructor(scope: Construct, id: string, props: CustomerApiStackProps) {
    super(scope, id, props);

    const { table, orchestratorLambda, orchestratorQualifiedArn } = props;

    // IAM Role for API Gateway
    const apigwRole = new Role(this, "CustomerApiGwRole", {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
    });
    table.grantReadData(apigwRole);
    orchestratorLambda.grantInvoke(apigwRole);

    // REST API
    const api = new RestApi(this, "CustomerApi", {
      restApiName: "Customer API",
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

    // POST /orders - Lambda Integration (async invocation)
    // Returns orderId immediately so customer can subscribe to IoT before processing completes
    const ordersResource = api.root.addResource("orders");
    const createOrderIntegration = new AwsIntegration({
      service: "lambda",
      path: `2015-03-31/functions/${orchestratorQualifiedArn}/invocations`,
      integrationHttpMethod: "POST",
      options: {
        credentialsRole: apigwRole,
        requestParameters: {
          "integration.request.header.X-Amz-Invocation-Type": "'Event'",
        },
        requestTemplates: {
          "application/json": `{
  "body": $input.json('$'),
  "requestContext": {
    "requestId": "$context.requestId"
  }
}`,
        },
        passthroughBehavior: PassthroughBehavior.NEVER,
        integrationResponses: [
          {
            selectionPattern: "4\\d{2}",
            statusCode: "400",
            responseParameters: corsIntegrationResponseParameters,
            responseTemplates: {
              "application/json": `{"error": "Invalid request"}`,
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
          {
            statusCode: "202",
            responseParameters: corsIntegrationResponseParameters,
            responseTemplates: {
              "application/json": `{"orderId": "$context.requestId", "status": "pending"}`,
            },
          },
        ],
      },
    });

    ordersResource.addMethod("POST", createOrderIntegration, {
      methodResponses: [
        { statusCode: "202", responseParameters: corsMethodResponseParameters },
        { statusCode: "400", responseParameters: corsMethodResponseParameters },
        { statusCode: "500", responseParameters: corsMethodResponseParameters },
      ],
    });

    // GET /orders/{orderId} - DynamoDB GetItem
    const orderIdResource = ordersResource.addResource("{orderId}");
    const getOrderIntegration = new AwsIntegration({
      service: "dynamodb",
      action: "GetItem",
      options: {
        credentialsRole: apigwRole,
        requestTemplates: {
          "application/json": `{
            "TableName": "${table.tableName}",
            "Key": {
              "pk": { "S": "ORDER#$method.request.path.orderId" },
              "sk": { "S": "METADATA" }
            }
          }`,
        },
        passthroughBehavior: PassthroughBehavior.NEVER,
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: corsIntegrationResponseParameters,
            responseTemplates: {
              "application/json": `#set($item = $input.path('$.Item'))
#if($item && $item.id && $item.id.S != "")
{
  "id": "$item.id.S",
  "customerId": "$item.customerId.S",
  "status": "$item.status.S",
  "bartenderId": "#if($item.bartenderId && $item.bartenderId.S)$item.bartenderId.S#end",
  "item": #if($item.item.S)$item.item.S#{else}#if($item.item.M)$input.json('$.Item.item.M')#{else}null#end#end,
  "createdAt": "$item.createdAt.S",
  "updatedAt": "$item.updatedAt.S"
}
#else
{"error": "Order not found"}
#end`,
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

    orderIdResource.addMethod("GET", getOrderIntegration, {
      requestParameters: {
        "method.request.path.orderId": true,
      },
      methodResponses: [
        { statusCode: "200", responseParameters: corsMethodResponseParameters },
        { statusCode: "400", responseParameters: corsMethodResponseParameters },
        { statusCode: "500", responseParameters: corsMethodResponseParameters },
      ],
    });

    // GET /menu - DynamoDB Query for menu items
    const menuResource = api.root.addResource("menu");
    const getMenuIntegration = new AwsIntegration({
      service: "dynamodb",
      action: "Query",
      options: {
        credentialsRole: apigwRole,
        requestTemplates: {
          "application/json": `{
            "TableName": "${table.tableName}",
            "KeyConditionExpression": "pk = :pk",
            "ExpressionAttributeValues": {
              ":pk": { "S": "MENU" }
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
    "id": "$item.sk.S.replace('ITEM#', '')",
    "name": "$item.name.S",
    "price": $item.price.N,
    #if($item.description)"description": "$item.description.S",#end
    #if($item.category)"category": "$item.category.S",#end
    "available": #if($item.available)$item.available.BOOL#else true#end
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

    menuResource.addMethod("GET", getMenuIntegration, {
      methodResponses: [
        { statusCode: "200", responseParameters: corsMethodResponseParameters },
        { statusCode: "400", responseParameters: corsMethodResponseParameters },
        { statusCode: "500", responseParameters: corsMethodResponseParameters },
      ],
    });
  }
}
