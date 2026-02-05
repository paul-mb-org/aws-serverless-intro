import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { customerApi } from "../api/customerApi";
import { useOrderSubscription, orderFromNotification } from "../hooks/useOrderSubscription";
import { OrderStatusDisplay } from "../components/OrderStatus";
import type { Order, IoTNotification, OrderStatus } from "@shared/types";

export function OrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Partial<Order> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string | undefined>();

  useEffect(() => {
    if (!orderId) {
      navigate("/");
      return;
    }

    async function fetchOrder() {
      try {
        const fetchedOrder = await customerApi.getOrder(orderId!);
        setOrder(fetchedOrder);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load order");
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [orderId, navigate]);

  const handleStatusUpdate = useCallback(
    (status: OrderStatus, notification: IoTNotification) => {
      setOrder((prev) => orderFromNotification(notification, prev ?? undefined));
      if (notification.reason) {
        setReason(notification.reason);
      }
    },
    []
  );

  const { connected, error: iotError } = useOrderSubscription({
    orderId: orderId || "",
    onStatusUpdate: handleStatusUpdate,
  });

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">Loading order...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="error-message">{error}</div>
        <button className="primary-button" onClick={() => navigate("/")}>
          Back to Menu
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page-container">
        <div className="error-message">Order not found</div>
        <button className="primary-button" onClick={() => navigate("/")}>
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Order Status</h1>
        <p className="order-id">Order #{orderId?.slice(-8)}</p>
      </header>

      <div className="order-details">
        {order.item && (
          <div className="order-item-info">
            <h2>{order.item.name}</h2>
            <p className="order-price">${order.item.price.toFixed(2)}</p>
          </div>
        )}

        {order.status && (
          <OrderStatusDisplay status={order.status} reason={reason} />
        )}

        <div className="connection-status">
          {connected ? (
            <span className="connected">Live updates active</span>
          ) : iotError ? (
            <span className="disconnected">Updates unavailable</span>
          ) : (
            <span className="connecting">Connecting...</span>
          )}
        </div>
      </div>

      <button className="secondary-button" onClick={() => navigate("/")}>
        Order Another Drink
      </button>
    </div>
  );
}
