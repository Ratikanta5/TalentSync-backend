const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');

// Interview Session Model
const interviewSchema = new Schema({
  // Session Identification
  sessionId: {
    type: String,
    unique: true,
    required: true,
    default: () => crypto.randomBytes(16).toString('hex'),
    index: true
  },

  // Participants
  interviewer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  candidates: [
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      name: String,
      email: String,
      joinedAt: Date,
      leftAt: Date,
      status: {
        type: String,
        enum: ['invited', 'joined', 'active', 'left', 'completed'],
        default: 'invited'
      }
    }
  ],

  // Interview Details
  title: {
    type: String,
    required: true,
    index: true
  },
  description: String,
  company: String,

  // Scheduling & Duration
  scheduledFor: Date,  // When interview is scheduled
  startedAt: Date,     // When interview actually started
  endedAt: Date,       // When interview actually ended
  timeLimit: {
    type: Number,
    default: 60,  // minutes
    required: true
  },

  // Stream.io Integration
  streamCallId: {
    type: String,
    default: null
  },
  streamChannelId: {
    type: String,
    default: null
  },

  // Interview Settings
  settings: {
    videoEnabled: { type: Boolean, default: true },
    chatEnabled: { type: Boolean, default: true },
    collaborativeCodeEnabled: { type: Boolean, default: true },
    autoTimerEnabled: { type: Boolean, default: true }
  },

  // Interview Status
  status: {
    type: String,
    enum: [
      'draft',        // Created but not scheduled
      'scheduled',    // Scheduled for future
      'active',       // Currently in progress
      'completed',    // Finished successfully
      'cancelled',    // Cancelled by interviewer
      'pending',      // Awaiting candidate response
      'rejected'      // Candidate rejected
    ],
    default: 'draft',
    index: true
  },

  // Cancellation/Rejection Reason
  cancellationReason: String,
  rejectionReason: String,

  // Metadata
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Create indexes for better query performance
interviewSchema.index({ interviewer: 1, status: 1 });
interviewSchema.index({ 'candidates.userId': 1, status: 1 });
interviewSchema.index({ scheduledFor: 1, status: 1 });
interviewSchema.index({ createdAt: -1 });

// Auto-update `updatedAt` on save
interviewSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Interview', interviewSchema);
