import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Index for efficient querying
    },
    type: {
      type: String,
      enum: [
        "profile_image_status",
        "warning",
        "senior_id_validation",
        "category_change_request",
        "category_change_auto",
        "admin_news",
        "school_id_reminder",
        "senior_eligibility",
        "account_security",
        "system_update",
      ],
      required: true,
      index: true, // Index for filtering by type
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    data: {
      // Additional data related to the notification
      profileImageUrl: String,
      rejectionReason: String,
      warningId: mongoose.Schema.Types.ObjectId,
      requestId: String,
      previousCategory: String,
      newCategory: String,
      adminId: mongoose.Schema.Types.ObjectId,
      actionRequired: Boolean,
      expirationDate: Date,
      // Generic metadata for future extensibility
      metadata: mongoose.Schema.Types.Mixed,
    },
    read: {
      type: Boolean,
      default: false,
      index: true, // Index for filtering read/unread
    },
    readAt: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    // For scheduled notifications or expiring notifications
    expiresAt: {
      type: Date,
      index: { expireAfterSeconds: 0 }, // Auto-delete expired notifications
    },
    // For tracking notification delivery
    delivered: {
      type: Boolean,
      default: false,
    },
    deliveredAt: {
      type: Date,
    },
    // For push notifications
    pushNotificationSent: {
      type: Boolean,
      default: false,
    },
    pushNotificationSentAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    // Compound indexes for common queries
    indexes: [
      { userId: 1, read: 1, createdAt: -1 }, // User notifications ordered by date
      { userId: 1, type: 1, createdAt: -1 }, // User notifications by type
      { createdAt: 1 }, // For cleanup jobs
    ],
  }
);

// Static method to create notifications
notificationSchema.statics.createNotification = async function (
  notificationData
) {
  try {
    const notification = new this(notificationData);
    await notification.save();

    // Here you could add push notification logic
    // await sendPushNotification(notification);
    // this is for pop-up banner (outside the app), or a lock screen alert

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

// Static method to create bulk notifications (for admin news)
notificationSchema.statics.createBulkNotifications = async function (
  userIds,
  notificationData
) {
  try {
    const notifications = userIds.map((userId) => ({
      ...notificationData,
      userId,
    }));

    const result = await this.insertMany(notifications);
    return result;
  } catch (error) {
    console.error("Error creating bulk notifications:", error);
    throw error;
  }
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = async function () {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

// Static method to mark multiple notifications as read
notificationSchema.statics.markAllAsRead = async function (userId) {
  try {
    const result = await this.updateMany(
      { userId, read: false },
      {
        read: true,
        readAt: new Date(),
      }
    );
    return result;
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    throw error;
  }
};

// Static method to get user notifications with pagination
notificationSchema.statics.getUserNotifications = async function (
  userId,
  options = {}
) {
  try {
    const {
      page = 1,
      limit = 20,
      type = null,
      read = null,
      priority = null,
    } = options;

    const query = { userId };

    if (type) query.type = type;
    if (read !== null) query.read = read;
    if (priority) query.priority = priority;

    const notifications = await this.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await this.countDocuments(query);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("Error getting user notifications:", error);
    throw error;
  }
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
