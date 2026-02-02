import { App } from "aws-cdk-lib";
import { ApiGwStack } from "./1-apigw/apigw.stack";

// Initialize CDK app
const app = new App();

// Init Stack
new ApiGwStack(app, "ApiGwStack");
