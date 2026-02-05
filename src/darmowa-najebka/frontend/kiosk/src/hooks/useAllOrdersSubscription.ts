import { useCallback } from "react";
import { useIoT } from "@shared/hooks/useIoT";
import type { IoTNotification } from "@shared/types";

interface UseAllOrdersSubscriptionOptions {
  onMessage: (notification: IoTNotification) => void;
}

export function useAllOrdersSubscription({
  onMessage,
}: UseAllOrdersSubscriptionOptions) {
  const handleMessage = useCallback(
    (notification: IoTNotification) => {
      onMessage(notification);
    },
    [onMessage]
  );

  // Wildcard subscription for all orders
  const topic = "orders/+/status";

  return useIoT(topic, handleMessage);
}
