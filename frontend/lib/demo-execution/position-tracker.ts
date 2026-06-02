import type { DemoOrder } from "./execution-types";

const positions: DemoOrder[] = [];

export function addPosition(
  order: DemoOrder
) {
  positions.push(order);
}

export function getPositions() {
  return positions;
}

export function clearPositions() {
  positions.length = 0;
}