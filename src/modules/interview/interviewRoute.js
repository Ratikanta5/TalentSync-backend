/**
 * Interview Routes
 * Base path: /api/interviews
 * All routes require authentication (protectRoute middleware applied in server.js)
 */

const express = require('express');
const InterviewController = require('./interviewController');
const { validateInterviewCreation, validateQuestionData } = require('./interviewValidator');

const router = express.Router();
const controller = new InterviewController();

// ================== CREATE & READ ROUTES ==================

/**
 * POST /api/interviews
 * Create a new interview
 */
router.post('/', async (req, res) => {
  try {
    const validation = validateInterviewCreation(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }
    await controller.createInterview(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create interview',
      message: error.message
    });
  }
});

/**
 * GET /api/interviews
 * Get all interviews for the logged-in interviewer (with optional status filter)
 */
router.get('/', async (req, res) => {
  console.log('📖 GET /interviews route handler called');
  try {
    await controller.getInterviews(req, res);
  } catch (error) {
    console.error('Error in GET /interviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interviews',
      message: error.message
    });
  }
});

/**
 * GET /api/interviews/:id
 * Get specific interview details by ID
 */
router.get('/:id', async (req, res) => {
  try {
    await controller.getInterviewById(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interview',
      message: error.message
    });
  }
});

// ================== UPDATE & MANAGE ROUTES ==================

/**
 * PUT /api/interviews/:id
 * Update interview details (before it starts)
 */
router.put('/:id', async (req, res) => {
  try {
    // Validate that only allowed fields are updated
    const allowedFields = ['title', 'description', 'timeLimit', 'settings', 'scheduledFor', 'company', 
                           'videoEnabled', 'chatEnabled', 'collaborativeCodeEnabled', 'autoTimerEnabled'];
    const hasDisallowedFields = Object.keys(req.body).some(key => !allowedFields.includes(key));
    
    if (hasDisallowedFields) {
      return res.status(400).json({
        success: false,
        error: 'Invalid fields provided for update'
      });
    }
    
    await controller.updateInterview(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update interview',
      message: error.message
    });
  }
});

/**
 * POST /api/interviews/:id/start
 * Start an interview (change status from scheduled/draft to active)
 */
router.post('/:id/start', async (req, res) => {
  try {
    await controller.startInterview(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to start interview',
      message: error.message
    });
  }
});

/**
 * POST /api/interviews/:id/end
 * End/Complete an interview
 */
router.post('/:id/end', async (req, res) => {
  try {
    await controller.endInterview(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to end interview',
      message: error.message
    });
  }
});

/**
 * POST /api/interviews/:id/cancel
 * Cancel an interview
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    await controller.cancelInterview(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to cancel interview',
      message: error.message
    });
  }
});

/**
 * POST /api/interviews/:id/reject
 * Reject an interview (status: rejected)
 */
router.post('/:id/reject', async (req, res) => {
  try {
    await controller.rejectInterview(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reject interview',
      message: error.message
    });
  }
});

/**
 * DELETE /api/interviews/:id
 * Delete an interview (only draft or cancelled interviews)
 */
router.delete('/:id', async (req, res) => {
  try {
    await controller.deleteInterview(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete interview',
      message: error.message
    });
  }
});

// ================== CANDIDATE MANAGEMENT ROUTES ==================

/**
 * POST /api/interviews/:id/candidates
 * Add a candidate to the interview
 */
router.post('/:id/candidates', async (req, res) => {
  try {
    await controller.addCandidate(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add candidate',
      message: error.message
    });
  }
});

/**
 * POST /api/interviews/:identifier/join
 * Join an interview (candidate action - accepts sessionId or interview ID)
 */
router.post('/:identifier/join', async (req, res) => {
  try {
    await controller.joinInterview(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to join interview',
      message: error.message
    });
  }
});

/**
 * POST /api/interviews/:identifier/leave
 * Leave an interview (candidate action - accepts sessionId or interview ID)
 */
router.post('/:identifier/leave', async (req, res) => {
  try {
    await controller.leaveInterview(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to leave interview',
      message: error.message
    });
  }
});

// ================== QUESTION MANAGEMENT ROUTES ==================

/**
 * POST /api/interviews/:id/questions
 * Add a question during the interview
 */
router.post('/:id/questions', async (req, res) => {
  try {
    const validation = validateQuestionData(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }
    await controller.addQuestion(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add question',
      message: error.message
    });
  }
});

/**
 * DELETE /api/interviews/:id/questions/:questionId
 * Delete a question from the interview
 */
router.delete('/:id/questions/:questionId', async (req, res) => {
  try {
    await controller.deleteQuestion(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete question',
      message: error.message
    });
  }
});

module.exports = router;
