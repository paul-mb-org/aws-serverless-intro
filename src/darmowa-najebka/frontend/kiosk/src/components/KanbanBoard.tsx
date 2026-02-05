import { OrderStatus } from "@shared/types";
import type { Order } from "@shared/types";

interface KanbanBoardProps {
  orders: Order[];
}

interface OrderCardProps {
  order: Order;
}

function OrderCard({ order }: OrderCardProps) {
  return (
    <div className="kanban-card">
      <div className="kanban-card-id">#{order.id.slice(-8)}</div>
      {order.item && <div className="kanban-card-item">{order.item.name}</div>}
    </div>
  );
}

export function KanbanBoard({ orders }: KanbanBoardProps) {
  const inProgressOrders = orders.filter(
    (order) => order.status === OrderStatus.ACCEPTED
  );
  const readyOrders = orders.filter(
    (order) => order.status === OrderStatus.READY
  );

  return (
    <div className="kanban-board">
      <div className="kanban-column">
        <div className="kanban-column-header in-progress">
          <h3>In Progress</h3>
          <span className="kanban-count">{inProgressOrders.length}</span>
        </div>
        <div className="kanban-column-content">
          {inProgressOrders.length === 0 ? (
            <div className="kanban-empty">No orders in progress</div>
          ) : (
            inProgressOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))
          )}
        </div>
      </div>

      <div className="kanban-column">
        <div className="kanban-column-header ready">
          <h3>Ready for Pickup</h3>
          <span className="kanban-count">{readyOrders.length}</span>
        </div>
        <div className="kanban-column-content">
          {readyOrders.length === 0 ? (
            <div className="kanban-empty">No orders ready</div>
          ) : (
            readyOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
