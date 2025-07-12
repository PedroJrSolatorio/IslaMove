import cron from "node-cron";
import { processScheduledDeletions } from "../controllers/userController.js";

// Run cleanup job daily at 2 AM
export const setupCleanupJobs = () => {
  cron.schedule("0 2 * * *", async () => {
    console.log("Running scheduled account deletion cleanup...");
    try {
      await processScheduledDeletions();
      console.log("Cleanup job completed successfully");
    } catch (error) {
      console.error("Cleanup job failed:", error);
    }
  });
};
