import { config } from "@shared/config";
import type { Order, OrderStatus, Barman } from "@shared/types";

const API_URL = config.barmanApiUrl;

export const barmanApi = {
  register: async (name: string): Promise<Barman> => {
    const response = await fetch(`${API_URL}/barman`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error("Failed to register barman");
    }
    return response.json();
  },

  getOrders: async (): Promise<Order[]> => {
    const response = await fetch(`${API_URL}/orders`);
    if (!response.ok) {
      throw new Error("Failed to fetch orders");
    }
    return response.json();
  },

  callback: async (
    taskToken: string,
    output: { status: OrderStatus; bartenderId: string }
  ): Promise<void> => {
    const response = await fetch(`${API_URL}/orders/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ taskToken, output }),
    });
    if (!response.ok) {
      throw new Error("Failed to update order status");
    }
  },
};
