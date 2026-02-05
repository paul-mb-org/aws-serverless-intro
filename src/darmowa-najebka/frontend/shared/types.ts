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
  taskToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IoTNotification {
  orderId: string;
  customerId: string;
  status: OrderStatus;
  item?: MenuItem;
  taskToken?: string;
  bartenderId?: string;
  reason?: string;
  eventType: string;
  timestamp: string;
}

export interface CreateOrderRequest {
  customerId: string;
  item: MenuItem;
}

export interface CreateOrderResponse {
  orderId: string;
  status: OrderStatus;
}

export interface CallbackRequest {
  taskToken: string;
  output: {
    status: OrderStatus;
    bartenderId: string;
  };
}

export interface Barman {
  id: string;
  name: string;
}
