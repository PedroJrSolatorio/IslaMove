import {io, Socket} from 'socket.io-client';
import {BACKEND_URL} from '@env';
class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private constructor() {}
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }
  public connect(token: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(BACKEND_URL, {
          query: {token},
          transports: ['websocket'],
        });
        this.socket.on('connect', () => {
          console.log('Socket connected');
          resolve(this.socket!);
        });
        this.socket.on('connect_error', (error: Error) => {
          console.error('Socket connection error:', error);
          reject(error);
        });
        this.socket.on('disconnect', (reason: string) => {
          console.log('Socket disconnected:', reason);
        });
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
  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
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
    if (this.socket) {
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
}
export default SocketService.getInstance();
