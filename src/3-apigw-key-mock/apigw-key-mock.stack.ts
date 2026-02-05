/**
 * SLIDE 2: API GATEWAY: Keys and Usage plan
 * ------------------------------------------------------------------
 * "Everything is peaceful. We trust our own frontend."
 *
 * [ Employee Dashboard ]
 * |
 * | (Trusted Traffic)
 * v
 * +-----------------------------+
 * |      EXISTING API           |
 * |-----------------------------|
 * |  - Business Logic Only      |
 * |  - No Throttling logic      |
 * |  - No API Key checks        |
 * +-----------------------------+
 *
 * * STATUS: Working perfectly.
 * * RISK: Zero.
 */

/**
 * "OLD WAY" of doing things
 * ------------------------------------------------------------------
 * "Sales sold access to 'Client A'. Now we have to protect the API."
 *
 * [ Internal Dash ]       [ 🆕 External Client A ]
 * \                       /
 * \                     /
 * v                   v
 * +-------------------------------------------+
 * |           EXISTING API (MODIFIED)         |
 * |-------------------------------------------|
 * | 🛑 middlewareToCheckEverything            | <-- COMPLEXITY
 * |                                           |
 * | ✅ executeBusinessLogic();                |
 * +-------------------------------------------+
 *
 * * * YOU HAVE TO CODE ALL THAT YOURSELF.
 */

/**
 * THE SERVERLESS WAY (Usage Plans)
 * ------------------------------------------------------------------
 * "Config over Code. Protect the Backend."
 *
 * [ Internal Dash ]   [ 🆕 Client A ]      [ 🔮 Client B (Next) ]
 * |             (ApiKey: 123..)      (ApiKey: 789..)
 * |                   |                     |
 * |           +-------v-------+     +-------v-------+
 * |           |  PLAN: BASIC  |     |  PLAN: PRO    |
 * |           | (100 req/day) |     | (Uncapped)    |
 * |           +-------+-------+     +-------+-------+
 * |                   |                     |
 * +   +-v-------------v---------------------v-------+
 * |   |             AWS API GATEWAY                 |
 * |   |    (Handles Auth, Throttling, & Quotas)     |
 * +   +---------------------+-----------------------+
 * |
 * v
 * +------------------+
 * |   EXISTING API   |
 * | (Code Untouched) |
 * +------------------+
 *
 * * RESULT: Backend logic remains pure.
 * * SCALING: Add Client C? Just create a new Key. No redeploy needed.
 */

import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { MockIntegration, Period, RestApi } from "aws-cdk-lib/aws-apigateway";

export class ApigwKeyMockStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Define Rest API GW
    const api = new RestApi(this, "MockApiGwKey");

    // Create API Key
    const apiKey = api.addApiKey("MockApiGwKey");

    // Create Usage Plan
    const usagePlan = api.addUsagePlan("MockUsagePlan", {
      apiStages: [{ api: api, stage: api.deploymentStage }],
      throttle: {
        burstLimit: 100, // bucket of tokens
        rateLimit: 10, // refill tokens per second
      },
      // quota limits applied for longer period for given usage plan
      quota: { limit: 1000, period: Period.DAY },
    });
    usagePlan.addApiKey(apiKey);

    //region Previous integration code
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
    //endregion

    // Resources
    const todosResource = api.root.addResource("todos");
    const idResource = todosResource.addResource("{id}");

    // Resource mapping
    todosResource.addMethod("GET", todosIntegration, {
      // method request
      apiKeyRequired: true,
      // method response
      methodResponses: [{ statusCode: "200" }],
    });

    todosResource.addMethod("POST", createTodoIntegration, {
      apiKeyRequired: true,
      methodResponses: [{ statusCode: "201" }, { statusCode: "400" }],
    });

    idResource.addMethod("DELETE", deleteTodoIntegration, {
      apiKeyRequired: true,
      methodResponses: [{ statusCode: "204" }, { statusCode: "400" }],
    });

    idResource.addMethod("GET", todoIntegration, {
      apiKeyRequired: true,
      methodResponses: [{ statusCode: "200" }, { statusCode: "400" }],
    });

    // OUTPUT API GW URL
    new CfnOutput(this, "ApiGwUrl", { value: api.url });
  }
}
