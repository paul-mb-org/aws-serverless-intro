export enum OrderStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  READY = "ready",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  REJECTED = "rejected",
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
}

export interface Order {
  id: string;
  customerId: string;
  bartenderId?: string;
  status: OrderStatus;
  item: MenuItem;
  createdAt: string;
  updatedAt: string;
}

export interface OrderEventDetail {
  orderId: string;
  customerId: string;
  status: OrderStatus;
  item?: MenuItem;
  bartenderId?: string;
  taskToken?: string;
  reason?: string;
}
