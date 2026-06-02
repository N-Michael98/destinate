import { ClaudeClient } from "./claude-client";
import { ClaudeRiskReviewer } from "./claude-risk-review";
import { ClaudePortfolioReviewer } from "./claude-portfolio-review";
import { ClaudeDrawdownReviewer } from "./claude-drawdown-review";

export class ClaudeManager {

  client = new ClaudeClient();

  risk = new ClaudeRiskReviewer();

  portfolio =
    new ClaudePortfolioReviewer();

  drawdown =
    new ClaudeDrawdownReviewer();
}