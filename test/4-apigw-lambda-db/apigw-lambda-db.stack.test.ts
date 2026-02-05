import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ApigwLambdaDbStack } from "../../src/4-apigw-lambda-db/apigw-lambda-db.stack";

test("API GW Key Mock Stack Created", () => {
  const app = new App();

  // WHEN
  const stack = new ApigwLambdaDbStack(app, "MyTestStack");

  // THEN
  const template = Template.fromStack(stack);
  template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
  template.resourceCountIs("AWS::ApiGateway::Method", 4);
  template.hasResourceProperties("AWS::ApiGateway::Resource", {
    PathPart: "todos",
  });
  template.hasResourceProperties("AWS::ApiGateway::Resource", {
    PathPart: "{id}",
  });
  template.resourceCountIs("AWS::ApiGateway::ApiKey", 1);
  template.resourceCountIs("AWS::ApiGateway::UsagePlanKey", 1);
  template.hasResourceProperties("AWS::ApiGateway::UsagePlanKey", {
    KeyType: "API_KEY",
  });
  template.hasResourceProperties("AWS::ApiGateway::Method", {
    ApiKeyRequired: true,
  });
  template.resourceCountIs("AWS::Lambda::Function", 4);
  template.resourceCountIs("AWS::DynamoDB::Table", 1);
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    TableName: "todos",
  });
});
