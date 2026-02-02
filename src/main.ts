import { App } from "aws-cdk-lib";
import { ApiGwStack } from "./1-apigw/apigw.stack";
import { ApiGwMockStack } from "./2-apigw-mock/apigw-mock.stack";

// Initialize CDK app
const app = new App();

// Init Stacks
new ApiGwStack(app, "ApiGwStack");
new ApiGwMockStack(app, "ApiGwMockStack");
