import express from "express";
import { auth } from "../middleware/auth.js";
import { adminAuth } from "../middleware/adminAuth.js";
import Notification from "../models/Notification.js";
import NotificationService from "../services/NotificationService.js";
import mongoose from "mongoose";

const router = express.Router();

// GET /api/notifications - Get user's notifications with pagination and filters
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user?._id;
    const { page = 1, limit = 20, type, read, priority } = req.query;

    // Convert string values to appropriate types
    const options = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 50), // Max 50 notifications per request
      type: type || null,
      read: read !== undefined ? read === "true" : null,
      priority: priority || null,
    };

    const result = await Notification.getUserNotifications(userId, options);

    res.json({
      success: true,
      data: result.notifications,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notifications",
    });
  }
});

// GET /api/notifications/stats - User get notification statistics
router.get("/stats", auth, async (req, res) => {
  try {
    const userId = req.user?._id;
    const stats = await NotificationService.getUserNotificationStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching notification stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notification statistics",
    });
  }
});

// PUT /api/notifications/:id/read - Mark a notification as read (user initiated)
router.put("/:id/read", auth, async (req, res) => {
  try {
    const userId = req.user?._id;
    const notificationId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid notification ID",
      });
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    await notification.markAsRead();

    res.json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark notification as read",
    });
  }
});

// PUT /api/notifications/mark-all-read - Mark all notifications as read (user initiated)
router.put("/mark-all-read", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await Notification.markAllAsRead(userId);

    res.json({
      success: true,
      message: "All notifications marked as read",
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark all notifications as read",
    });
  }
});

// DELETE /api/notifications/:id - Delete a notification (user initiated)
router.delete("/:id", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const notificationId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid notification ID",
      });
    }

    const result = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete notification",
    });
  }
});

// POST /api/notifications/admin/send - Admin send notification to users
router.post("/admin/send", auth, adminAuth, async (req, res) => {
  try {
    const {
      title,
      message,
      userIds,
      roles,
      type = "admin_news",
      priority = "medium",
      sendToAll = false,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: "Title and message are required",
      });
    }

    const adminId = req.user.userId;
    let notifications = [];

    if (sendToAll) {
      notifications = await NotificationService.notifyAllUsers(
        title,
        message,
        type,
        priority,
        adminId
      );
    } else if (roles && roles.length > 0) {
      notifications = await NotificationService.notifyUsersByRole(
        roles,
        title,
        message,
        type,
        priority,
        adminId
      );
    } else if (userIds && userIds.length > 0) {
      // Validate userIds
      const validUserIds = userIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );

      if (validUserIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No valid user IDs provided",
        });
      }

      notifications = await NotificationService.createAdminNewsNotification(
        validUserIds,
        title,
        message,
        adminId,
        priority
      );
    } else {
      return res.status(400).json({
        success: false,
        error: "Must specify userIds, roles, or sendToAll",
      });
    }

    res.json({
      success: true,
      message: "Notifications sent successfully",
      data: {
        notificationCount: notifications.length,
      },
    });
  } catch (error) {
    console.error("Error sending admin notifications:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send notifications",
    });
  }
});

// GET /api/notifications/admin/stats - Admin get notification statistics
router.get("/admin/stats", auth, adminAuth, async (req, res) => {
  try {
    const { timeframe = "7d" } = req.query;

    let dateFilter = {};
    const now = new Date();

    switch (timeframe) {
      case "24h":
        dateFilter = {
          createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) },
        };
        break;
      case "7d":
        dateFilter = {
          createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
        };
        break;
      case "30d":
        dateFilter = {
          createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) },
        };
        break;
      default:
        dateFilter = {};
    }

    const stats = await Notification.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ["$read", false] }, 1, 0] } },
          byType: {
            $push: {
              type: "$type",
              priority: "$priority",
            },
          },
        },
      },
    ]);

    const typeStats = await Notification.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ["$read", false] }, 1, 0] } },
        },
      },
    ]);

    const priorityStats = await Notification.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ["$read", false] }, 1, 0] } },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || { total: 0, unread: 0 },
        byType: typeStats,
        byPriority: priorityStats,
        timeframe,
      },
    });
  } catch (error) {
    console.error("Error fetching admin notification stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notification statistics",
    });
  }
});

// // POST /api/notifications/test - Test notification creation (development only)
// router.post("/test", auth, async (req, res) => {
//   try {
//     const userId = req.user?._id;
//     const { type = "admin_news", title, message } = req.body;

//     const testTitle = title || "Test Notification";
//     const testMessage =
//       message ||
//       "This is a test notification from the development environment.";

//     let notification;

//     switch (type) {
//       case "warning":
//         notification = await NotificationService.createWarningNotification(
//           userId,
//           {
//             _id: new mongoose.Types.ObjectId(),
//             message: testMessage,
//           }
//         );
//         break;
//       case "profile_image_status":
//         notification = await NotificationService.createProfileImageNotification(
//           userId,
//           "approved",
//           { profileImageUrl: "https://example.com/image.jpg" }
//         );
//         break;
//       default:
//         notification = await Notification.createNotification({
//           userId,
//           type,
//           title: testTitle,
//           message: testMessage,
//           priority: "medium",
//         });
//     }

//     res.json({
//       success: true,
//       message: "Test notification created",
//       data: notification,
//     });
//   } catch (error) {
//     console.error("Error creating test notification:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to create test notification",
//     });
//   }
// });

export default router;
