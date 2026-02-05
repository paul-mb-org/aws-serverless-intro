import { App } from "aws-cdk-lib";
import { ApiGwStack } from "./1-apigw/apigw.stack";
import { ApiGwMockStack } from "./2-apigw-mock/apigw-mock.stack";
import { ApigwKeyMockStack } from "./3-apigw-key-mock/apigw-key-mock.stack";
import { ApigwLambdaDbStack } from "./4-apigw-lambda-db/apigw-lambda-db.stack";
import { ApigwDbStack } from "./5-apigw-direct-db/apigw-db.stack";
import { ApigwCacheStack } from "./6-apigw-cache/apigw-cache.stack";
import { StepFuncStack } from "./7-step-func/step-func.stack";
import { EventbridgeStack } from "./8-eventbridge/eventbridge.stack";
import { FireForgetStack } from "./9-fire-forget/fire-forget.stack";
import { DurableFuncStack } from "./10-durable-functions/durable-func.stack";

// Initialize CDK app
const app = new App();

// Init Stacks
new ApiGwStack(app, "ApiGwStack");
new ApiGwMockStack(app, "ApiGwMockStack");
new ApigwKeyMockStack(app, "ApigwKeyMockStack");
new ApigwLambdaDbStack(app, "ApigwLambdaDbStack");
new ApigwDbStack(app, "ApigwDbStack");
new ApigwCacheStack(app, "ApigwCacheStack");
new StepFuncStack(app, "StepFuncStack");
new EventbridgeStack(app, "EventbridgeStack");
new FireForgetStack(app, "FireForgetStack");
new DurableFuncStack(app, "DurableFuncStack");
