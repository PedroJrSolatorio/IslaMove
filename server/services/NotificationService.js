import Notification from "../models/Notification.js";
import User from "../models/User.js";
import mongoose from "mongoose";

class NotificationService {
  // Profile Image Status Updates (from notificationTriggers.js)
  static async createProfileImageNotification(userId, status, data = {}) {
    const titles = {
      approved: "Profile Image Approved ✅",
      rejected: "Profile Image Rejected ❌",
    };

    const messages = {
      approved:
        "Your profile image has been approved and is now active on your account.",
      rejected: `Your profile image was rejected. ${
        data.rejectionReason
          ? `Reason: ${data.rejectionReason}`
          : "Please upload a new image that meets our guidelines."
      }`,
    };

    return await Notification.createNotification({
      userId,
      type: "profile_image_status",
      title: titles[status],
      message: messages[status],
      priority: status === "rejected" ? "high" : "medium",
      data: {
        profileImageUrl: data.profileImageUrl,
        rejectionReason: data.rejectionReason,
        actionRequired: status === "rejected",
      },
    });
  }

  // Warning Notifications (from notificationTriggers.js)
  static async createWarningNotification(userId, warning) {
    return await Notification.createNotification({
      userId,
      type: "warning",
      title: "Account Warning ⚠️",
      message: warning.message,
      priority: "high",
      data: {
        warningId: warning._id,
        actionRequired: true,
      },
    });
  }

  // Senior ID Validation Status (from notificationTriggers.js)
  static async createSeniorIdValidationNotification(userId, status, data = {}) {
    const titles = {
      approved: "Senior ID Approved ✅",
      rejected: "Senior ID Rejected ❌",
      reminder: "Senior ID Upload Required",
    };

    const messages = {
      approved:
        "Your senior citizen ID has been approved. You can now enjoy senior citizen discounts!",
      rejected: `Your senior citizen ID was rejected. ${
        data.rejectionReason
          ? `Reason: ${data.rejectionReason}`
          : "Please upload a clear, valid senior citizen ID."
      }`,
      reminder:
        "Please upload your senior citizen ID to continue enjoying senior discounts.",
    };

    return await Notification.createNotification({
      userId,
      type: "senior_id_validation",
      title: titles[status],
      message: messages[status],
      priority: status === "rejected" ? "high" : "medium",
      data: {
        rejectionReason: data.rejectionReason,
        actionRequired: status !== "approved",
      },
    });
  }

  // Category Change Request Status (from notificationTriggers.js)
  static async createCategoryChangeRequestNotification(
    userId,
    status,
    data = {}
  ) {
    const titles = {
      approved: "Category Change Approved ✅",
      rejected: "Category Change Rejected ❌",
      pending: "Category Change Request Received",
    };

    const messages = {
      approved: `Your category has been successfully changed from ${data.previousCategory} to ${data.newCategory}.`,
      rejected: `Your category change request was rejected. ${
        data.rejectionReason
          ? `Reason: ${data.rejectionReason}`
          : "Please contact support for more information."
      }`,
      pending: `Your request to change category from ${data.previousCategory} to ${data.newCategory} is being reviewed.`,
    };

    return await Notification.createNotification({
      userId,
      type: "category_change_request",
      title: titles[status],
      message: messages[status],
      priority: status === "rejected" ? "high" : "medium",
      data: {
        requestId: data.requestId,
        previousCategory: data.previousCategory,
        newCategory: data.newCategory,
        rejectionReason: data.rejectionReason,
        actionRequired: status === "rejected",
      },
    });
  }

  // Automatic Category Changes (age-based) (from notificationTriggers.js)
  static async createAutoCategoryChangeNotification(
    userId,
    previousCategory,
    newCategory,
    reason = "age"
  ) {
    const reasonMessages = {
      age: "due to age qualification",
      school_id_expired: "due to expired school ID validation",
    };

    return await Notification.createNotification({
      userId,
      type: "category_change_auto",
      title: "Category Updated Automatically",
      message: `Your passenger category has been automatically changed from ${previousCategory} to ${newCategory} ${reasonMessages[reason]}.`,
      priority: "medium",
      data: {
        previousCategory,
        newCategory,
        reason,
        actionRequired: reason === "school_id_expired",
      },
    });
  }

  // School ID Reminders (from notificationTriggers.js)
  static async createSchoolIdReminderNotification(userId, expirationDate) {
    const daysUntilExpiration = Math.ceil(
      (expirationDate - new Date()) / (1000 * 60 * 60 * 24)
    );

    return await Notification.createNotification({
      userId,
      type: "school_id_reminder",
      title: "School ID Validation Required 🎓",
      message: `Your student status expires in ${daysUntilExpiration} days. Please upload your current school ID to maintain student discounts.`,
      priority: "high",
      data: {
        expirationDate,
        actionRequired: true,
      },
    });
  }

  // Senior Eligibility Notifications (from notificationTriggers.js)
  static async createSeniorEligibilityNotification(userId) {
    return await Notification.createNotification({
      userId,
      type: "senior_eligibility",
      title: "Senior Citizen Benefits Available! 🎉",
      message:
        "Congratulations! You are now eligible for senior citizen discounts. Would you like to change your category to senior?",
      priority: "medium",
      data: {
        actionRequired: false,
      },
    });
  }

  // Admin News/Announcements (from notificationRoutes.js)
  static async createAdminNewsNotification(
    userIds,
    title,
    message,
    adminId,
    priority = "medium"
  ) {
    if (userIds.length === 0) return [];

    return await Notification.createBulkNotifications(userIds, {
      type: "admin_news",
      title,
      message,
      priority,
      data: {
        adminId,
        actionRequired: false,
      },
    });
  }

  // System notifications (account security, etc.) (from notificationTriggers.js)
  static async createSecurityNotification(
    userId,
    title,
    message,
    priority = "high"
  ) {
    return await Notification.createNotification({
      userId,
      type: "account_security",
      title,
      message,
      priority,
      data: {
        actionRequired: true,
      },
    });
  }

  // Promotional notifications (from notificationTriggers.js)
  static async createPromoNotification(
    userIds,
    title,
    message,
    priority = "low"
  ) {
    if (userIds.length === 0) return [];

    return await Notification.createBulkNotifications(userIds, {
      type: "promo",
      title,
      message,
      priority,
      data: {
        actionRequired: false,
      },
    });
  }

  // System update notifications (from notificationTriggers.js)
  static async createSystemUpdateNotification(userIds, title, message) {
    if (userIds.length === 0) return [];

    return await Notification.createBulkNotifications(userIds, {
      type: "system_update",
      title,
      message,
      priority: "medium",
      data: {
        actionRequired: false,
      },
    });
  }

  // Helper method to notify all users (from notificationRoutes.js and notificationTriggers.js)
  static async notifyAllUsers(
    title,
    message,
    type = "admin_news",
    priority = "medium",
    adminId = null
  ) {
    try {
      const users = await User.find(
        {
          deletionRequested: { $ne: true },
          isBlocked: false,
        },
        { _id: 1 }
      ).lean();

      const userIds = users.map((user) => user._id);

      if (type === "admin_news") {
        return await this.createAdminNewsNotification(
          userIds,
          title,
          message,
          adminId,
          priority
        );
      } else if (type === "promo") {
        return await this.createPromoNotification(
          userIds,
          title,
          message,
          priority
        );
      } else if (type === "system_update") {
        return await this.createSystemUpdateNotification(
          userIds,
          title,
          message
        );
      }

      return [];
    } catch (error) {
      console.error("Error notifying all users:", error);
      throw error;
    }
  }

  // Helper method to notify users by role (from notificationRoutes.js and notificationTriggers.js)
  static async notifyUsersByRole(
    roles,
    title,
    message,
    type = "admin_news",
    priority = "medium",
    adminId = null
  ) {
    try {
      const users = await User.find(
        {
          role: { $in: roles },
          deletionRequested: { $ne: true },
          isBlocked: false,
        },
        { _id: 1 }
      ).lean();

      const userIds = users.map((user) => user._id);

      if (type === "admin_news") {
        return await this.createAdminNewsNotification(
          userIds,
          title,
          message,
          adminId,
          priority
        );
      } else if (type === "promo") {
        return await this.createPromoNotification(
          userIds,
          title,
          message,
          priority
        );
      } else if (type === "system_update") {
        return await this.createSystemUpdateNotification(
          userIds,
          title,
          message
        );
      }

      return [];
    } catch (error) {
      console.error("Error notifying users by role:", error);
      throw error;
    }
  }

  // Get notification statistics for a user (from notificationRoutes.js)
  static async getUserNotificationStats(userId) {
    try {
      // Convert string to ObjectId if needed
      const objectId =
        typeof userId === "string"
          ? new mongoose.Types.ObjectId(userId)
          : userId;

      const stats = await Notification.aggregate([
        { $match: { userId: objectId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            unread: { $sum: { $cond: [{ $eq: ["$read", false] }, 1, 0] } },
            high_priority: {
              $sum: { $cond: [{ $eq: ["$priority", "high"] }, 1, 0] },
            },
            urgent: {
              $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] },
            },
          },
        },
      ]);

      return stats[0] || { total: 0, unread: 0, high_priority: 0, urgent: 0 };
    } catch (error) {
      console.error("Error getting notification stats:", error);
      throw error;
    }
  }
}

export default NotificationService;
