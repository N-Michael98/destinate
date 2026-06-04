import { ExecutionTicket } from "./execution-types";

export class OrderValidator {
  static validate(
    ticket: ExecutionTicket
  ): boolean {

    if (!ticket.approved) {
      return false;
    }

    if (ticket.confidence < 80) {
      return false;
    }

    return true;
  }
}