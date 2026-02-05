import { useCallback } from "react";
import { useIoT } from "@shared/hooks/useIoT";
import type { IoTNotification, Order, OrderStatus } from "@shared/types";

interface UseOrderSubscriptionOptions {
  orderId: string;
  onStatusUpdate: (status: OrderStatus, notification: IoTNotification) => void;
}

export function useOrderSubscription({
  orderId,
  onStatusUpdate,
}: UseOrderSubscriptionOptions) {
  const handleMessage = useCallback(
    (notification: IoTNotification) => {
      if (notification.orderId === orderId) {
        onStatusUpdate(notification.status, notification);
      }
    },
    [orderId, onStatusUpdate]
  );

  const topic = orderId ? `orders/${orderId}/status` : "";

  return useIoT(topic, handleMessage);
}

export function orderFromNotification(
  notification: IoTNotification,
  existingOrder?: Partial<Order>
): Partial<Order> {
  return {
    ...existingOrder,
    id: notification.orderId,
    customerId: notification.customerId,
    status: notification.status,
    item: notification.item || existingOrder?.item,
    bartenderId: notification.bartenderId || existingOrder?.bartenderId,
    updatedAt: notification.timestamp,
  };
}
