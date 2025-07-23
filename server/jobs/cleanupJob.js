import cron from "node-cron";
import {
  processScheduledDeletions,
  processAgeTransitions,
  processSchoolIdValidations,
  sendSchoolIdReminders,
  processExpiredSchoolIdValidations,
} from "../controllers/userController.js";

// For testing, run every minute instead of daily
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

// Run cleanup job daily at 1 AM
export const setupCleanupJobs = () => {
  // job for account deletion
  cron.schedule("0 1 * * *", async () => {
    console.log("Running scheduled account deletion cleanup...");
    try {
      await processScheduledDeletions();
      console.log("Cleanup job completed successfully");
    } catch (error) {
      console.error("Cleanup job failed:", error);
    }
  });

  // Job for processing age transitions (runs daily at 2:00 AM)
  cron.schedule("0 2 * * *", async () => {
    console.log("Running scheduled age transitions processing...");
    try {
      await processAgeTransitions();
      console.log("Age transitions processing completed successfully.");
    } catch (error) {
      console.error("Age transitions processing failed:", error);
    }
  });

  // Job specifically for August school year school ID validation (runs daily at 3 am during August)
  cron.schedule("0 3 1-31 8 *", async () => {
    console.log("Running August school year transition checks...");
    try {
      await processSchoolIdValidations();
      console.log(
        "August school year School ID validation checks completed successfully."
      );
    } catch (error) {
      console.error(
        "August school year School ID validation checks failed:",
        error
      );
    }
  });

  // Job for sending school ID reminders (runs daily at 4 am during August)
  cron.schedule("0 4 1-31 8 *", async () => {
    console.log("Running scheduled school ID reminders...");
    try {
      await sendSchoolIdReminders();
      console.log("School ID reminders completed successfully.");
    } catch (error) {
      console.error("School ID reminders failed:", error);
    }
  });

  // Job for processing expired school ID validations (runs daily at 5:00 AM during September)
  cron.schedule("0 5 * 9 *", async () => {
    console.log(
      "Running scheduled expired school ID validations processing..."
    );
    try {
      await processExpiredSchoolIdValidations();
      console.log(
        "Expired school ID validations processing completed successfully."
      );
    } catch (error) {
      console.error("Expired school ID validations processing failed:", error);
    }
  });
};
