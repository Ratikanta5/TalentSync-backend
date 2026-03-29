/**
 * Problem Controller
 * Handles HTTP requests for problem library operations
 */

const ProblemService = require('./problemService');
const {
  validateProblemCreation,
  validateProblemUpdate,
  validateSubmission,
  validateQueryParams
} = require('./problemValidator');

class ProblemController {
  constructor() {
    this.problemService = new ProblemService();
  }

  /**
   * POST /api/problems
   * Create a new problem (Admin/Interviewer only)
   */
  async createProblem(req, res) {
    try {
      const userId = req.user.id;
      const { title, problemStatement, difficulty, testCases, ...rest } = req.body;

      const validation = validateProblemCreation(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors
        });
      }

      const problem = await this.problemService.createProblem({
        title,
        problemStatement,
        difficulty,
        testCases,
        ...rest,
        createdBy: userId
      });

      return res.status(201).json({
        success: true,
        message: 'Problem created successfully',
        data: problem
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create problem',
        message: error.message
      });
    }
  }

  /**
   * GET /api/problems
   * Get list of problems with filtering and pagination
   */
  async getProblems(req, res) {
    try {
      const { difficulty, company, tags, search, page = 1, limit = 20, sort = 'recent' } = req.query;

      const validation = validateQueryParams(req.query);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: validation.errors
        });
      }

      const filters = {};
      if (difficulty) filters.difficulty = difficulty;
      if (company) filters.company = company;
      if (tags) filters.tags = Array.isArray(tags) ? tags : [tags];
      if (search) filters.search = search;

      const result = await this.problemService.getProblems(filters, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort
      });

      return res.status(200).json({
        success: true,
        data: result.problems,
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
        error: 'Failed to fetch problems',
        message: error.message
      });
    }
  }

  /**
   * GET /api/problems/:id
   * Get specific problem by ID or slug
   */
  async getProblemById(req, res) {
    try {
      const { id } = req.params;

      const problem = await this.problemService.getProblemById(id);

      if (!problem) {
        return res.status(404).json({
          success: false,
          error: 'Problem not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: problem
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch problem',
        message: error.message
      });
    }
  }

  /**
   * PUT /api/problems/:id
   * Update problem (Admin/Creator only)
   */
  async updateProblem(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const validation = validateProblemUpdate(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Check ownership
      const problem = await this.problemService.getProblemById(id);
      if (!problem) {
        return res.status(404).json({
          success: false,
          error: 'Problem not found'
        });
      }

      if (problem.createdBy.toString() !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized to update this problem'
        });
      }

      const updated = await this.problemService.updateProblem(id, req.body);

      return res.status(200).json({
        success: true,
        message: 'Problem updated successfully',
        data: updated
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update problem',
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/problems/:id
   * Delete problem (Admin/Creator only)
   */
  async deleteProblem(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const problem = await this.problemService.getProblemById(id);
      if (!problem) {
        return res.status(404).json({
          success: false,
          error: 'Problem not found'
        });
      }

      if (problem.createdBy.toString() !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized to delete this problem'
        });
      }

      await this.problemService.deleteProblem(id);

      return res.status(200).json({
        success: true,
        message: 'Problem deleted successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to delete problem',
        message: error.message
      });
    }
  }

  /**
   * GET /api/problems/company/:companyId
   * Get problems by company
   */
  async getProblemsByCompany(req, res) {
    try {
      const { companyId } = req.params;
      const { difficulty, page = 1, limit = 20, sort = 'recent' } = req.query;

      const filters = { company: companyId };
      if (difficulty) filters.difficulty = difficulty;

      const result = await this.problemService.getProblemsByCompany(companyId, filters, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort
      });

      return res.status(200).json({
        success: true,
        data: result.problems,
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
        error: 'Failed to fetch company problems',
        message: error.message
      });
    }
  }

  /**
   * GET /api/problems/:id/stats
   * Get problem statistics
   */
  async getProblemStats(req, res) {
    try {
      const { id } = req.params;

      const problem = await this.problemService.getProblemById(id);
      if (!problem) {
        return res.status(404).json({
          success: false,
          error: 'Problem not found'
        });
      }

      const stats = {
        submissionCount: problem.stats.submissionCount,
        acceptedCount: problem.stats.acceptedCount,
        acceptanceRate: problem.stats.acceptanceRate,
        viewCount: problem.viewCount,
        averageTime: problem.stats.averageTime,
        difficulty: problem.difficulty
      };

      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch problem stats',
        message: error.message
      });
    }
  }
}

module.exports = ProblemController;
