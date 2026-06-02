import { generateMockOrders } from "./order-generator";

export function executeDemoOrders() {
  const orders = generateMockOrders();

  return {
    executed: orders.length,
    orders,
  };
}