import { ExecutionTicket } from "./execution-types";

export class ExecutionQueue {

  private static queue:
    ExecutionTicket[] = [];

  static add(
    ticket: ExecutionTicket
  ) {
    this.queue.push(ticket);
  }

  static getAll() {
    return this.queue;
  }
}