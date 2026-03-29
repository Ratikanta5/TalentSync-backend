/**
 * Test Case Runner Service
 * Orchestrates code execution against test cases and result persistence
 */

const CodeExecutor = require('./codeExecutor');
const Interview = require('../database/models/Interview');
const ProblemSubmission = require('../database/models/ProblemSubmission');
const Problem = require('../database/models/Problem');

class TestCaseRunner {
  constructor() {
    this.codeExecutor = new CodeExecutor();
  }

  /**
   * Run test cases for interview submission
   * @param {String} code - User code
   * @param {String} language - Programming language
   * @param {String} interviewId - Interview ID
   * @param {String} questionId - Question ID
   * @param {String} userId - User ID
   * @returns {Object} Test results with submission record
   */
  async runInterviewTestCases(code, language, interviewId, questionId, userId) {
    try {
      // Fetch interview and question
      const interview = await Interview.findById(interviewId);
      if (!interview) {
        throw new Error('Interview not found');
      }

      // Find the question in interview
      const question = interview.questions.id(questionId);
      if (!question) {
        throw new Error('Question not found in interview');
      }

      // Validate code format
      const validation = this.codeExecutor.validateCodeFormat(code, language);
      if (!validation.valid) {
        return {
          success: false,
          status: 'validation_error',
          errors: validation.errors
        };
      }

      // Run test cases
      const testResults = await this.codeExecutor.testCode(
        code,
        language,
        question.testCases,
        10000 // 10 second timeout for interview
      );

      // Record submission in interview
      const submission = {
        userId,
        code,
        language,
        status: testResults.overallStatus,
        testResults: {
          totalTests: testResults.totalTests,
          passedTests: testResults.passedTests,
          failedTests: testResults.failedTests,
          details: testResults.details
        },
        executionTime: testResults.executionTime,
        memory: testResults.memory,
        submittedAt: new Date()
      };

      // Add submission to question
      if (!question.submissions) {
        question.submissions = [];
      }
      question.submissions.push(submission);

      // Update interview
      await interview.save();

      return {
        success: true,
        status: testResults.overallStatus,
        testResults,
        submissionId: question.submissions[question.submissions.length - 1]._id
      };
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Run test cases for practice problem submission
   * @param {String} code - User code
   * @param {String} language - Programming language
   * @param {String} problemId - Problem ID
   * @param {String} userId - User ID
   * @returns {Object} Test results with submission record
   */
  async runProblemTestCases(code, language, problemId, userId) {
    try {
      // Fetch problem
      const problem = await Problem.findById(problemId);
      if (!problem) {
        throw new Error('Problem not found');
      }

      // Validate code format
      const validation = this.codeExecutor.validateCodeFormat(code, language);
      if (!validation.valid) {
        return {
          success: false,
          status: 'validation_error',
          errors: validation.errors
        };
      }

      // Run test cases
      const testResults = await this.codeExecutor.testCode(
        code,
        language,
        problem.testCases,
        5000 // 5 second timeout for practice
      );

      // Create submission record
      const submission = new ProblemSubmission({
        user: userId,
        problem: problemId,
        code,
        language,
        status: testResults.overallStatus === 'accepted' ? 'accepted' : 
                testResults.overallStatus === 'wrong_answer' ? 'wrong_answer' :
                'runtime_error',
        testResults: {
          totalTests: testResults.totalTests,
          passedTests: testResults.passedTests,
          failedTests: testResults.failedTests,
          details: testResults.details
        },
        executionTime: testResults.executionTime,
        memory: testResults.memory
      });

      await submission.save();

      // Update problem statistics
      await this._updateProblemStats(problemId, userId, testResults.overallStatus === 'accepted');

      // Check if best submission
      const userSubmissions = await ProblemSubmission.find({
        user: userId,
        problem: problemId
      }).sort({ submittedAt: -1 });

      const isBestSubmission = userSubmissions[0]._id.toString() === submission._id.toString();
      submission.isBestSubmission = isBestSubmission;
      await submission.save();

      return {
        success: true,
        status: testResults.overallStatus,
        testResults,
        submissionId: submission._id,
        isBestSubmission
      };
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Update problem statistics after submission
   * @private
   */
  async _updateProblemStats(problemId, userId, accepted) {
    try {
      const problem = await Problem.findById(problemId);
      if (!problem) return;

      // Increment submission count
      problem.stats.submissionCount++;

      // Increment accepted count
      if (accepted) {
        problem.stats.acceptedCount++;
      }

      // Calculate acceptance rate
      problem.stats.acceptanceRate = Math.round(
        (problem.stats.acceptedCount / problem.stats.submissionCount) * 100
      );

      await problem.save();

      // Update user stats
      await this._updateUserStats(userId, accepted);
    } catch (error) {
      console.error('Error updating problem stats:', error);
    }
  }

  /**
   * Update user statistics
   * @private
   */
  async _updateUserStats(userId, accepted) {
    try {
      const User = require('../database/models/User');
      const user = await User.findById(userId);
      if (!user) return;

      if (accepted) {
        user.stats.problemsSolved++;

        // Calculate acceptance rate
        const totalSubmissions = await ProblemSubmission.countDocuments({ user: userId });
        const acceptedSubmissions = await ProblemSubmission.countDocuments({
          user: userId,
          status: 'accepted'
        });

        user.stats.acceptanceRate = Math.round((acceptedSubmissions / totalSubmissions) * 100);
      }

      await user.save();
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  }

  /**
   * Check code for common issues
   * @param {String} code - User code
   * @param {String} language - Programming language
   * @returns {Object} Analysis result
   */
  analyzeCode(code, language) {
    const analysis = {
      codeLength: code.length,
      lines: code.split('\n').length,
      hasComments: this._hasComments(code, language),
      hasMainFunction: this._hasMainFunction(code, language),
      complexity: this._estimateComplexity(code),
      issues: []
    };

    // Check for common issues
    if (code.length > 50000) {
      analysis.issues.push('Code is very long (>50KB)');
    }

    if (!analysis.hasMainFunction) {
      analysis.issues.push('No main function or entry point found');
    }

    return analysis;
  }

  /**
   * Estimate code complexity (basic)
   * @private
   */
  _estimateComplexity(code) {
    const loops = (code.match(/for|while|foreach/gi) || []).length;
    const conditions = (code.match(/if|else|switch/gi) || []).length;
    const recursion = (code.match(/\bthis\./g) || []).length > 0; // Rough indicator

    if (loops > 3 || conditions > 5) return 'high';
    if (loops > 1 || conditions > 2) return 'medium';
    return 'low';
  }

  /**
   * Check if code has comments
   * @private
   */
  _hasComments(code, language) {
    if (language === 'javascript') {
      return /\/\/|\/\*|*\//.test(code);
    } else if (language === 'python') {
      return /#/.test(code);
    } else if (language === 'java') {
      return /\/\/|\/\*|*\//.test(code);
    }
    return false;
  }

  /**
   * Check if code has main function
   * @private
   */
  _hasMainFunction(code, language) {
    if (language === 'javascript') {
      return /function\s+\w+|const\s+\w+\s*=.*function|=>\s*{/.test(code);
    } else if (language === 'python') {
      return /^def\s+\w+|if\s+__name__\s*==\s*['"]__main__['"]:/.test(code);
    } else if (language === 'java') {
      return /public\s+static\s+void\s+main/.test(code);
    }
    return true; // Assume valid for unknown language
  }

  /**
   * Get execution stats summary
   * @param {String} userId - User ID
   * @returns {Object} User's execution statistics
   */
  async getUserExecutionStats(userId) {
    try {
      const submissions = await ProblemSubmission.find({ user: userId });

      const stats = {
        totalSubmissions: submissions.length,
        acceptedSubmissions: submissions.filter(s => s.status === 'accepted').length,
        wrongAnswerCount: submissions.filter(s => s.status === 'wrong_answer').length,
        runtimeErrorCount: submissions.filter(s => s.status === 'runtime_error').length,
        averageExecutionTime: this._calculateAverage(
          submissions.map(s => s.executionTime)
        ),
        languages: [...new Set(submissions.map(s => s.language))],
        submissionsByDay: this._getSubmissionsByDay(submissions)
      };

      return stats;
    } catch (error) {
      console.error('Error getting execution stats:', error);
      return null;
    }
  }

  /**
   * Calculate average
   * @private
   */
  _calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((a, b) => a + b, 0);
    return Math.round(sum / numbers.length);
  }

  /**
   * Group submissions by day
   * @private
   */
  _getSubmissionsByDay(submissions) {
    const byDay = {};
    submissions.forEach(sub => {
      const day = sub.submittedAt.toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
    });
    return byDay;
  }
}

module.exports = TestCaseRunner;
