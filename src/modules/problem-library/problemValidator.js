/**
 * Validation rules for problem operations
 */

const validateProblemCreation = (data) => {
  const errors = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Problem title is required');
  }

  if (data.title && data.title.length > 300) {
    errors.push('Problem title must be less than 300 characters');
  }

  if (!data.problemStatement || data.problemStatement.trim().length === 0) {
    errors.push('Problem statement is required');
  }

  if (!data.difficulty || !['easy', 'medium', 'hard'].includes(data.difficulty)) {
    errors.push('Invalid difficulty level (easy, medium, hard)');
  }

  if (!data.testCases || data.testCases.length === 0) {
    errors.push('At least one test case is required');
  }

  if (data.testCases) {
    data.testCases.forEach((tc, idx) => {
      if (!tc.input) errors.push(`Test case ${idx + 1}: input is required`);
      if (!tc.expectedOutput) errors.push(`Test case ${idx + 1}: expectedOutput is required`);
    });
  }

  if (data.topics && !Array.isArray(data.topics)) {
    errors.push('Topics must be an array');
  }

  if (data.tags && !Array.isArray(data.tags)) {
    errors.push('Tags must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

const validateProblemUpdate = (data) => {
  const errors = [];

  // Only validate fields that are provided
  if (data.title !== undefined) {
    if (data.title.trim().length === 0) {
      errors.push('Problem title cannot be empty');
    }
    if (data.title.length > 300) {
      errors.push('Problem title must be less than 300 characters');
    }
  }

  if (data.difficulty !== undefined) {
    if (!['easy', 'medium', 'hard'].includes(data.difficulty)) {
      errors.push('Invalid difficulty level');
    }
  }

  if (data.topics !== undefined && !Array.isArray(data.topics)) {
    errors.push('Topics must be an array');
  }

  if (data.tags !== undefined && !Array.isArray(data.tags)) {
    errors.push('Tags must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

const validateSubmission = (data) => {
  const errors = [];

  if (!data.code || data.code.trim().length === 0) {
    errors.push('Code cannot be empty');
  }

  if (!data.language || !['javascript', 'python', 'python3', 'java', 'cpp', 'c++'].includes(data.language)) {
    errors.push('Invalid programming language (javascript, python, java, cpp)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

const validateQueryParams = (query) => {
  const errors = [];

  if (query.difficulty && !['easy', 'medium', 'hard'].includes(query.difficulty)) {
    errors.push('Invalid difficulty filter');
  }

  if (query.page && (isNaN(query.page) || query.page < 1)) {
    errors.push('Page must be a positive number');
  }

  if (query.limit && (isNaN(query.limit) || query.limit < 1 || query.limit > 100)) {
    errors.push('Limit must be between 1 and 100');
  }

  if (query.sort && !['recent', 'popularity', 'difficulty', 'acceptance'].includes(query.sort)) {
    errors.push('Invalid sort option');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateProblemCreation,
  validateProblemUpdate,
  validateSubmission,
  validateQueryParams
};
