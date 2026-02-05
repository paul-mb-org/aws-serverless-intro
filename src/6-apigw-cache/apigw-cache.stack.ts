/**
 * SLIDE 3: API GATEWAY: Caching
 * ------------------------------------------------------------------
 * "The API is successful, but the Database is screaming."
 *
 * [ High Traffic ]
 * /   |    |   \
 * v    v    v    v
 * +------------------------+
 * |     EXISTING API       |
 * |   (Processing Every    |
 * |    Single Request)     |
 * +-----------+------------+
 * |
 * | (Expensive Queries)
 * v
 * +-------+-------+
 * |   DATABASE    |
 * |  (CPU: 99% 🥵)|
 * +---------------+
 *
 */

/**
 * THE "OLD WAY"
 * ------------------------------------------------------------------
 *
 * [ Request ]
 * |
 * v
 * +---------------------------------------------------+
 * |               EXISTING API (BLOATED)              |
 * |---------------------------------------------------|
 * | 1. Hash Request Parameters                        |
 * | 2. const data = await Redis.get(hash);            |
 * | 3. if (data) return JSON.parse(data);             |
 * | 4. const dbData = await DB.query();               |
 * | 5. await Redis.set(hash, JSON.stringify(dbData)); |
 * | 6. return dbData;                                 |
 * +--------+--------------------------+---------------+
 * |                          |
 * v                          v
 * +-----------+             +------------+
 * | Redis/Mem |             |  Database  |
 * +-----------+             +------------+
 *
 * * PAIN: Now you maintain the API *and* the Caching logic *and* the Redis connections.
 */

/**
 * THE SERVERLESS WAY (Managed Caching)
 * ------------------------------------------------------------------
 * "One checkbox to rule them all."
 *
 * [ Request ]
 * |
 * v
 * +----------------------------------+
 * |        AWS API GATEWAY           |
 * |  [ ENABLE CACHE: TTL 60s ✅ ]    |
 * +----------------------------------+
 * /              \
 * / (Hit?)         \ (Miss?)
 * v                  v
 * +------------+      +------------------+
 * | CACHE STORE|      |   EXISTING API   |
 * | (Managed)  |      |  (Logic + DB)    |
 * +------------+      +------------------+
 * ^                       |
 * |_______________________|
 * (Populate Cache)
 *
 * * RESULT: 99% of traffic never touches your backend.
 */

import { Construct } from "constructs";
import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";

export class ApigwCacheStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. Inline lambda that returns timestamp
    const backendLambda = new Function(this, "BackendLambda", {
      runtime: Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: Code.fromInline(`
                exports.handler = async function(event) {
                    console.log("Lambda invoked! Cache missed.");
                    const type = event.queryStringParameters?.type || 'default';
                    return {
                        statusCode: 200,
                        body: JSON.stringify({
                            message: "Hello from Lambda",
                            type: type,
                            generatedAt: new Date().toISOString() // This proves caching
                        })
                    };
                };
            `),
    });

    // 2. API Gateway with Cache Cluster Enabled
    const apigw = new RestApi(this, "ApiCacheEnabled", {
      description: "API with Caching Enabled",
      deployOptions: {
        cachingEnabled: true,
        cacheClusterEnabled: true,
        cacheClusterSize: "0.5", // Smallest size (approx $14/month if left running)
        cacheTtl: Duration.minutes(2),
      },
    });

    // 3. API Key & Usage Plan (From your snippet)
    const apiKey = apigw.addApiKey("ApiCacheEnabledApiKey");
    const usagePlan = apigw.addUsagePlan("ApiCacheEnabledUsagePlan", {
      name: "Cache Enabled Usage Plan",
      apiStages: [{ api: apigw, stage: apigw.deploymentStage }],
    });
    usagePlan.addApiKey(apiKey);

    // 4. Integration with Lambda (cache enabled)
    const integration = new LambdaIntegration(backendLambda, {
      cacheKeyParameters: ["method.request.querystring.type"],
    });

    // 5. Add Resource and Method
    const items = apigw.root.addResource("items");

    items.addMethod(HttpMethod.GET, integration, {
      apiKeyRequired: true,
      requestParameters: {
        "method.request.querystring.type": true, // true = required
      },
    });
  }
}
