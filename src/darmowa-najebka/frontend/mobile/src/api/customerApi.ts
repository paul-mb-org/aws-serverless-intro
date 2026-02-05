import { config } from "@shared/config";
import type { MenuItem, CreateOrderResponse, Order } from "@shared/types";

const API_URL = config.customerApiUrl;

export const customerApi = {
  getMenu: async (): Promise<MenuItem[]> => {
    const response = await fetch(`${API_URL}/menu`);
    if (!response.ok) {
      throw new Error("Failed to fetch menu");
    }
    return response.json();
  },

  createOrder: async (customerId: string, item: MenuItem): Promise<CreateOrderResponse> => {
    const response = await fetch(`${API_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ customerId, item }),
    });
    if (!response.ok) {
      throw new Error("Failed to create order");
    }
    return response.json();
  },

  getOrder: async (orderId: string): Promise<Order> => {
    const response = await fetch(`${API_URL}/orders/${orderId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch order");
    }
    return response.json();
  },
};
