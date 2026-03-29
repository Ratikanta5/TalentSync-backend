/**
 * WebSocket Event Architecture & Handler Configuration
 * Real-time communication for interviews and collaborative coding
 */

const WEBSOCKET_EVENTS = {
  // ==================== INTERVIEW EVENTS ====================
  
  // Interview session events
  INTERVIEW_CREATED: 'interview:created',          // New interview created
  INTERVIEW_STARTED: 'interview:started',          // Interview session started
  INTERVIEW_PAUSED: 'interview:paused',            // Interview paused
  INTERVIEW_RESUMED: 'interview:resumed',          // Interview resumed
  INTERVIEW_ENDED: 'interview:ended',              // Interview session ended

  // Question management
  QUESTION_ADDED: 'interview:question_added',      // New question added to interview
  QUESTION_REMOVED: 'interview:question_removed',  // Question removed
  QUESTION_CHANGED: 'interview:question_changed',  // Current question changed

  // Candidate participation
  CANDIDATE_JOINED: 'interview:candidate_joined',    // Candidate joined interview
  CANDIDATE_LEFT: 'interview:candidate_left',        // Candidate left interview
  CANDIDATE_STATUS_CHANGED: 'interview:candidate_status_changed', // Status update

  // ==================== CODE COLLABORATION EVENTS ====================

  // Code editor synchronization
  CODE_CHANGED: 'code:changed',                    // Code editor content changed
  CODE_EXECUTED: 'code:executed',                  // Code execution result
  CODE_TEST_RESULT: 'code:test_result',            // Test case result
  CURSOR_MOVED: 'code:cursor_moved',               // Real-time cursor tracking

  // ==================== CHAT EVENTS ====================

  MESSAGE_SENT: 'chat:message_sent',               // New message in chat
  MESSAGE_DELETED: 'chat:message_deleted',         // Message deleted
  USER_TYPING: 'chat:user_typing',                 // User is typing indicator

  // ==================== NOTIFICATION EVENTS ====================

  NOTIFICATION_SENT: 'notification:sent',          // System notification
  FEEDBACK_SUBMITTED: 'interview:feedback_submitted', // Interview feedback

  // ==================== SYSTEM EVENTS ====================

  CONNECTION_ESTABLISHED: 'system:connected',      // WebSocket connected
  CONNECTION_CLOSED: 'system:disconnected',        // WebSocket disconnected
  ERROR_OCCURRED: 'system:error',                  // System error
  USER_PRESENCE_UPDATED: 'system:user_presence'    // User online status
};

/**
 * WebSocket Event Payloads & Schemas
 */

const EVENT_SCHEMAS = {
  // Interview Created
  'interview:created': {
    payload: {
      interviewId: String,
      sessionId: String,
      meetingLink: String,
      title: String,
      interviewer: Object,
      createdAt: Date
    },
    audience: 'interviewer', // Only interviewer receives
    persistence: true
  },

  // Interview Started
  'interview:started': {
    payload: {
      interviewId: String,
      startedAt: Date,
      streamCallId: String,
      streamChannelId: String,
      questions: Array
    },
    audience: 'all', // All participants
    persistence: true
  },

  // Question Changed
  'interview:question_changed': {
    payload: {
      interviewId: String,
      questionIndex: Number,
      question: {
        _id: String,
        title: String,
        description: String,
        difficulty: String,
        testCases: Array,
        starterCode: String,
        constraints: String,
        hints: Array
      },
      previousIndex: Number
    },
    audience: 'all',
    persistence: true
  },

  // Candidate Joined
  'interview:candidate_joined': {
    payload: {
      interviewId: String,
      userId: String,
      userName: String,
      email: String,
      joinedAt: Date,
      selectedLanguage: String
    },
    audience: 'all',
    persistence: false
  },

  // Code Changed (Real-time sync)
  'code:changed': {
    payload: {
      interviewId: String,
      questionIndex: Number,
      code: String,
      language: String,
      userId: String,
      userName: String,
      cursorPosition: {
        line: Number,
        column: Number
      },
      timestamp: Date
    },
    audience: 'all',
    persistence: false // Don't store in DB, just broadcast
  },

  // Code Executed
  'code:executed': {
    payload: {
      interviewId: String,
      questionIndex: Number,
      userId: String,
      code: String,
      language: String,
      executionTime: Number,
      memory: Number,
      output: String,
      errorLog: String,
      timestamp: Date
    },
    audience: 'all',
    persistence: true // Store for later review
  },

  // Test Result
  'code:test_result': {
    payload: {
      interviewId: String,
      questionIndex: Number,
      userId: String,
      testCaseIndex: Number,
      testCase: {
        input: String,
        expectedOutput: String
      },
      actualOutput: String,
      passed: Boolean,
      executionTime: Number,
      memory: Number,
      errorLog: String,
      timestamp: Date
    },
    audience: 'all',
    persistence: true
  },

  // Message Sent
  'chat:message_sent': {
    payload: {
      interviewId: String,
      userId: String,
      userName: String,
      message: String,
      messageType: 'text', // 'text', 'code', 'link'
      timestamp: Date,
      messageId: String
    },
    audience: 'all',
    persistence: true
  },

  // Interview Ended
  'interview:ended': {
    payload: {
      interviewId: String,
      endedAt: Date,
      duration: Number, // in seconds
      finalSubmissions: Array,
      feedback: String,
      rating: Number
    },
    audience: 'all',
    persistence: true
  }
};

/**
 * WebSocket Connection Management
 */

const WebSocketManager = {
  // Store active connections
  connections: new Map(), // Map<userId, Set<socketId>>
  
  // Store active interviews
  activeInterviews: new Map(), // Map<interviewId, Set<socketId>>

  /**
   * Register user connection
   * @param {String} userId - User ID
   * @param {String} socketId - Socket ID
   */
  registerConnection(userId, socketId) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId).add(socketId);
  },

  /**
   * Unregister user connection
   * @param {String} userId - User ID
   * @param {String} socketId - Socket ID
   */
  unregisterConnection(userId, socketId) {
    if (this.connections.has(userId)) {
      this.connections.get(userId).delete(socketId);
      if (this.connections.get(userId).size === 0) {
        this.connections.delete(userId);
      }
    }
  },

  /**
   * Join user to interview room
   * @param {String} interviewId - Interview ID
   * @param {String} socketId - Socket ID
   */
  joinInterview(interviewId, socketId) {
    if (!this.activeInterviews.has(interviewId)) {
      this.activeInterviews.set(interviewId, new Set());
    }
    this.activeInterviews.get(interviewId).add(socketId);
  },

  /**
   * Leave interview room
   * @param {String} interviewId - Interview ID
   * @param {String} socketId - Socket ID
   */
  leaveInterview(interviewId, socketId) {
    if (this.activeInterviews.has(interviewId)) {
      this.activeInterviews.get(interviewId).delete(socketId);
      if (this.activeInterviews.get(interviewId).size === 0) {
        this.activeInterviews.delete(interviewId);
      }
    }
  },

  /**
   * Get all sockets for interview
   * @param {String} interviewId - Interview ID
   * @returns {Set<String>} Socket IDs
   */
  getInterviewSockets(interviewId) {
    return this.activeInterviews.get(interviewId) || new Set();
  },

  /**
   * Get all sockets for user
   * @param {String} userId - User ID
   * @returns {Set<String>} Socket IDs
   */
  getUserSockets(userId) {
    return this.connections.get(userId) || new Set();
  },

  /**
   * Check if user is online
   * @param {String} userId - User ID
   * @returns {Boolean}
   */
  isUserOnline(userId) {
    return this.connections.has(userId) && this.connections.get(userId).size > 0;
  },

  /**
   * Check if user is in interview
   * @param {String} userId - User ID
   * @param {String} interviewId - Interview ID
   * @returns {Boolean}
   */
  isUserInInterview(userId, interviewId) {
    // Implementation would require tracking userId in socket data
    return true; // Placeholder
  }
};

/**
 * Event Broadcasting Strategies
 */

const BroadcastStrategies = {
  /**
   * Broadcast to all in interview
   */
  TO_INTERVIEW: (interviewId) => ({
    room: `interview:${interviewId}`,
    filter: null
  }),

  /**
   * Broadcast to specific user(s)
   */
  TO_USER: (userId) => ({
    room: null,
    targetUsers: [userId],
    direct: true
  }),

  /**
   * Broadcast to all except sender
   */
  TO_OTHERS: (interviewId, excludeSocketId) => ({
    room: `interview:${interviewId}`,
    exclude: [excludeSocketId]
  }),

  /**
   * Broadcast to interviewer only
   */
  TO_INTERVIEWER: (interviewId) => ({
    room: `interview:${interviewId}`,
    filter: 'interviewer'
  }),

  /**
   * Broadcast to candidates only
   */
  TO_CANDIDATES: (interviewId) => ({
    room: `interview:${interviewId}`,
    filter: 'candidates'
  })
};

/**
 * WebSocket Server Configuration
 * 
 * To be implemented in socketConfig.js:
 * - Socket.IO server initialization
 * - Event handler registration
 * - Connection/disconnection logic
 * - Room management
 * - Broadcasting utilities
 * 
 * Example event handler structure:
 * 
 * socket.on('interview:started', (data) => {
 *   const { interviewId, startedAt } = data;
 *   
 *   // Validate & process
 *   // Broadcast to all participants
 *   io.to(`interview:${interviewId}`).emit('interview:started', {
 *     ...data,
 *     broadcastedAt: new Date()
 *   });
 *   
 *   // Persist event if needed
 *   // Update interview status in DB
 * });
 */

module.exports = {
  WEBSOCKET_EVENTS,
  EVENT_SCHEMAS,
  WebSocketManager,
  BroadcastStrategies
};
