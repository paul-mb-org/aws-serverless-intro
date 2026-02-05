import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaClient, SendDurableExecutionCallbackSuccessCommand } from "@aws-sdk/client-lambda";

const client = new LambdaClient();

interface CallbackRequest {
  taskToken: string;
  output: {
    status: string;
    bartenderId: string;
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };

  console.log("Received callback request:", event);

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing request body" }),
      };
    }

    const body: CallbackRequest = JSON.parse(event.body);

    if (!body.taskToken || !body.output) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing taskToken or output" }),
      };
    }

    if (!body.output.status || !body.output.bartenderId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing status or bartenderId in output" }),
      };
    }

    const cmd = new SendDurableExecutionCallbackSuccessCommand({
      CallbackId: body.taskToken,
      Result: JSON.stringify(body.output),
    });

    await client.send(cmd);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: "Callback processed" }),
    };
  } catch (error) {
    console.error("Callback error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Failed to process callback",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
