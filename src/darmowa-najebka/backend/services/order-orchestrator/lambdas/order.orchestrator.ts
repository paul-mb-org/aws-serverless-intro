import { DurableContext, withDurableExecution } from "@aws/durable-execution-sdk-js";
import { APIGatewayEvent } from "aws-lambda";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { MenuItem, Order, OrderEventDetail, OrderStatus } from "../../../shared/types";

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventbridge = new EventBridgeClient({});

const TABLE = process.env.TABLE!;
const EVENT_BUS = process.env.EVENT_BUS!;

interface CreateOrderRequest {
  customerId: string;
  item: MenuItem;
}

const checkCapacity = async (ctx: DurableContext): Promise<boolean> => {
  const result = await dynamodb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": { S: `STATUS#${OrderStatus.ACCEPTED}` },
      },
      Select: "COUNT",
    })
  );

  const openOrderCount = result.Count ?? 0;
  ctx.logger.info(`Open orders count: ${openOrderCount}`);
  return openOrderCount < 5;
};
const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus,
  bartenderId: string | undefined,
  ctx: DurableContext
): Promise<void> => {
  try {
    const now = new Date().toISOString();
    const updateExprParts = ["#status = :status", "#updatedAt = :updatedAt", "GSI1PK = :gsi1pk"];
    const exprAttrValues: Record<string, unknown> = {
      ":status": status,
      ":updatedAt": now,
      ":gsi1pk": `STATUS#${status}`,
    };

    // Only add bartenderId if it's defined (not set on initial order or rejection)
    if (bartenderId) {
      updateExprParts.push("bartenderId = :bartenderId");
      exprAttrValues[":bartenderId"] = bartenderId;
    }

    ctx.logger.info("Updating order status", { orderId, status, bartenderId });

    await dynamodb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { pk: `ORDER#${orderId}`, sk: "METADATA" },
        UpdateExpression: `SET ${updateExprParts.join(", ")}`,
        ExpressionAttributeNames: {
          "#status": "status",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: exprAttrValues,
      })
    );
  } catch (e) {
    ctx.logger.error("Failed to update order status", { error: e });
    throw e; // Re-throw so the step fails properly
  }
};

const publishEvent = async (detailType: string, detail: OrderEventDetail): Promise<void> => {
  await eventbridge.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: "bartender.orders",
          DetailType: detailType,
          Detail: JSON.stringify(detail),
          EventBusName: EVENT_BUS,
        },
      ],
    })
  );
};

export const orchestrator = async (event: APIGatewayEvent, ctx: DurableContext) => {
  if (!event.body) {
    throw new Error("Request body is required");
  }
  const body: CreateOrderRequest =
    typeof event.body === "string" ? JSON.parse(event.body) : event.body;

  try {
    const order = await ctx.step("validate-order", async () => {
      if (!body.customerId || !body.item) {
        throw new Error("customerId and item are required");
      }

      // Use API Gateway requestId as orderId so customer can subscribe to IoT immediately
      const orderId = event.requestContext?.requestId;
      if (!orderId) {
        throw new Error("requestId is required from API Gateway context");
      }

      const now = new Date().toISOString();
      const order: Order = {
        id: orderId,
        customerId: body.customerId,
        status: OrderStatus.PENDING,
        item: body.item,
        createdAt: now,
        updatedAt: now,
      };

      return order;
    });

    const hasCapacity = await ctx.step("check-capacity", async () => {
      return await checkCapacity(ctx);
    });

    if (!hasCapacity) {
      order.status = OrderStatus.REJECTED;
      await publishEvent("OrderRejected", {
        orderId: order.id,
        customerId: order.customerId,
        status: OrderStatus.REJECTED,
        item: order.item,
        reason: "No available bartender capacity",
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ orderId: order.id, status: "rejected" }),
      };
    }

    await ctx.step("create-order", async () => {
      await dynamodb.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            pk: `ORDER#${order.id}`,
            sk: "METADATA",
            GSI1PK: `STATUS#${order.status}`,
            GSI1SK: `CREATED#${order.createdAt}`,
            id: order.id,
            customerId: order.customerId,
            bartenderId: order.bartenderId,
            status: order.status,
            item: order.item, // Store as JSON string for VTL compatibility
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
          },
        })
      );
    });

    const approvalResult = await ctx.waitForCallback(
      "wait-for-acceptance",
      async callbackId => {
        await publishEvent("OrderCreated", {
          orderId: order.id,
          customerId: order.customerId,
          status: OrderStatus.PENDING,
          item: order.item,
          taskToken: callbackId,
        });
        ctx.logger.info(`Order ${order.id} created, waiting for acceptance`);
      },
      { timeout: { minutes: 5 } }
    );

    ctx.logger.info("order-accepted callback received", approvalResult);

    await ctx.step("order-accepted", async () => {
      ctx.logger.info(`Updating order status to ${OrderStatus.ACCEPTED}`);
      const parsed = JSON.parse(approvalResult);
      await updateOrderStatus(order.id, parsed.status, parsed.bartenderId, ctx);
    });

    const readyResult = await ctx.waitForCallback(
      "wait-for-ready",
      async callbackId => {
        ctx.logger.info("wait-for-ready order ", order);
        await publishEvent("OrderAccepted", {
          orderId: order.id,
          customerId: order.customerId,
          status: OrderStatus.ACCEPTED,
          item: order.item,
          bartenderId: order.bartenderId,
          taskToken: callbackId,
        });
        ctx.logger.info(`Order ${order.id} accepted, waiting for ready`);
      },
      { timeout: { minutes: 5 } }
    );

    ctx.logger.info("order-ready callback received", readyResult);

    await ctx.step("order-ready", async () => {
      ctx.logger.info(`Updating order status to ${OrderStatus.READY}`);
      const parsed = JSON.parse(readyResult);
      await updateOrderStatus(order.id, parsed.status, parsed.bartenderId, ctx);
    });

    const completedResult = await ctx.waitForCallback(
      "wait-for-completion",
      async callbackId => {
        ctx.logger.info("wait-completion", order);
        await publishEvent("OrderReadyForPickup", {
          orderId: order.id,
          customerId: order.customerId,
          status: OrderStatus.READY,
          item: order.item,
          bartenderId: order.bartenderId,
          taskToken: callbackId,
        });
        ctx.logger.info(`Order ${order.id} ready, waiting for completion`);
      },
      { timeout: { minutes: 10 } }
    );

    await ctx.step("order-completed", async () => {
      const parsed = JSON.parse(completedResult);

      await updateOrderStatus(order.id, parsed.status, parsed.bartenderId, ctx);

      await publishEvent("OrderCompleted", {
        orderId: order.id,
        customerId: order.customerId,
        status: OrderStatus.COMPLETED,
        item: order.item,
        bartenderId: order.bartenderId,
      });
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ orderId: order.id, status: "completed" }),
    };
  } catch (error) {
    const orderId = event.requestContext?.requestId;
    if (orderId) {
      await updateOrderStatus(orderId, OrderStatus.CANCELLED, undefined, ctx);
    }
    await publishEvent("OrderCancelled", {
      orderId: orderId || "unknown",
      customerId: body.customerId,
      status: OrderStatus.CANCELLED,
      item: body.item,
      reason: "Timeout waiting for response",
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ orderId: orderId || "unknown", status: "cancelled" }),
    };
  }
};

export const handler = withDurableExecution(orchestrator);
