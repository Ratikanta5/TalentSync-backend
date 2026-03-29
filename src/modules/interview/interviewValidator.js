/**
 * Validation rules for interview operations
 */

const validateInterviewCreation = (data) => {
  const errors = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Interview title is required');
  }

  if (data.title && data.title.length > 200) {
    errors.push('Interview title must be less than 200 characters');
  }

  if (data.description && data.description.length > 2000) {
    errors.push('Interview description must be less than 2000 characters');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

const validateQuestionData = (data) => {
  const errors = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Question title is required');
  }

  if (!data.description || data.description.trim().length === 0) {
    errors.push('Question description is required');
  }

  if (!data.difficulty || !['easy', 'medium', 'hard'].includes(data.difficulty)) {
    errors.push('Invalid difficulty level');
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

  return {
    valid: errors.length === 0,
    errors
  };
};

const validateCodeSubmission = (data) => {
  const errors = [];

  if (!data.code || data.code.trim().length === 0) {
    errors.push('Code cannot be empty');
  }

  if (!data.language || !['javascript', 'python', 'java'].includes(data.language)) {
    errors.push('Invalid programming language');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateInterviewCreation,
  validateQuestionData,
  validateCodeSubmission
};
