import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ApiGwMockStack } from "../../src/2-apigw-mock/apigw-mock.stack";

test("API GW Mock Stack Created", () => {
  const app = new App();

  // WHEN
  const stack = new ApiGwMockStack(app, "MyTestStack");

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
});
