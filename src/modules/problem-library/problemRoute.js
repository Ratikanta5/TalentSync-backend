/**
 * Problem and Submission routes
 * Base paths: /api/problems, /api/submissions
 */

const express = require('express');
const ProblemController = require('./problemController');
const SubmissionController = require('./submissionController');
const { validateProblemCreation, validateProblemUpdate, validateSubmission } = require('./problemValidator');

const router = express.Router();
const problemController = new ProblemController();
const submissionController = new SubmissionController();

// ==================== PROBLEM ROUTES ====================

/**
 * POST /api/problems
 * Create a new problem (Admin/Interviewer only)
 */
router.post('/', async (req, res) => {
  try {
    await problemController.createProblem(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create problem',
      message: error.message
    });
  }
});

/**
 * GET /api/problems
 * Get list of problems with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    await problemController.getProblems(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch problems',
      message: error.message
    });
  }
});

/**
 * GET /api/problems/company/:companyId
 * Get problems by company
 * NOTE: This must come before :id route to avoid conflict
 */
router.get('/company/:companyId', async (req, res) => {
  try {
    await problemController.getProblemsByCompany(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company problems',
      message: error.message
    });
  }
});

/**
 * GET /api/problems/:id
 * Get specific problem by ID or slug
 */
router.get('/:id', async (req, res) => {
  try {
    await problemController.getProblemById(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch problem',
      message: error.message
    });
  }
});

/**
 * GET /api/problems/:id/stats
 * Get problem statistics
 */
router.get('/:id/stats', async (req, res) => {
  try {
    await problemController.getProblemStats(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch problem stats',
      message: error.message
    });
  }
});

/**
 * PUT /api/problems/:id
 * Update problem (Admin/Creator only)
 */
router.put('/:id', async (req, res) => {
  try {
    const validation = validateProblemUpdate(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }
    await problemController.updateProblem(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update problem',
      message: error.message
    });
  }
});

/**
 * DELETE /api/problems/:id
 * Delete problem (Admin/Creator only)
 */
router.delete('/:id', async (req, res) => {
  try {
    await problemController.deleteProblem(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete problem',
      message: error.message
    });
  }
});

// ==================== SUBMISSION ROUTES ====================

/**
 * POST /api/submissions
 * Submit code for a practice problem
 */
router.post('/submit', async (req, res) => {
  try {
    const validation = validateSubmission(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }
    await submissionController.submitProblem(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to submit problem',
      message: error.message
    });
  }
});

/**
 * GET /api/submissions
 * Get user's submissions
 */
router.get('/my-submissions', async (req, res) => {
  try {
    await submissionController.getUserSubmissions(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch submissions',
      message: error.message
    });
  }
});

/**
 * GET /api/submissions/stats
 * Get user's submission statistics
 */
router.get('/stats/overview', async (req, res) => {
  try {
    await submissionController.getUserStats(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/submissions/stats/difficulty
 * Get statistics broken down by difficulty level
 */
router.get('/stats/difficulty', async (req, res) => {
  try {
    await submissionController.getUserStatsByDifficulty(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch difficulty statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/submissions/problem/:problemId
 * Get user's submissions for a specific problem
 */
router.get('/problem/:problemId', async (req, res) => {
  try {
    await submissionController.getSubmissionsByProblem(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch submissions',
      message: error.message
    });
  }
});

/**
 * GET /api/submissions/:submissionId
 * Get specific submission details
 */
router.get('/:submissionId', async (req, res) => {
  try {
    await submissionController.getSubmissionById(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch submission',
      message: error.message
    });
  }
});

module.exports = router;
