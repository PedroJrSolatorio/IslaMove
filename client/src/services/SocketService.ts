import {io, Socket} from 'socket.io-client';
import {BACKEND_URL} from '@env';

class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private onSessionRevokedCallback:
    | ((data: {message: string; newDeviceId: string}) => void)
    | null = null;
  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public connect(token: string, deviceId: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      try {
        console.log('Attempting to connect to socket with URL:', BACKEND_URL);
        console.log('Token length:', token?.length || 0);

        // Disconnect existing connection if any
        if (this.socket) {
          this.socket.disconnect();
          this.socket = null; // Clear old socket
        }

        this.socket = io(BACKEND_URL, {
          // Pass token in auth object
          auth: {
            token: token,
          },
          query: {
            // Pass deviceId as a query parameter for the socket handshake
            deviceId: deviceId,
          },
          transports: ['websocket'],
          timeout: 20000,
          forceNew: true,
          // Add reconnection settings
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        this.socket.on('connect', () => {
          console.log('Socket connected successfully');
          console.log('Socket ID:', this.socket?.id);
          resolve(this.socket!);
        });

        this.socket.on('connect_error', (error: Error) => {
          console.error('Socket connection error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
          });

          // Check if it's an authentication error
          if (
            error.message.includes('Authentication error') ||
            error.message.includes('User not found')
          ) {
            console.error(
              'Authentication failed - token may be invalid or user not found',
            );
            // This case might mean the token used for socket connection is bad, so we should signal logout.
            if (this.onSessionRevokedCallback) {
              this.onSessionRevokedCallback({
                message: 'Socket authentication failed. Please log in again.',
                newDeviceId: '',
              });
            }
          }
          reject(error);
        });

        this.socket.on('disconnect', (reason: string) => {
          console.log('Socket disconnected:', reason);

          // Handle different disconnect reasons
          if (reason === 'io server disconnect') {
            console.log(
              'Server disconnected the socket - may need to reconnect',
            );
          } else if (
            reason === 'transport close' ||
            reason === 'transport error'
          ) {
            console.log('Network issue - attempting to reconnect...');
          }
        });

        this.socket.on('error', (error: any) => {
          console.error('Socket error:', error);
        });

        this.socket.on('authenticated', () => {
          console.log('Socket authentication successful');
        });

        this.socket.on('unauthorized', (error: any) => {
          console.error('Socket authentication failed:', error);
          reject(new Error(`Authentication failed: ${error.message}`));
        });

        // Listen for 'session_revoked' event
        this.socket.on(
          'session_revoked',
          (data: {message: string; newDeviceId: string}) => {
            // Only trigger if a callback is registered
            if (this.onSessionRevokedCallback) {
              this.onSessionRevokedCallback(data);
            } else {
              console.warn(
                'Session revoked event received but no handler registered in SocketService.',
              );
            }
          },
        );

        // Re-add event listeners
        this.listeners.forEach((callbacks, event) => {
          callbacks.forEach(callback => {
            this.socket!.on(event, callback);
          });
        });
      } catch (error) {
        console.error('Socket initialization error:', error);
        reject(error);
      }
    });
  }

  public disconnect(): void {
    try {
      if (this.socket) {
        // Remove all listeners first
        this.socket.removeAllListeners();
        // Then disconnect
        this.socket.disconnect();
        this.socket = null;
      }
      // Clear all stored listeners
      this.listeners.clear();
      // Clear session revoked callback
      this.onSessionRevokedCallback = null;
    } catch (error) {
      console.error('Error during socket disconnect:', error);
    }
  }

  //Register a callback for session revocation
  public setOnSessionRevoked(
    callback: (data: {message: string; newDeviceId: string}) => void,
  ) {
    this.onSessionRevokedCallback = callback;
  }

  //Clear the session revoked callback
  public clearOnSessionRevoked() {
    this.onSessionRevokedCallback = null;
  }

  public on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    if (this.socket) {
      this.socket.on(event, callback as any);
    }
  }

  public off(event: string, callback?: Function) {
    if (callback && this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    } else if (!callback) {
      this.listeners.delete(event);
    }

    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback as any);
      } else {
        this.socket.off(event);
      }
    }
  }

  public emit(event: string, data: any, callback?: Function) {
    if (this.socket?.connected) {
      if (callback) {
        this.socket.emit(event, data, callback);
      } else {
        this.socket.emit(event, data);
      }
    } else {
      console.warn('Socket not connected. Unable to emit event:', event);
    }
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Helper method to get connection status
  public getConnectionStatus(): string {
    if (!this.socket) return 'disconnected';
    return this.socket.connected ? 'connected' : 'disconnected';
  }
}

export default SocketService.getInstance();
