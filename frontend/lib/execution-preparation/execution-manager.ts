import { ExecutionQueue }
from "./execution-queue";

import { OrderValidator }
from "./order-validator";

import { RiskLock }
from "./risk-lock";

import { ExecutionTicket }
from "./execution-types";

export class ExecutionManager {

  execute(
    ticket: ExecutionTicket
  ) {

    const valid =
      OrderValidator.validate(ticket);

    const riskOk =
      RiskLock.check(ticket);

    if (
      valid &&
      riskOk
    ) {

      ExecutionQueue.add(ticket);

      return {
        success: true,
        ticket
      };
    }

    return {
      success: false
    };
  }
}