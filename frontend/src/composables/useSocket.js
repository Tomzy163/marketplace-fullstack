import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/auth';

let socket;

export function useSocket() {
  const auth = useAuthStore();

  function connect() {
    if (socket?.connected) return socket;
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token: auth.accessToken },
    });
    return socket;
  }

  function joinTicket(ticketId) {
    connect().emit('ticket:join', { ticketId });
  }

  function sendTicketMessage(ticketId, message) {
    connect().emit('ticket:message', { ticketId, message });
  }

  return {
    connect,
    joinTicket,
    sendTicketMessage,
  };
}
