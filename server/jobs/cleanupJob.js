import cron from "node-cron";
import {
  processScheduledDeletions,
  updateExpiredStudentCategories,
} from "../controllers/userController.js";

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

// Run cleanup job daily at 2 AM
export const setupCleanupJobs = () => {
  // job for account deletion
  cron.schedule("0 2 * * *", async () => {
    console.log("Running scheduled account deletion cleanup...");
    try {
      await processScheduledDeletions();
      console.log("Cleanup job completed successfully");
    } catch (error) {
      console.error("Cleanup job failed:", error);
    }
  });

  // job for updating expired student categories
  cron.schedule("0 3 * * *", async () => {
    // Runs daily at 3:00 AM
    console.log("Running scheduled student category update for expired IDs...");
    try {
      await updateExpiredStudentCategories();
      console.log(
        "Cleanup job (student category update) completed successfully."
      );
    } catch (error) {
      console.error("Cleanup job (student category update) failed:", error);
    }
  });
};
