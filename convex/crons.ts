import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run monthly rollover on the 1st of each month at 12:01 AM
crons.monthly(
  "monthly rollover",
  { day: 1, hourUTC: 0, minuteUTC: 1 },
  internal.rollover.runScheduledRollover
);

export default crons;
