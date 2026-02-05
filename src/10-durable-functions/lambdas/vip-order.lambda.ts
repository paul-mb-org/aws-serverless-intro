import { OrderEvent } from "./types";
import { LambdaClient, SendDurableExecutionCallbackSuccessCommand } from "@aws-sdk/client-lambda";

const client = new LambdaClient();

export const handler = async (event: OrderEvent) => {
  if (!event.callbackId) throw new Error("callbackId is required");

  console.log("Processing vip order", event);

  const cmd = new SendDurableExecutionCallbackSuccessCommand({
    CallbackId: event.callbackId,
    Result: JSON.stringify({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }),
  });
  await client.send(cmd);
  console.log("Callback sent");
};
