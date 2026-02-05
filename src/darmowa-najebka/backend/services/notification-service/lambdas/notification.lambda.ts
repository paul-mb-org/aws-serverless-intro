import { EventBridgeEvent } from "aws-lambda";
import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";
import { OrderEventDetail } from "../../../shared/types";

const IOT_ENDPOINT = process.env.IOT_ENDPOINT!;

const iot = new IoTDataPlaneClient({
  endpoint: IOT_ENDPOINT,
});

export const handler = async (
  event: EventBridgeEvent<string, OrderEventDetail>
): Promise<void> => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const { orderId, customerId, status, item, taskToken, bartenderId, reason } = event.detail;

  const payload = JSON.stringify({
    orderId,
    customerId,
    status,
    item,
    taskToken,
    bartenderId,
    reason,
    eventType: event["detail-type"],
    timestamp: new Date().toISOString(),
  });

  const topic = `orders/${orderId}/status`;

  console.log(`Publishing to IoT topic: ${topic}`);
  console.log(`Payload: ${payload}`);

  await iot.send(
    new PublishCommand({
      topic,
      payload: Buffer.from(payload),
      qos: 1,
    })
  );

  console.log(`Successfully published notification for order ${orderId}`);
};
