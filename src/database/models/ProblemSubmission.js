const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// User Submission for Practice Problems
const problemSubmissionSchema = new Schema({
  // References
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  problem: {
    type: Schema.Types.ObjectId,
    ref: 'PracticeProblem',
    required: true,
    index: true
  },

  // Code Information
  code: {
    type: String,
    required: true
  },
  language: {
    type: String,
    enum: ['javascript', 'python', 'java', 'cpp'],
    default: 'javascript'
  },

  // Execution Results
  status: {
    type: String,
    enum: ['pending', 'running', 'accepted', 'wrong-answer', 'runtime-error', 'time-limit', 'compilation-error'],
    default: 'pending',
    index: true
  },

  testResults: [{
    testCaseId: Schema.Types.ObjectId,
    input: String,
    expectedOutput: String,
    actualOutput: String,
    passed: Boolean,
    error: String,
    runtime: Number,
    memory: Number
  }],

  // Test Summary
  totalTestCases: Number,
  passedTestCases: Number,
  failedTestCases: Number,

  // Performance Metrics
  executionTime: Number,
  memory: Number,
  errorLog: String,

  // Attempt Information
  attemptNumber: {
    type: Number,
    default: 1
  },
  isBestSubmission: {
    type: Boolean,
    default: false
  },

  // Timestamps
  submittedAt: { type: Date, default: Date.now, index: true },
  completedAt: Date
}, { timestamps: true });

// Indexes for efficient querying
problemSubmissionSchema.index({ user: 1, problem: 1 });
problemSubmissionSchema.index({ user: 1, status: 1 });
problemSubmissionSchema.index({ problem: 1, status: 1 });
problemSubmissionSchema.index({ submittedAt: -1 });
problemSubmissionSchema.index({ user: 1, submittedAt: -1 });

module.exports = mongoose.model('ProblemSubmission', problemSubmissionSchema);
