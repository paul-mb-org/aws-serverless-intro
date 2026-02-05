import { APIGatewayEvent, APIGatewayProxyResult, Handler } from "aws-lambda";
import { Todo } from "./types";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { BadRequest, Created, handleError } from "./responses";

const DB_TBL = process.env.DB_TBL || "";
const db = DynamoDBDocument.from(new DynamoDB());

export const createTodoLambda = async (event: APIGatewayEvent): Promise<Todo> => {
  if (!event.body) throw new BadRequest("Body is required");
  const body = JSON.parse(event.body);
  if (!body.title) throw new BadRequest("Title is required");

  const Item = {
    id: Math.random().toString(36).substring(2, 15),
    title: body.title,
    completed: false,
  };

  await db.put({
    TableName: DB_TBL,
    Item,
  });

  return Item;
};

export const handler: Handler<APIGatewayEvent, APIGatewayProxyResult> = async event =>
  createTodoLambda(event)
    .then(todo => new Created(todo).toJSON())
    .catch(handleError);
