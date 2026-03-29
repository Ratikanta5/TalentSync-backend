const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Test Case Schema
const testCaseSchema = new Schema({
  _id: Schema.Types.ObjectId,
  input: {
    type: String,
    required: true
  },
  expectedOutput: {
    type: String,
    required: true
  },
  explanation: String,
  isHidden: {
    type: Boolean,
    default: false  // Hidden test cases for final evaluation
  }
}, { _id: true });

// Practice Problem Schema
const problemSchema = new Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    index: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  
  // Problem Details
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
    index: true
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  tags: [{
    type: String,
    index: true
  }],
  
  // Company & Role Based
  companies: [{
    type: String,
    index: true
  }],
  rolesRequired: [{
    type: String,
    enum: ['frontend', 'backend', 'fullstack', 'devops', 'qa', 'ml', 'data-engineer'],
    index: true
  }],
  
  // Problem Statement
  problemStatement: {
    type: String,
    required: true
  },
  constraints: [String],
  examples: [{
    input: String,
    output: String,
    explanation: String
  }],
  hints: [String],
  
  // Code Templates
  starterCode: {
    javascript: {
      type: String,
      default: '// Write your solution here\n'
    },
    python: {
      type: String,
      default: '# Write your solution here\n'
    },
    java: {
      type: String,
      default: 'public class Solution {\n    // Write your solution here\n}\n'
    },
    cpp: {
      type: String,
      default: '// Write your solution here\n'
    }
  },
  
  // Test Cases
  testCases: [testCaseSchema],
  
  // Statistics
  stats: {
    totalAttempts: { type: Number, default: 0 },
    totalSubmissions: { type: Number, default: 0 },
    acceptedCount: { type: Number, default: 0 },
    acceptanceRate: { type: Number, default: 0 },
    averageRuntime: {
      type: Number,
      default: 0
    },
    averageMemory: {
      type: Number,
      default: 0
    }
  },
  
  // Time Limit for Execution
  timeLimit: {
    type: Number,
    default: 5000  // milliseconds
  },
  memoryLimit: {
    type: Number,
    default: 256  // MB
  },
  
  // Publishing
  isPublished: {
    type: Boolean,
    default: false,
    index: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Interview Source - Track where this problem came from
  sourceInterview: {
    type: Schema.Types.ObjectId,
    ref: 'Session'  // Reference to the interview session where this question was asked
  },
  sourceCompany: {
    type: String,
    index: true  // Company from the interview
  },
  sourceRole: {
    type: String,
    enum: ['frontend', 'backend', 'fullstack', 'devops', 'qa', 'ml', 'data-engineer'],
    index: true  // Role from the interview
  },
  askedByInterviewer: {
    type: String  // Name/ID of the interviewer who asked this question
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Create indexes for better performance
problemSchema.index({ category: 1, difficulty: 1 });
problemSchema.index({ companies: 1, rolesRequired: 1 });
problemSchema.index({ tags: 1, difficulty: 1 });
problemSchema.index({ isPublished: 1, createdAt: -1 });
problemSchema.index({ difficulty: 1, acceptanceRate: -1 });

// Pre-save middleware to generate slug
problemSchema.pre('save', function(next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

module.exports = mongoose.model('PracticeProblem', problemSchema);
