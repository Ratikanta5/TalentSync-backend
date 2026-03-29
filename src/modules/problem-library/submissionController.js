/**
 * Submission Controller
 * Handles HTTP requests for code submission tracking
 */

const ProblemService = require('./problemService');
const { validateSubmission } = require('./problemValidator');

class SubmissionController {
  constructor() {
    this.problemService = new ProblemService();
  }

  /**
   * POST /api/submissions
   * Submit code for a practice problem
   */
  async submitProblem(req, res) {
    try {
      const userId = req.user.id;
      const { problemId, code, language, testResults } = req.body;

      const validation = validateSubmission(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors
        });
      }

      const submission = await this.problemService.submitProblem(userId, problemId, {
        code,
        language,
        status: testResults?.status || 'pending',
        testResults: testResults || { totalTests: 0, passedTests: 0, failedTests: 0, details: [] },
        executionTime: testResults?.executionTime || 0,
        memory: testResults?.memory || 0
      });

      return res.status(201).json({
        success: true,
        message: 'Submission recorded successfully',
        data: submission
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to submit problem',
        message: error.message
      });
    }
  }

  /**
   * GET /api/submissions
   * Get user's submissions (all or filtered by problem)
   */
  async getUserSubmissions(req, res) {
    try {
      const userId = req.user.id;
      const { problemId, status, page = 1, limit = 20, sort = 'recent' } = req.query;

      const filters = {};
      if (problemId) filters.problemId = problemId;
      if (status) filters.status = status;

      const result = await this.problemService.getUserSubmissions(userId, filters, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort
      });

      return res.status(200).json({
        success: true,
        data: result.submissions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.total,
          pages: Math.ceil(result.total / limit)
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch submissions',
        message: error.message
      });
    }
  }

  /**
   * GET /api/submissions/:submissionId
   * Get specific submission details
   */
  async getSubmissionById(req, res) {
    try {
      const { submissionId } = req.params;
      const userId = req.user.id;

      // Import ProblemSubmission model
      const ProblemSubmission = require('../../database/models/ProblemSubmission');
      const submission = await ProblemSubmission.findById(submissionId).populate('problem').populate('user', 'name email');

      if (!submission) {
        return res.status(404).json({
          success: false,
          error: 'Submission not found'
        });
      }

      // Check ownership
      if (submission.user._id.toString() !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized to view this submission'
        });
      }

      return res.status(200).json({
        success: true,
        data: submission
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch submission',
        message: error.message
      });
    }
  }

  /**
   * GET /api/submissions/problem/:problemId
   * Get user's submissions for a specific problem
   */
  async getSubmissionsByProblem(req, res) {
    try {
      const userId = req.user.id;
      const { problemId } = req.params;

      const result = await this.problemService.getUserSubmissions(userId, { problemId }, {
        page: 1,
        limit: 100,
        sort: 'recent'
      });

      return res.status(200).json({
        success: true,
        data: result.submissions
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch submissions for problem',
        message: error.message
      });
    }
  }

  /**
   * GET /api/submissions/stats
   * Get user's submission statistics
   */
  async getUserStats(req, res) {
    try {
      const userId = req.user.id;

      const stats = await this.problemService.getUserProblemStats(userId);

      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user statistics',
        message: error.message
      });
    }
  }

  /**
   * GET /api/submissions/stats/difficulty
   * Get statistics broken down by difficulty level
   */
  async getUserStatsByDifficulty(req, res) {
    try {
      const userId = req.user.id;
      
      // Import ProblemSubmission model
      const ProblemSubmission = require('../../database/models/ProblemSubmission');
      const Problem = require('../../database/models/Problem');

      const submissions = await ProblemSubmission.find({ user: userId }).populate('problem');

      const stats = {
        easy: { total: 0, accepted: 0, acceptanceRate: 0 },
        medium: { total: 0, accepted: 0, acceptanceRate: 0 },
        hard: { total: 0, accepted: 0, acceptanceRate: 0 }
      };

      for (const submission of submissions) {
        const difficulty = submission.problem.difficulty;
        stats[difficulty].total++;
        if (submission.status === 'accepted') {
          stats[difficulty].accepted++;
        }
      }

      // Calculate acceptance rates
      for (const level of ['easy', 'medium', 'hard']) {
        if (stats[level].total > 0) {
          stats[level].acceptanceRate = Math.round((stats[level].accepted / stats[level].total) * 100);
        }
      }

      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch difficulty statistics',
        message: error.message
      });
    }
  }
}

module.exports = SubmissionController;
