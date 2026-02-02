import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { RestApi } from "aws-cdk-lib/aws-apigateway";
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";

// Top level where all resources are defined
export class ApiGwStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Api Gw Rest API
    const api = new RestApi(this, "EmptyApiGw");

    // GET '/'
    api.root.addMethod(HttpMethod.GET);

    // POST '/'
    api.root.addMethod(HttpMethod.POST);

    // GET '/test'
    api.root.addResource("test").addMethod(HttpMethod.GET);

    // DELETE '/todos'
    const todosPath = api.root.addResource("todos");
    todosPath.addMethod(HttpMethod.DELETE);
  }
}
