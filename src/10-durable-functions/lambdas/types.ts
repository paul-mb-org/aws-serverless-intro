export type Order = { title: string; price: number };
export type OrderEvent = Order & { callbackId: string };
