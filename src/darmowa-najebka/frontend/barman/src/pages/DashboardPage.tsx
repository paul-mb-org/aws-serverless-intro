import { useState, useCallback, useEffect } from "react";
import { OrderCard } from "../components/OrderCard";
import { barmanApi } from "../api/barmanApi";
import { useAllOrdersSubscription } from "../hooks/useAllOrdersSubscription";
import { OrderStatus } from "@shared/types";
import type { Order, IoTNotification } from "@shared/types";

interface DashboardPageProps {
  barmanId: string;
  barmanName: string;
  onLogout: () => void;
}

export function DashboardPage({
  barmanId,
  barmanName,
  onLogout,
}: DashboardPageProps) {
  const [orders, setOrders] = useState<Map<string, Order>>(new Map());
  const [orderTokens, setOrderTokens] = useState<Map<string, string>>(new Map());
  const [loadingOrders, setLoadingOrders] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Fetch initial orders
  useEffect(() => {
    async function fetchOrders() {
      try {
        const fetchedOrders = await barmanApi.getOrders();
        const ordersMap = new Map<string, Order>();
        const tokensMap = new Map<string, string>();

        fetchedOrders.forEach((order) => {
          ordersMap.set(order.id, order);
          if (order.taskToken) {
            tokensMap.set(order.id, order.taskToken);
          }
        });

        setOrders(ordersMap);
        setOrderTokens(tokensMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch orders");
      }
    }
    fetchOrders();
  }, []);

  const handleMessage = useCallback((notification: IoTNotification) => {
    const { orderId, status, item, customerId, bartenderId, timestamp, taskToken } =
      notification;

    // Store task token if present
    if (taskToken) {
      setOrderTokens((prev) => {
        const next = new Map(prev);
        next.set(orderId, taskToken);
        return next;
      });
    }

    // Remove completed orders from the dashboard
    if (status === OrderStatus.COMPLETED) {
      setOrders((prev) => {
        const next = new Map(prev);
        next.delete(orderId);
        return next;
      });
      setOrderTokens((prev) => {
        const next = new Map(prev);
        next.delete(orderId);
        return next;
      });
      return;
    }

    // Don't show cancelled or rejected orders
    if (status === OrderStatus.CANCELLED || status === OrderStatus.REJECTED) {
      setOrders((prev) => {
        const next = new Map(prev);
        next.delete(orderId);
        return next;
      });
      return;
    }

    // Update or add order
    setOrders((prev) => {
      const next = new Map(prev);
      const existing = prev.get(orderId);
      next.set(orderId, {
        id: orderId,
        customerId,
        status,
        item: item || existing?.item || { id: "", name: "Unknown", price: 0 },
        bartenderId: bartenderId || existing?.bartenderId,
        createdAt: existing?.createdAt || timestamp,
        updatedAt: timestamp,
      });
      return next;
    });
  }, []);

  const { connected, error: iotError } = useAllOrdersSubscription({
    onMessage: handleMessage,
  });

  const handleAction = useCallback(
    async (orderId: string, newStatus: OrderStatus) => {
      const taskToken = orderTokens.get(orderId);
      if (!taskToken) {
        setError("Task token not available for this order");
        return;
      }

      setLoadingOrders((prev) => new Set(prev).add(orderId));
      setError(null);

      try {
        await barmanApi.callback(taskToken, {
          status: newStatus,
          bartenderId: barmanId,
        });
        // The IoT message will update the state
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update order");
      } finally {
        setLoadingOrders((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }
    },
    [barmanId, orderTokens]
  );

  const ordersList = Array.from(orders.values()).sort((a, b) => {
    // Sort by status: pending first, then accepted, then ready
    const statusOrder = {
      [OrderStatus.PENDING]: 0,
      [OrderStatus.ACCEPTED]: 1,
      [OrderStatus.READY]: 2,
      [OrderStatus.COMPLETED]: 3,
      [OrderStatus.CANCELLED]: 4,
      [OrderStatus.REJECTED]: 5,
    };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  const pendingCount = ordersList.filter((o) => o.status === OrderStatus.PENDING).length;
  const inProgressCount = ordersList.filter((o) => o.status === OrderStatus.ACCEPTED).length;
  const readyCount = ordersList.filter((o) => o.status === OrderStatus.READY).length;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <h1>Dashboard</h1>
          <span className="barman-name">Welcome, {barmanName}</span>
        </div>
        <div className="dashboard-header-right">
          <div className="connection-status">
            {connected ? (
              <span className="status-connected">Live</span>
            ) : iotError ? (
              <span className="status-error">Disconnected</span>
            ) : (
              <span className="status-connecting">Connecting...</span>
            )}
          </div>
          <button className="logout-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-stats">
        <div className="stat-card pending">
          <span className="stat-count">{pendingCount}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat-card in-progress">
          <span className="stat-count">{inProgressCount}</span>
          <span className="stat-label">In Progress</span>
        </div>
        <div className="stat-card ready">
          <span className="stat-count">{readyCount}</span>
          <span className="stat-label">Ready</span>
        </div>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      <main className="dashboard-content">
        {ordersList.length === 0 ? (
          <div className="dashboard-empty">
            <p>No orders yet</p>
            <span>New orders will appear here automatically</span>
          </div>
        ) : (
          <div className="orders-grid">
            {ordersList.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                taskToken={orderTokens.get(order.id)}
                loading={loadingOrders.has(order.id)}
                onAccept={() => handleAction(order.id, OrderStatus.ACCEPTED)}
                onMarkReady={() => handleAction(order.id, OrderStatus.READY)}
                onMarkCompleted={() => handleAction(order.id, OrderStatus.COMPLETED)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
