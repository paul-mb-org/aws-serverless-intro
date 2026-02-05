import { OrderStatus as Status } from "@shared/types";

interface OrderStatusProps {
  status: Status;
  reason?: string;
}

const statusConfig: Record<Status, { label: string; color: string; icon: string }> = {
  [Status.PENDING]: { label: "Pending", color: "#f59e0b", icon: "⏳" },
  [Status.ACCEPTED]: { label: "In Progress", color: "#3b82f6", icon: "👨‍🍳" },
  [Status.READY]: { label: "Ready for Pickup", color: "#10b981", icon: "✅" },
  [Status.COMPLETED]: { label: "Completed", color: "#6b7280", icon: "🎉" },
  [Status.CANCELLED]: { label: "Cancelled", color: "#ef4444", icon: "❌" },
  [Status.REJECTED]: { label: "Rejected", color: "#ef4444", icon: "🚫" },
};

const statusOrder: Status[] = [
  Status.PENDING,
  Status.ACCEPTED,
  Status.READY,
  Status.COMPLETED,
];

export function OrderStatusDisplay({ status, reason }: OrderStatusProps) {
  const config = statusConfig[status];
  const isFinalNegative = status === Status.CANCELLED || status === Status.REJECTED;

  return (
    <div className="order-status-container">
      <div
        className="order-status-badge"
        style={{ backgroundColor: config.color }}
      >
        <span className="status-icon">{config.icon}</span>
        <span className="status-label">{config.label}</span>
      </div>

      {reason && (
        <p className="order-status-reason">{reason}</p>
      )}

      {!isFinalNegative && (
        <div className="order-status-progress">
          {statusOrder.map((s, index) => {
            const currentIndex = statusOrder.indexOf(status);
            const isActive = index <= currentIndex;
            const isCurrent = s === status;

            return (
              <div key={s} className="progress-step">
                <div
                  className={`progress-dot ${isActive ? "active" : ""} ${isCurrent ? "current" : ""}`}
                  style={{ backgroundColor: isActive ? statusConfig[s].color : "#e5e7eb" }}
                />
                {index < statusOrder.length - 1 && (
                  <div
                    className={`progress-line ${isActive && index < currentIndex ? "active" : ""}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
