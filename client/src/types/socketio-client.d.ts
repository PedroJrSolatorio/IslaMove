declare module 'socket.io-client' {
  import {Socket} from 'socket.io-client';
  const io: (url: string, options?: any) => Socket;
  export {io, Socket};
}
