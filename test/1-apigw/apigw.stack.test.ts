import { App } from "aws-cdk-lib";
import { ApiGwStack } from "../../src/1-apigw/apigw.stack";
import { Template } from "aws-cdk-lib/assertions";

test("API GW Stack Created", () => {
  const app = new App();

  // WHEN
  const stack = new ApiGwStack(app, "MyTestStack");

  // THEN
  const template = Template.fromStack(stack);
  template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
  template.resourceCountIs("AWS::ApiGateway::Method", 4);
  template.hasResourceProperties("AWS::ApiGateway::Resource", {
    PathPart: "todos",
  });
  template.hasResourceProperties("AWS::ApiGateway::Resource", {
    PathPart: "test",
  });

  // Check if /todos has DELETE method
  const todosResources = template.findResources("AWS::ApiGateway::Resource", {
    Properties: { PathPart: "todos" },
  });
  const [todosLogicalId] = Object.keys(todosResources);
  expect(todosLogicalId).toBeDefined();

  template.hasResourceProperties("AWS::ApiGateway::Method", {
    HttpMethod: "DELETE",
    ResourceId: { Ref: todosLogicalId },
  });
});
