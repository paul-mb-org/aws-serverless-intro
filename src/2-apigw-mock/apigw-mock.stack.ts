/**
 * SLIDE 1: ENABLE FRONTEND FROM DAY 1
 * ------------------------------------------------------------------
 *
 * [ FRONTEND APPLICATION ]
 * |
 * v
 * +-----------------------------+
 * |    AWS API GATEWAY (REST)   |
 * +-----------------------------+
 * /             \
 * / (Endpoint A)  \ (Endpoint B)
 * /   Is it done?   \
 * v                   v
 * +------------+      +------------+
 * |    NO 🚧   |      |   YES ✅   |
 * |------------|      |------------|
 * |    MOCK    |      |   LAMBDA   |
 * | INTEGRATION|      | INTEGRATION|
 * |------------|      |------------|
 * | Returns    |      | Executes   |
 * | Static JSON|      | Logic + DB |
 * +------------+      +------------+
 * ^                   ^
 * |                   |
 * Day 1 Immediate      Day N Implementation
 * Unblock              Replacement
 *
 * ------------------------------------------------------------------
 * THE STRATEGY:
 * 1. Point ALL endpoints to MOCK integration initially.
 * 2. As Backend Team finishes a Lambda, switch JUST that endpoint.
 * 3. Frontend url never changes.
 */

import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { MockIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";

export class ApiGwMockStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    /*
     Client => Api GW

     API GW Steps----
      Method Request:
          => Validates request (path/query/header)
          => Validates body (if schema is defined)
          => Handles auth (IAM, Cognito, Authorizer etc if defined)
      Integration Request:
          => Transforms request using templates (VTL)
          => Adds extra data (stage vars, context, static values)
          => Build the final request for backend
          => Calls backend
      Integration (backend):
          => Process request
          => Returns response
      Integration Response:
          => Transforms response using templates (VTL)
      Method Response:
          => Defines what responses the client is allowed to get
          => Maps integration responses to HTTP codes
          => Controls which headers/models are returned to client
     */

    // Define Rest API GW
    const api = new RestApi(this, "MockApiGw");

    // ### GET All Todos '/'
    // Integration
    const todosIntegration = new MockIntegration({
      // integration request
      requestTemplates: {
        "application/json": '{"statusCode": 200}',
      },
      // integration response
      integrationResponses: [
        {
          statusCode: "200",
          responseTemplates: {
            "application/json": JSON.stringify([
              {
                id: "1",
                title: "Test",
              },
              {
                id: "2",
                title: "Test2",
              },
            ]),
          },
        },
      ],
    });

    // Add resource and to api gw
    // add integration
    const todosResource = api.root.addResource("todos");
    todosResource.addMethod("GET", todosIntegration, {
      // method request
      requestParameters: {},
      requestModels: {},
      apiKeyRequired: false,
      // method response
      methodResponses: [{ statusCode: "200" }],
    });

    // ### Get Todo by Id '/todos/{id}'
    const todoIntegration = new MockIntegration({
      requestTemplates: {
        "application/json": `{
          #set($id = $input.params('id'))
          #if($id == "")
            "statusCode": 400
          #elseif(!$id.matches("^[0-9]+$"))
            "statusCode": 400
          #else
            "statusCode": 200
          #end
        }`,
      },
      integrationResponses: [
        {
          statusCode: "200",
          selectionPattern: "200",
          responseTemplates: {
            "application/json": JSON.stringify({
              id: "$input.params('id')",
              title: "Todo $input.params('id')",
            }),
          },
        },
        {
          statusCode: "400",
          selectionPattern: "400",
          responseTemplates: { "application/json": '{"message": "ID parameter is invalid"}' },
        },
      ],
    });

    const idResource = todosResource.addResource("{id}");
    idResource.addMethod("GET", todoIntegration, {
      methodResponses: [{ statusCode: "200" }, { statusCode: "400" }],
    });

    // ### CREATE TODO
    const createTodoIntegration = new MockIntegration({
      requestTemplates: {
        "application/json": `{
          #set($body = $input.path('$'))
          #if($body.title && $body.title != "")
            "statusCode": 201
          #else
            "statusCode": 400
          #end
      }`,
      },
      integrationResponses: [
        {
          statusCode: "201",
          selectionPattern: "201",
          responseTemplates: {
            "application/json": JSON.stringify({
              id: "1",
              msg: "Todo created successfully",
            }),
          },
        },
        {
          statusCode: "400",
          selectionPattern: "400",
          responseTemplates: {
            "application/json": JSON.stringify({
              message: "Body parameter 'title' is required",
            }),
          },
        },
      ],
    });
    todosResource.addMethod("POST", createTodoIntegration, {
      methodResponses: [{ statusCode: "201" }, { statusCode: "400" }],
    });

    // ### DELETE TODO
    const deleteTodoIntegration = new MockIntegration({
      requestTemplates: {
        "application/json": `{
                  #if($input.params('id') != "")
                    "statusCode": 204
                  #else
                    "statusCode": 400
                  #end
                }`,
      },
      integrationResponses: [
        {
          statusCode: "204",
          selectionPattern: "204",
          responseTemplates: { "application/json": "" },
        },
        {
          statusCode: "400",
          selectionPattern: "400",
          responseTemplates: { "application/json": '{"message": "ID parameter is required"}' },
        },
      ],
    });

    idResource.addMethod("DELETE", deleteTodoIntegration, {
      methodResponses: [{ statusCode: "204" }, { statusCode: "400" }],
    });

    // OUTPUT API GW URL
    new CfnOutput(this, "ApiGwUrl", { value: api.url });
  }
}
