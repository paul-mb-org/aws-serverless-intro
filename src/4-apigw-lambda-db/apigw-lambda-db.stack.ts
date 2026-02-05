import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApigwConstruct } from "../_shared/constructs/apigw.construct";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction, NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as path from "node:path";
import { LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";

export class ApigwLambdaDbStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Define Rest API GW / Api Key / Usage Plan
    const api = new ApigwConstruct(this, "LambdaDbApiGw");

    // Define DynamoDB
    const db = new Table(this, "LambdaDbTable", {
      tableName: "todos",
      partitionKey: { name: "id", type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY, // for testing only
    });

    // ## Lambdas ##
    // 1. common lambda props
    const lambdaProps: NodejsFunctionProps = {
      environment: {
        DB_TBL: db.tableName,
      },
      runtime: Runtime.NODEJS_22_X,
      depsLockFilePath: path.join(__dirname, "lambdas/package-lock.json"),
      bundling: {
        externalModules: ["aws-sdk"],
      },
    };

    // 2. Create lambda funcs
    const getAllLambdas = new NodejsFunction(this, "GetAllTodos", {
      entry: path.join(__dirname, "lambdas/get-all-todos.lambda.ts"),
      ...lambdaProps,
    });
    const getTodoByIdLambda = new NodejsFunction(this, "GetTodoById", {
      entry: path.join(__dirname, "lambdas/get-todo-by-id.lambda.ts"),
      ...lambdaProps,
    });
    const createTodoLambda = new NodejsFunction(this, "CreateTodo", {
      entry: path.join(__dirname, "lambdas/create-todo.lambda.ts"),
      ...lambdaProps,
    });
    const deleteTodoLambda = new NodejsFunction(this, "DeleteTodo", {
      entry: path.join(__dirname, "lambdas/delete-todo.lambda.ts"),
      ...lambdaProps,
    });

    // 3. Grant DB access to Lambda IAM role
    db.grantReadData(getAllLambdas);
    db.grantReadData(getTodoByIdLambda);
    db.grantWriteData(createTodoLambda);
    db.grantReadWriteData(deleteTodoLambda);

    // 4. Create lambda integration
    const getAllLambdaIntegration = new LambdaIntegration(getAllLambdas);
    const getTodoByIdLambdaIntegration = new LambdaIntegration(getTodoByIdLambda);
    const createTodoLambdaIntegration = new LambdaIntegration(createTodoLambda);
    const deleteTodoLambdaIntegration = new LambdaIntegration(deleteTodoLambda);

    // 5. map resources
    const todosResource = api.apiGw.root.addResource("todos");
    const idResource = todosResource.addResource("{id}");

    const keyRequired = { apiKeyRequired: true };

    todosResource.addMethod(HttpMethod.GET, getAllLambdaIntegration, keyRequired);
    idResource.addMethod(HttpMethod.GET, getTodoByIdLambdaIntegration, keyRequired);
    todosResource.addMethod(HttpMethod.POST, createTodoLambdaIntegration, keyRequired);
    idResource.addMethod(HttpMethod.DELETE, deleteTodoLambdaIntegration, keyRequired);
  }
}
