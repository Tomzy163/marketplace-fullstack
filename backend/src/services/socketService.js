const { verifyAccessToken } = require('../utils/tokens');

function registerSockets(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Socket authentication required'));

    try {
      socket.user = verifyAccessToken(token);
      return next();
    } catch (_error) {
      return next(new Error('Invalid socket token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('ticket:join', ({ ticketId }) => {
      if (ticketId) socket.join(`ticket:${ticketId}`);
    });

    socket.on('ticket:message', ({ ticketId, message }) => {
      if (!ticketId || !message) return;
      io.to(`ticket:${ticketId}`).emit('ticket:message', {
        ticketId,
        senderId: socket.user.id,
        message,
        createdAt: new Date().toISOString(),
      });
    });

    socket.on('seller:join', ({ sellerId }) => {
      if (sellerId && (socket.user.role === 'seller' || socket.user.role === 'support_agent')) {
        socket.join(`seller:${sellerId}`);
      }
    });
  });
}

module.exports = registerSockets;
