import { useState, useCallback } from "react";
import { QRCodeDisplay } from "./components/QRCodeDisplay";
import { KanbanBoard } from "./components/KanbanBoard";
import { useAllOrdersSubscription } from "./hooks/useAllOrdersSubscription";
import { OrderStatus } from "@shared/types";
import type { Order, IoTNotification } from "@shared/types";
import "./App.css";

function App() {
  const [orders, setOrders] = useState<Map<string, Order>>(new Map());

  const handleMessage = useCallback((notification: IoTNotification) => {
    const { orderId, status, item, customerId, bartenderId, timestamp } =
      notification;

    // Remove completed, cancelled, or rejected orders
    if (
      status === OrderStatus.COMPLETED ||
      status === OrderStatus.CANCELLED ||
      status === OrderStatus.REJECTED
    ) {
      setOrders((prev) => {
        const next = new Map(prev);
        next.delete(orderId);
        return next;
      });
      return;
    }

    // Only track accepted and ready orders for the kanban
    if (status === OrderStatus.ACCEPTED || status === OrderStatus.READY) {
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
    }
  }, []);

  const { connected, error } = useAllOrdersSubscription({
    onMessage: handleMessage,
  });

  const ordersList = Array.from(orders.values());

  return (
    <div className="kiosk-app">
      <header className="kiosk-header">
        <h1>Drink Orders</h1>
        <div className="connection-indicator">
          {connected ? (
            <span className="status-connected">Live</span>
          ) : error ? (
            <span className="status-error">Disconnected</span>
          ) : (
            <span className="status-connecting">Connecting...</span>
          )}
        </div>
      </header>

      <main className="kiosk-main">
        <aside className="kiosk-sidebar">
          <QRCodeDisplay />
        </aside>

        <section className="kiosk-content">
          <KanbanBoard orders={ordersList} />
        </section>
      </main>
    </div>
  );
}

export default App;
