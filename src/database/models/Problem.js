const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Problem Test Case
const testCaseSchema = new Schema({
  input: {
    type: String,
    required: true
  },
  expectedOutput: {
    type: String,
    required: true
  },
  isHidden: {
    type: Boolean,
    default: false
  }
}, { _id: true });

// Problem Model (for Practice Library)
const problemSchema = new Schema({
  // Basic Information
  slug: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true,
    index: true
  },

  // Company Association
  company: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  companyName: String, // Denormalized

  // Category and Tags
  tags: [
    {
      type: Schema.Types.ObjectId,
      ref: 'ProblemTag'
    }
  ],
  topics: [String],

  // Problem Content
  problemStatement: String,
  inputFormat: String,
  outputFormat: String,
  constraints: [String],
  hints: [String],

  // Test Cases
  testCases: [testCaseSchema],
  exampleTestCases: [testCaseSchema],

  // Starter Code for different languages
  starterCode: {
    javascript: String,
    python: String,
    java: String
  },

  // Solution (can be hidden or shown)
  solutionCode: {
    javascript: String,
    python: String,
    java: String
  },
  explanation: String,

  // Statistics
  stats: {
    submissionCount: { type: Number, default: 0 },
    acceptedCount: { type: Number, default: 0 },
    acceptanceRate: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    averageDifficulty: { type: Number, default: 0 },
    averageTime: Number // in minutes
  },

  // Metadata
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  // Publishing
  isPublished: { type: Boolean, default: false },
  publishedAt: Date,

  // Timestamps
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
problemSchema.index({ company: 1, difficulty: 1 });
problemSchema.index({ difficulty: 1, 'stats.acceptanceRate': -1 });
problemSchema.index({ tags: 1, difficulty: 1 });
problemSchema.index({ isPublished: 1, createdAt: -1 });

module.exports = mongoose.model('Problem', problemSchema);
