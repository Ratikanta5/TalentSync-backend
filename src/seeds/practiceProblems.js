const mongoose = require('mongoose');
const PracticeProblem = require('../database/models/PracticeProblem');

async function seedProblems() {
  try {
    // Check if problems already exist
    const existingCount = await PracticeProblem.countDocuments();
    
    if (existingCount > 0) {
      console.log(`✅ Database contains ${existingCount} practice problems.`);
      return;
    }

    // No default problems - problems will be added through the website
    console.log('✅ Seed initialized. Add practice problems through the admin website panel.');
  } catch (error) {
    console.error('❌ Error in seed function:', error);
    throw error;
  }
}

module.exports = seedProblems;
