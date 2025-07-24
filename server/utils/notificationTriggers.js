import NotificationService from "../services/NotificationService.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";

// Note: These functions should be called from existing controllers/services when specific events occur

// 1. Profile Image Status Update Triggers
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

// 2. Warning Notification Trigger
export const triggerWarningNotification = async (userId, warning) => {
  try {
    await NotificationService.createWarningNotification(userId, warning);
    console.log(`Warning notification sent to user ${userId}`);
  } catch (error) {
    console.error("Error triggering warning notification:", error);
  }
};

// 3. Senior ID Validation Triggers
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

// 4. Category Change Request Triggers
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

// 5. Automatic Category Change Trigger
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

// 6. School ID Reminder Trigger ==== WORKING
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

// 7. Senior Eligibility Trigger
export const triggerSeniorEligibilityNotification = async (userId) => {
  try {
    await NotificationService.createSeniorEligibilityNotification(userId);
    console.log(`Senior eligibility notification sent to user ${userId}`);
  } catch (error) {
    console.error("Error triggering senior eligibility notification:", error);
  }
};

// 8. Security Notification Trigger
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

// 9. Promotional Notification Trigger
export const triggerPromoNotification = async (
  userIds,
  title,
  message,
  priority = "low"
) => {
  try {
    const notifications = await NotificationService.createPromoNotification(
      userIds,
      title,
      message,
      priority
    );
    console.log(
      `Promotional notifications sent to ${notifications.length} users`
    );
    return notifications;
  } catch (error) {
    console.error("Error triggering promotional notifications:", error);
  }
};

// 10. System Update Notification Trigger
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

// 11. Mass Notification Triggers
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

// Role-based Mass Notification Triggers
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

// 12. Automated Notification Jobs
export const runNotificationJobs = async () => {
  try {
    console.log("Running notification jobs...");

    // Check for users who need school ID reminders (30 days before expiration)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const usersNeedingSchoolIdReminder = await User.find({
      category: "student",
      schoolIdValidationStatus: "approved",
      schoolIdExpirationDate: {
        $lte: thirtyDaysFromNow,
        $gte: new Date(),
      },
      isBlocked: false,
      deletionRequested: { $ne: true },
    });

    for (const user of usersNeedingSchoolIdReminder) {
      await triggerSchoolIdReminderNotification(
        user._id,
        user.schoolIdExpirationDate
      );
    }

    // Check for users who just turned 60 (senior eligibility)
    const today = new Date();
    const sixtyYearsAgo = new Date(
      today.getFullYear() - 60,
      today.getMonth(),
      today.getDate()
    );

    const newSeniorEligibleUsers = await User.find({
      dateOfBirth: {
        $gte: new Date(sixtyYearsAgo.getTime() - 24 * 60 * 60 * 1000), // Yesterday
        $lt: new Date(sixtyYearsAgo.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
      },
      category: { $ne: "senior" },
      isBlocked: false,
      deletionRequested: { $ne: true },
    });

    for (const user of newSeniorEligibleUsers) {
      await triggerSeniorEligibilityNotification(user._id);
    }

    // Auto-change category for expired school IDs
    const expiredSchoolIdUsers = await User.find({
      category: "student",
      schoolIdValidationStatus: "approved",
      schoolIdExpirationDate: { $lt: today },
      isBlocked: false,
      deletionRequested: { $ne: true },
    });

    for (const user of expiredSchoolIdUsers) {
      const previousCategory = user.category;
      user.category = "regular";
      user.schoolIdValidationStatus = "expired";
      await user.save();

      await triggerAutoCategoryChangeNotification(
        user._id,
        previousCategory,
        "regular",
        "school_id_expired"
      );
    }

    console.log(
      `Notification jobs completed. Processed ${usersNeedingSchoolIdReminder.length} school ID reminders, ${newSeniorEligibleUsers.length} senior eligibility notifications, and ${expiredSchoolIdUsers.length} category changes.`
    );
  } catch (error) {
    console.error("Error running notification jobs:", error);
  }
};

// 13. Bulk Operations
export const markNotificationsAsRead = async (userId, notificationIds = []) => {
  try {
    if (notificationIds.length === 0) {
      // Mark all as read
      const result = await NotificationService.markAllAsRead(userId);
      console.log(`Marked all notifications as read for user ${userId}`);
      return result;
    } else {
      // Mark specific notifications as read
      const validIds = notificationIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );
      const result = await Notification.updateMany(
        {
          _id: { $in: validIds },
          userId,
          read: false,
        },
        {
          read: true,
          readAt: new Date(),
        }
      );
      console.log(
        `Marked ${result.modifiedCount} notifications as read for user ${userId}`
      );
      return result;
    }
  } catch (error) {
    console.error("Error marking notifications as read:", error);
  }
};

// Delete Bulk Operations
export const deleteNotifications = async (userId, notificationIds) => {
  try {
    const validIds = notificationIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    const result = await Notification.deleteMany({
      _id: { $in: validIds },
      userId,
    });
    console.log(
      `Deleted ${result.deletedCount} notifications for user ${userId}`
    );
    return result;
  } catch (error) {
    console.error("Error deleting notifications:", error);
  }
};

// 14. Real-time notification helpers (for WebSocket/Socket.io integration)
export const emitNotificationToUser = (io, userId, notification) => {
  try {
    if (io) {
      io.to(`user_${userId}`).emit("new_notification", notification);
      console.log(`Real-time notification emitted to user ${userId}`);
    }
  } catch (error) {
    console.error("Error emitting real-time notification:", error);
  }
};

export const emitNotificationUpdate = (io, userId, notificationId, update) => {
  try {
    if (io) {
      io.to(`user_${userId}`).emit("notification_update", {
        notificationId,
        update,
      });
      console.log(`Notification update emitted to user ${userId}`);
    }
  } catch (error) {
    console.error("Error emitting notification update:", error);
  }
};

// Example usage in your controllers:
/*
// In ProfileController.js
import { triggerProfileImageNotification } from '../utils/notificationTriggers.js';

export const approveProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    
    user.profileImageStatus = 'approved';
    await user.save();
    
    // Trigger notification
    await triggerProfileImageNotification(userId, 'approved', {
      profileImageUrl: user.profileImageUrl
    });
    
    res.json({ success: true, message: 'Profile image approved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
*/
