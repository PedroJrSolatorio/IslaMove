import NotificationService from "../services/NotificationService.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";

// Note: These functions should be called from existing controllers/services when specific events occur

// 1. Profile Image Status Update Triggers (admin initiated)
export const triggerProfileImageNotification = async (
  userId,
  status,
  data = {}
) => {
  try {
    await NotificationService.createProfileImageNotification(
      userId,
      status,
      data
    );
    console.log(`Profile image ${status} notification sent to user ${userId}`);
  } catch (error) {
    console.error("Error triggering profile image notification:", error);
  }
};

// 2. Warning Notification Trigger (admin initiated)
export const triggerWarningNotification = async (userId, warning) => {
  try {
    await NotificationService.createWarningNotification(userId, warning);
    console.log(`Warning notification sent to user ${userId}`);
  } catch (error) {
    console.error("Error triggering warning notification:", error);
  }
};

// 3. Senior ID Validation Triggers (admin initiated)
export const triggerSeniorIdValidationNotification = async (
  userId,
  status,
  data = {}
) => {
  try {
    await NotificationService.createSeniorIdValidationNotification(
      userId,
      status,
      data
    );
    console.log(`Senior ID ${status} notification sent to user ${userId}`);
  } catch (error) {
    console.error("Error triggering senior ID validation notification:", error);
  }
};

// 4. Category Change Request Triggers (admin initiated)
export const triggerCategoryChangeRequestNotification = async (
  userId,
  status,
  data = {}
) => {
  try {
    await NotificationService.createCategoryChangeRequestNotification(
      userId,
      status,
      data
    );
    console.log(
      `Category change request ${status} notification sent to user ${userId}`
    );
  } catch (error) {
    console.error(
      "Error triggering category change request notification:",
      error
    );
  }
};

// 5. Automated Category Change Trigger (used in userController) === WORKING
export const triggerAutoCategoryChangeNotification = async (
  userId,
  previousCategory,
  newCategory,
  reason = "age"
) => {
  try {
    await NotificationService.createAutoCategoryChangeNotification(
      userId,
      previousCategory,
      newCategory,
      reason
    );
    console.log(`Auto category change notification sent to user ${userId}`);
  } catch (error) {
    console.error("Error triggering auto category change notification:", error);
  }
};

// 6. Automated School ID Reminder Trigger (used in userController) ==== WORKING
export const triggerSchoolIdReminderNotification = async (
  userId,
  expirationDate
) => {
  try {
    await NotificationService.createSchoolIdReminderNotification(
      userId,
      expirationDate
    );
    console.log(`School ID reminder notification sent to user ${userId}`);
  } catch (error) {
    console.error("Error triggering school ID reminder notification:", error);
  }
};

// 7. Automated Senior Eligibility Trigger (used in userController) ==== WORKING
export const triggerSeniorEligibilityNotification = async (userId) => {
  try {
    await NotificationService.createSeniorEligibilityNotification(userId);
    console.log(`Senior eligibility notification sent to user ${userId}`);
  } catch (error) {
    console.error("Error triggering senior eligibility notification:", error);
  }
};

// 8. Security Notification Trigger (admin initiated)
export const triggerSecurityNotification = async (
  userId,
  title,
  message,
  priority = "high"
) => {
  try {
    await NotificationService.createSecurityNotification(
      userId,
      title,
      message,
      priority
    );
    console.log(`Security notification sent to user ${userId}`);
  } catch (error) {
    console.error("Error triggering security notification:", error);
  }
};

// 9. System Update Notification Trigger (admin initiated)
export const triggerSystemUpdateNotification = async (
  userIds,
  title,
  message
) => {
  try {
    const notifications =
      await NotificationService.createSystemUpdateNotification(
        userIds,
        title,
        message
      );
    console.log(
      `System update notifications sent to ${notifications.length} users`
    );
    return notifications;
  } catch (error) {
    console.error("Error triggering system update notifications:", error);
  }
};

// 10. Mass Notification Triggers (admin initiated)
export const triggerNotificationToAllUsers = async (
  title,
  message,
  type = "admin_news",
  priority = "medium",
  adminId = null
) => {
  try {
    const notifications = await NotificationService.notifyAllUsers(
      title,
      message,
      type,
      priority,
      adminId
    );
    console.log(`Mass notification sent to ${notifications.length} users`);
    return notifications;
  } catch (error) {
    console.error("Error triggering mass notifications:", error);
  }
};

// Role-based Mass Notification Triggers (admin initiated)
export const triggerNotificationToUsersByRole = async (
  roles,
  title,
  message,
  type = "admin_news",
  priority = "medium",
  adminId = null
) => {
  try {
    const notifications = await NotificationService.notifyUsersByRole(
      roles,
      title,
      message,
      type,
      priority,
      adminId
    );
    console.log(
      `Role-based notification sent to ${notifications.length} users`
    );
    return notifications;
  } catch (error) {
    console.error("Error triggering role-based notifications:", error);
  }
};

// // 11. Real-time notification helpers (for WebSocket/Socket.io integration)
// // Note: these can be used if need instant notification like in-app push notification, but this is not yet used
// export const emitNotificationToUser = (io, userId, notification) => {
//   try {
//     if (io) {
//       io.to(`user_${userId}`).emit("new_notification", notification);
//       console.log(`Real-time notification emitted to user ${userId}`);
//     }
//   } catch (error) {
//     console.error("Error emitting real-time notification:", error);
//   }
// };
// export const emitNotificationUpdate = (io, userId, notificationId, update) => {
//   try {
//     if (io) {
//       io.to(`user_${userId}`).emit("notification_update", {
//         notificationId,
//         update,
//       });
//       console.log(`Notification update emitted to user ${userId}`);
//     }
//   } catch (error) {
//     console.error("Error emitting notification update:", error);
//   }
// };
