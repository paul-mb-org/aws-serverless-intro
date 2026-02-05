import { SQSEvent } from "aws-lambda";
import { LambdaClient, SendDurableExecutionCallbackSuccessCommand } from "@aws-sdk/client-lambda";
import { OrderEvent } from "./types";

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body) as OrderEvent;

    console.log("Processing std order", body);
    const client = new LambdaClient();

    const cmd = new SendDurableExecutionCallbackSuccessCommand({
      CallbackId: body.callbackId,
      Result: JSON.stringify({
        // the result here
      }),
    });
    await client.send(cmd);
    console.log("Callback sent");
  }
};
