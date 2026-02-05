import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApigwConstruct } from "../_shared/constructs/apigw.construct";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { AwsIntegration, PassthroughBehavior } from "aws-cdk-lib/aws-apigateway";

export class ApigwDbStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Define Rest API GW / Api Key / Usage Plan
    const api = new ApigwConstruct(this, "LambdaDbApiGw");

    // DynamoDB
    const db = new Table(this, "TodoDb", {
      tableName: "TodosDirect",
      partitionKey: { name: "id", type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY, // for testing purposes only
    });

    // IAM Role for API Gateway to access DynamoDB
    const apigwRole = new Role(this, "ApiDirectRole", {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
    });
    db.grantReadWriteData(apigwRole);

    //region DB Ops
    // 1. GET All Todos - Scan
    const getAllIntegration = new AwsIntegration({
      service: "dynamodb",
      action: "Scan",
      options: {
        credentialsRole: apigwRole,
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              "application/json": `#set($dbResponse = $input.path('$'))
                [
                #foreach($item in $dbResponse.Items)
                  {
                    "id": "$item.id.S",
                    "title": "$item.title.S",
                    "completed": $item.completed.BOOL
                  }#if($foreach.hasNext),#end
                #end
                ]`,
            },
          },
          {
            selectionPattern: "400",
            statusCode: "400",
            responseTemplates: { "application/json": "$input.path('$.message')" },
          },
          {
            selectionPattern: "5\\d{2}",
            statusCode: "500",
            responseTemplates: { "application/json": "$input.path('$.message')" },
          },
        ],
        passthroughBehavior: PassthroughBehavior.NEVER,
        requestTemplates: {
          "application/json": JSON.stringify({
            TableName: db.tableName,
          }),
        },
      },
    });

    // 2. POST / - UpdateItem (used as PutItem to get ReturnValues)
    const createIntegration = new AwsIntegration({
      service: "dynamodb",
      action: "UpdateItem",
      options: {
        credentialsRole: apigwRole,
        integrationResponses: [
          {
            statusCode: "201",
            responseTemplates: {
              "application/json": `#set($inputRoot = $input.path('$'))
                {
                  "id": "$inputRoot.Attributes.id.S",
                  "title": "$inputRoot.Attributes.title.S",
                  "completed": $inputRoot.Attributes.completed.BOOL
                }`,
            },
          },
        ],
        passthroughBehavior: PassthroughBehavior.NEVER,
        requestTemplates: {
          "application/json": JSON.stringify({
            TableName: db.tableName,
            Key: {
              id: { S: "$context.requestId" },
            },
            UpdateExpression: "SET title = :t, completed = :c",
            ExpressionAttributeValues: {
              ":t": { S: "$input.path('$.title')" },
              ":c": { BOOL: false },
            },
            ReturnValues: "ALL_NEW",
          }),
        },
      },
    });

    // 3. GET /{id} - GetItem
    const getByIdIntegration = new AwsIntegration({
      service: "dynamodb",
      action: "GetItem",
      options: {
        credentialsRole: apigwRole,
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              "application/json": `#set($inputRoot = $input.path('$'))
                {
                  "id": "$inputRoot.Item.id.S",
                  "title": "$inputRoot.Item.title.S",
                  "completed": $inputRoot.Item.completed.BOOL
                }`,
            },
          },
          {
            selectionPattern: "400",
            statusCode: "400",
            responseTemplates: { "application/json": "$input.path('$.message')" },
          },
          {
            selectionPattern: "5\\d{2}",
            statusCode: "500",
            responseTemplates: { "application/json": "$input.path('$.message')" },
          },
        ],
        passthroughBehavior: PassthroughBehavior.NEVER,
        requestTemplates: {
          "application/json": JSON.stringify({
            TableName: db.tableName,
            Key: {
              id: { S: "$method.request.path.id" },
            },
          }),
        },
      },
    });

    // 4. DELETE /{id} - DeleteItem
    const deleteIntegration = new AwsIntegration({
      service: "dynamodb",
      action: "DeleteItem",
      options: {
        credentialsRole: apigwRole,
        integrationResponses: [
          {
            statusCode: "204",
            responseTemplates: {
              "application/json": JSON.stringify({ message: "Todo deleted successfully" }),
            },
          },
        ],
        passthroughBehavior: PassthroughBehavior.NEVER,
        requestTemplates: {
          "application/json": JSON.stringify({
            TableName: db.tableName,
            Key: {
              id: { S: "$method.request.path.id" },
            },
          }),
        },
      },
    });
    //endregion

    // Resource mapping
    const todosResource = api.apiGw.root.addResource("todos");
    const idResource = todosResource.addResource("{id}");

    const keyRequired = { apiKeyRequired: true };

    todosResource.addMethod("GET", getAllIntegration, {
      ...keyRequired,
      methodResponses: [{ statusCode: "200" }, { statusCode: "400" }, { statusCode: "500" }],
    });
    todosResource.addMethod("POST", createIntegration, {
      ...keyRequired,
      methodResponses: [{ statusCode: "201" }, { statusCode: "400" }, { statusCode: "500" }],
    });
    idResource.addMethod("GET", getByIdIntegration, {
      ...keyRequired,
      methodResponses: [{ statusCode: "200" }, { statusCode: "400" }, { statusCode: "500" }],
    });
    idResource.addMethod("DELETE", deleteIntegration, {
      ...keyRequired,
      methodResponses: [{ statusCode: "204" }],
    });
  }
}
