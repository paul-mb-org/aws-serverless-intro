import { Todo } from "./types";
import { APIGatewayEvent, APIGatewayProxyResult, Handler } from "aws-lambda";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { handleError, Ok } from "./responses";

const DB_TBL = process.env.DB_TBL || "";
const db = DynamoDBDocument.from(new DynamoDB());

export const getAllTodos = async (): Promise<Todo[]> => {
  const params = {
    TableName: DB_TBL,
  };
  const result = await db.scan(params);
  return result.Items ? (result.Items as Todo[]) : [];
};

export const handler: Handler<APIGatewayEvent, APIGatewayProxyResult> = async () =>
  getAllTodos()
    .then(todos => new Ok(todos).toJSON())
    .catch(handleError);
