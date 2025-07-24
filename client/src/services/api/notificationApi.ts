import AsyncStorage from '@react-native-async-storage/async-storage';
import {BACKEND_URL} from '@env';

class NotificationApiService {
  // Get auth token from storage
  static async getAuthToken() {
    try {
      const token = await AsyncStorage.getItem('userToken');
      // console.log('Retrieved token:', token);
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Common headers for API requests
  static async getHeaders() {
    const token = await this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && {Authorization: `Bearer ${token}`}),
    };
  }

  // Handle API response
  static async handleResponse(response: Response): Promise<any> {
    if (!response.ok) {
      // const errorData = await response.json().catch(() => ({}));
      // throw new Error(
      //   errorData.error || `HTTP error! status: ${response.status}`,
      // );
      const errorData = await response.text();
      console.error('Full error response:', errorData);
      throw new Error(`Failed to fetch notification statistics`);
    }
    return response.json();
  }

  // Get user notifications with pagination and filters
  static async getNotifications(
    options: {
      page?: number;
      limit?: number;
      type?: string | null;
      read?: boolean | null;
      priority?: string | null;
    } = {},
  ): Promise<any> {
    try {
      const {
        page = 1,
        limit = 20,
        type = null,
        read = null,
        priority = null,
      } = options;

      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', limit.toString());

      if (type) queryParams.append('type', type);
      if (read !== null) queryParams.append('read', read.toString());
      if (priority) queryParams.append('priority', priority);

      const response = await fetch(
        `${BACKEND_URL}/api/notifications?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: await this.getHeaders(),
        },
      );

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  // Get notification statistics
  static async getNotificationStats() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications/stats`, {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error fetching notification stats:', error);
      throw error;
    }
  }

  // Mark a specific notification as read
  static async markNotificationAsRead(notificationId: string): Promise<any> {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/notifications/${notificationId}/read`,
        {
          method: 'PUT',
          headers: await this.getHeaders(),
        },
      );

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  static async markAllNotificationsAsRead() {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/notifications/mark-all-read`,
        {
          method: 'PUT',
          headers: await this.getHeaders(),
        },
      );

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Delete a notification
  static async deleteNotification(notificationId: string): Promise<any> {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/notifications/${notificationId}`,
        {
          method: 'DELETE',
          headers: await this.getHeaders(),
        },
      );

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // Send admin notification (admin only)
  static async sendAdminNotification(
    notificationData: Record<string, any>,
  ): Promise<any> {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/notifications/admin/send`,
        {
          method: 'POST',
          headers: await this.getHeaders(),
          body: JSON.stringify(notificationData),
        },
      );

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error sending admin notification:', error);
      throw error;
    }
  }

  // Get admin notification statistics (admin only)
  static async getAdminNotificationStats(timeframe = '7d') {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/notifications/admin/stats?timeframe=${timeframe}`,
        {
          method: 'GET',
          headers: await this.getHeaders(),
        },
      );

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error fetching admin notification stats:', error);
      throw error;
    }
  }

  // Create test notification (development only)
  static async createTestNotification(testData = {}) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications/test`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify(testData),
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error creating test notification:', error);
      throw error;
    }
  }
}

export default NotificationApiService;
