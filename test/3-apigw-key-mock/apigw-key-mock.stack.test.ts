import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ApigwKeyMockStack } from "../../src/3-apigw-key-mock/apigw-key-mock.stack";

test("API GW Key Mock Stack Created", () => {
  const app = new App();

  // WHEN
  const stack = new ApigwKeyMockStack(app, "MyTestStack");

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
  // api gateway has api key
  template.resourceCountIs("AWS::ApiGateway::ApiKey", 1);
  // api gateway has usage plan
  template.resourceCountIs("AWS::ApiGateway::UsagePlanKey", 1);
  // usage plan has api key
  template.hasResourceProperties("AWS::ApiGateway::UsagePlanKey", {
    KeyType: "API_KEY",
  });
  // methods has api key requirement
  template.hasResourceProperties("AWS::ApiGateway::Method", {
    ApiKeyRequired: true,
  });
});
