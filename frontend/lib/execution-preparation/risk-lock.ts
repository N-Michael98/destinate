import { ExecutionTicket } from "./execution-types";

export class RiskLock {
  static check(
    ticket: ExecutionTicket
  ): boolean {

    const risk =
      Math.abs(
        ticket.entry - ticket.stopLoss
      );

    return risk > 0;
  }
}