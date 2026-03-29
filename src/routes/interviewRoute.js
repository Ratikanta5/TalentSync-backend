const express = require('express');
const router = express.Router();
const { protectRoute } = require('../middleware/authMiddleware');
const interviewController = require('../controllers/interviewController');

// ================== MIDDLEWARE ==================
router.use(protectRoute); // All routes require authentication

// ================== CREATE & READ ROUTES ==================

// Create a new interview
router.post('/', interviewController.createInterview);

// Get all interviews for the logged-in interviewer (with filters)
router.get('/', interviewController.getInterviews);

// Get a specific interview by ID
router.get('/:id', interviewController.getInterviewById);

// ================== UPDATE & MANAGE ROUTES ==================

// Update interview details (before it starts)
router.put('/:id', interviewController.updateInterview);

// Start interview (change status to active)
router.post('/:id/start', interviewController.startInterview);

// End/Complete interview
router.post('/:id/end', interviewController.endInterview);

// Cancel interview
router.post('/:id/cancel', interviewController.cancelInterview);

// Reject interview
router.post('/:id/reject', interviewController.rejectInterview);

// Delete interview (only draft or cancelled)
router.delete('/:id', interviewController.deleteInterview);

// ================== CANDIDATE MANAGEMENT ROUTES ==================

// Add candidate to interview
router.post('/:id/candidates', interviewController.addCandidate);

// Join interview (candidate action)
router.post('/:sessionId/join', interviewController.joinInterview);

// Leave interview (candidate action)
router.post('/:sessionId/leave', interviewController.leaveInterview);

module.exports = router;
