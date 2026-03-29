const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const problemTagSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true
  },
  description: String,
  color: String, // for UI display
  category: {
    type: String,
    enum: ['data_structure', 'algorithm', 'concept', 'language_specific'],
    default: 'algorithm'
  },

  // Statistics
  problemCount: {
    type: Number,
    default: 0
  },

  // Timestamps
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

problemTagSchema.index({ category: 1 });

module.exports = mongoose.model('ProblemTag', problemTagSchema);
