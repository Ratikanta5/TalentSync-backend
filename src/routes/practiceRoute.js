const express = require('express');
const router = express.Router();
const { protectRoute } = require('../middleware/protectRoute');
const practiceController = require('../controllers/practiceController');

// All routes require authentication
router.use(protectRoute);

// ================== PROBLEM ROUTES ==================

// Get all problems with filters (company, role, difficulty, category, search)
router.get('/', practiceController.getProblems);

// Get single problem by ID
router.get('/problem/:id', practiceController.getProblemById);

// ================== SUBMISSION ROUTES ==================

// Submit code for a problem
router.post('/problem/:id/submit', practiceController.submitCode);

// Get submission history for a problem
router.get('/problem/:id/submissions', practiceController.getSubmissionHistory);

// Get specific submission details
router.get('/submission/:submissionId', practiceController.getSubmissionDetails);

// ================== STATISTICS ROUTES ==================

// Get user statistics
router.get('/user/stats', practiceController.getUserStats);

// Get available filters (companies and roles from actual interviews)
router.get('/filters', practiceController.getAvailableFilters);

// ================== INTERVIEW-BASED PROBLEM ROUTES ==================

// Create a new practice problem from an interview question
router.post('/create-from-interview', practiceController.createProblemFromInterview);

// Get practice problems by company and role (for candidate preparation)
router.get('/company/:company/role/:role', practiceController.getProblemsByCompanyAndRole);

module.exports = router;
