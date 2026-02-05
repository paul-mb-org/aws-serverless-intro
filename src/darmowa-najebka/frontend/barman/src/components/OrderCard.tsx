import { OrderStatus } from "@shared/types";
import type { Order } from "@shared/types";

interface OrderCardProps {
  order: Order;
  taskToken?: string;
  onAccept: () => void;
  onMarkReady: () => void;
  onMarkCompleted: () => void;
  loading?: boolean;
}

const statusLabels: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "Pending",
  [OrderStatus.ACCEPTED]: "In Progress",
  [OrderStatus.READY]: "Ready for Pickup",
  [OrderStatus.COMPLETED]: "Completed",
  [OrderStatus.CANCELLED]: "Cancelled",
  [OrderStatus.REJECTED]: "Rejected",
};

const statusColors: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "#f59e0b",
  [OrderStatus.ACCEPTED]: "#3b82f6",
  [OrderStatus.READY]: "#10b981",
  [OrderStatus.COMPLETED]: "#6b7280",
  [OrderStatus.CANCELLED]: "#ef4444",
  [OrderStatus.REJECTED]: "#ef4444",
};

export function OrderCard({
  order,
  taskToken,
  onAccept,
  onMarkReady,
  onMarkCompleted,
  loading,
}: OrderCardProps) {
  const hasTaskToken = !!taskToken;

  return (
    <div className="order-card">
      <div className="order-card-header">
        <span className="order-card-id">#{order.id.slice(-8)}</span>
        <span
          className="order-card-status"
          style={{ backgroundColor: statusColors[order.status] }}
        >
          {statusLabels[order.status]}
        </span>
      </div>

      <div className="order-card-body">
        {order.item && (
          <div className="order-card-item">
            <span className="order-card-item-name">{order.item.name}</span>
            <span className="order-card-item-price">
              ${order.item.price.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      <div className="order-card-actions">
        {order.status === OrderStatus.PENDING && (
          <button
            className="action-button accept"
            onClick={onAccept}
            disabled={loading || !hasTaskToken}
            title={!hasTaskToken ? "Waiting for task token..." : ""}
          >
            {loading ? "..." : "Accept"}
          </button>
        )}

        {order.status === OrderStatus.ACCEPTED && (
          <button
            className="action-button ready"
            onClick={onMarkReady}
            disabled={loading || !hasTaskToken}
            title={!hasTaskToken ? "Waiting for task token..." : ""}
          >
            {loading ? "..." : "Mark Ready"}
          </button>
        )}

        {order.status === OrderStatus.READY && (
          <button
            className="action-button complete"
            onClick={onMarkCompleted}
            disabled={loading || !hasTaskToken}
            title={!hasTaskToken ? "Waiting for task token..." : ""}
          >
            {loading ? "..." : "Mark Completed"}
          </button>
        )}
      </div>
    </div>
  );
}
