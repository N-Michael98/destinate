export type SchedulerPeriod =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY";

export type SchedulerTask = {
  id: string;
  name: string;
  enabled: boolean;
};

export type LearningCycle = {
  period: SchedulerPeriod;
  tasks: SchedulerTask[];
};