const { Server } = require('socket.io');
const { ALLOWED_ORIGINS } = require('../appConfig');

const interviewCodeState = new Map();

const getRoomName = (interviewId) => `interview:${interviewId}`;

const getInterviewState = (interviewId) => {
  if (!interviewCodeState.has(interviewId)) {
    interviewCodeState.set(interviewId, {});
  }

  return interviewCodeState.get(interviewId);
};

const initializeSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('interview:join', ({ interviewId, userId, userName, role }) => {
      if (!interviewId || !userId) {
        return;
      }

      socket.data.interviewId = interviewId;
      socket.data.userId = userId;
      socket.data.userName = userName || 'Anonymous';
      socket.data.role = role || 'candidate';

      socket.join(getRoomName(interviewId));

      socket.emit('code:state', {
        interviewId,
        codes: getInterviewState(interviewId),
      });
    });

    socket.on('code:sync', ({ interviewId, questionKey, language, code }) => {
      if (!interviewId || !questionKey || !language) {
        return;
      }

      const state = getInterviewState(interviewId);
      state[questionKey] = {
        ...(state[questionKey] || {}),
        [language]: code || '',
      };

      socket.to(getRoomName(interviewId)).emit('code:update', {
        interviewId,
        questionKey,
        language,
        code: code || '',
        userId: socket.data.userId,
        userName: socket.data.userName,
        role: socket.data.role,
      });
    });

    socket.on('disconnect', () => {});
  });

  return io;
};

module.exports = {
  initializeSocketServer,
};
