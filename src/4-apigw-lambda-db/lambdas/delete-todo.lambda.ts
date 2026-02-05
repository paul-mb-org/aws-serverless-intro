import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { APIGatewayEvent, APIGatewayProxyResult, Handler } from "aws-lambda";
import { BadRequest, handleError } from "./responses";

const DB_TBL = process.env.DB_TBL || "";
const db = DynamoDBDocument.from(new DynamoDB());

export const deleteTodo = async (id?: string) => {
  if (!id) throw new BadRequest("ID parameter is required");

  const params = {
    TableName: DB_TBL,
    Key: { id },
  };

  await db.delete(params);
};

export const handler: Handler<APIGatewayEvent, APIGatewayProxyResult> = async event =>
  deleteTodo(event.pathParameters?.id)
    .then(() => ({
      statusCode: 204,
      body: JSON.stringify({ message: "Todo deleted successfully" }),
    }))
    .catch(handleError);
