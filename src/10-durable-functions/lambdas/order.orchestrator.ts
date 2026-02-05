// https://www.youtube.com/watch?v=XJ80NBOwsow&t=1211s

import { APIGatewayEvent } from "aws-lambda";
import { DurableContext, withDurableExecution } from "@aws/durable-execution-sdk-js";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Order } from "./types";

const lbClient = new LambdaClient();
const sqsClient = new SQSClient();

const VIP_LAMBDA = process.env.VIP_LAMBDA || "";
const QUEUE_URL = process.env.QUEUE_URL || "";

const processVipOrder = async (ctx: DurableContext, body: Order) => {
  ctx.logger.info("Processing vip order", body);
  await ctx.waitForCallback(
    "vip-order",
    async callbackId => {
      const cmd = new InvokeCommand({
        FunctionName: VIP_LAMBDA,
        Payload: JSON.stringify({ ...body, callbackId }),
      });
      await lbClient.send(cmd);
    },
    {
      timeout: { minutes: 2 },
      retryStrategy: (err: Error, retryCount: number) => {
        if (retryCount >= 3) {
          throw err;
        }
        return { shouldRetry: true, delay: { seconds: 5 * retryCount } };
      },
    }
  );
};
const processStandardOrder = async (ctx: DurableContext, body: Order) => {
  ctx.logger.info("Processing std order", body);
  await ctx.waitForCallback(
    "standard-order",
    async callbackId => {
      const sqsParams = {
        MessageBody: JSON.stringify({ ...body, callbackId }),
        QueueUrl: QUEUE_URL,
      };
      await sqsClient.send(new SendMessageCommand(sqsParams));
    },
    {
      timeout: { minutes: 5 },
    }
  );
};

export const orchestrator = async (event: APIGatewayEvent, ctx: DurableContext) => {
  if (!event.body) throw new Error("Body is required");
  const body = JSON.parse(event.body);
  if (!body.price && isNaN(body.price)) throw new Error("Price is required");

  const isVip = body.price > 100;
  return isVip ? await processVipOrder(ctx, body) : await processStandardOrder(ctx, body);
};

export const handler = withDurableExecution(orchestrator);
