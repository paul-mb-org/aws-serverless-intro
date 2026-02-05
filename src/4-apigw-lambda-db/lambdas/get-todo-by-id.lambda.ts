import { APIGatewayEvent, APIGatewayProxyResult, Handler } from "aws-lambda";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { Todo } from "./types";
import { BadRequest, handleError, NotFound } from "./responses";

const DB_TBL = process.env.DB_TBL || "";
const db = DynamoDBDocument.from(new DynamoDB());

const getTodoByIdLambda = async (id?: string): Promise<Todo> => {
  if (!id) throw new BadRequest("ID parameter is required");
  const params = {
    TableName: DB_TBL,
    Key: { id },
  };
  const result = await db.get(params);
  if (result.Item === undefined) throw new NotFound("Todo not found");
  return result.Item as Todo;
};

export const handler: Handler<APIGatewayEvent, APIGatewayProxyResult> = async event =>
  getTodoByIdLambda(event.pathParameters?.id)
    .then(todos => ({ statusCode: 200, body: JSON.stringify(todos) }))
    .catch(handleError);
