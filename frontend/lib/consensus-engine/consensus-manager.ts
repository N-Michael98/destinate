import { ConsensusInput, ConsensusResult } from "./consensus-types";
import { buildConsensus } from "./consensus-builder";

export class ConsensusManager {
  decide(input: ConsensusInput): ConsensusResult {
    return buildConsensus(input);
  }

  decideMany(inputs: ConsensusInput[]): ConsensusResult[] {
    return inputs.map((input) => this.decide(input));
  }
}

export const consensusManager = new ConsensusManager();