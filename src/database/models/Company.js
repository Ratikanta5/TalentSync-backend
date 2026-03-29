const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const companySchema = new Schema({
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
  logo: String,
  website: String,
  description: String,
  industry: String,

  // Statistics
  stats: {
    interviewsCount: { type: Number, default: 0 },
    averageDifficulty: String,
    topicsAsked: [String]
  },

  // Contact
  email: String,
  phone: String,

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

companySchema.index({ slug: 1 });
companySchema.index({ name: 'text' });

module.exports = mongoose.model('Company', companySchema);
