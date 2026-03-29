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

  if (!data.summary || data.summary.trim().length === 0) {
    errors.push('Question summary is required');
  }

  if (!data.level || !['easy', 'medium', 'hard'].includes(data.level)) {
    errors.push('Invalid level');
  }

  if (!data.problemStatement || data.problemStatement.trim().length === 0) {
    errors.push('Full problem statement is required');
  }

  const timerValue = Number(data.timer);
  if (!Number.isFinite(timerValue) || timerValue < 1 || timerValue > 180) {
    errors.push('Timer must be between 1 and 180 minutes');
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

  if (!data.language || !['javascript', 'python', 'python3', 'java', 'cpp', 'c++'].includes(data.language)) {
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
