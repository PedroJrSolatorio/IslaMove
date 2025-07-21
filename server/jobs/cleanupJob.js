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

// // For testing, run every minute instead of daily
// export const setupCleanupJobs = () => {
//   console.log("Setting up TEST cleanup cron job (every minute)...");

//   cron.schedule("* * * * *", async () => {
//     // Every minute
//     console.log(`[TEST] Running cleanup at ${new Date().toISOString()}`);
//     try {
//       await processScheduledDeletions();
//     } catch (error) {
//       console.error("Test cleanup failed:", error);
//     }
//   });
// };
