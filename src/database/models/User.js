const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Simplified User model - focus on essentials for onboarding
const userSchema = new Schema({
  // Authentication (Required)
  clerkId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },

  // Profile
  avatar: {
    type: String,
    default: null
  },
  bio: String,

  // Role and Company
  role: {
    type: String,
    enum: ['interviewer', 'candidate', 'admin'],
    default: 'candidate'
  },
  companyName: {
    type: String,
    required: function() { 
      return this.role === 'interviewer'; 
    }
  },
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for role queries (email and clerkId are already indexed via field definition)
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
