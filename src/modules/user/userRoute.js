/**
 * User routes
 * Base path: /api/users
 */

const express = require('express');
const UserController = require('./userController');
const { protectRoute, requireOnboarding, requireRole } = require('../../middleware/authMiddleware');

const router = express.Router();
const controller = new UserController();

/**
 * POST /api/users/onboard
 * Complete user onboarding with role selection
 * Public endpoint (no auth required)
 */
router.post('/onboard', async (req, res) => {
  try {
    console.log('🌐 POST /api/users/onboard received');
    console.log('📨 Headers:', { 'content-type': req.headers['content-type'] });
    await controller.onboard(req, res);
  } catch (error) {
    console.error('❌ Route handler error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete onboarding',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/users/:clerkId/onboarding-status
 * Check if user has completed onboarding
 * Public endpoint (no auth required)
 */
router.get('/:clerkId/onboarding-status', async (req, res) => {
  try {
    await controller.getOnboardingStatus(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check onboarding status',
      message: error.message
    });
  }
});

/**
 * Protected routes below - require authentication and onboarding
 */
router.use(protectRoute);
router.use(requireOnboarding);

/**
 * GET /api/users/profile
 * Get current user's profile
 */
router.get('/profile', async (req, res) => {
  try {
    await controller.getProfile(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
      message: error.message
    });
  }
});

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
router.put('/profile', async (req, res) => {
  try {
    await controller.updateProfile(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      message: error.message
    });
  }
});

/**
 * GET /api/users/leaderboard
 * Get top users by various metrics
 */
router.get('/leaderboard', async (req, res) => {
  try {
    await controller.getLeaderboard(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard',
      message: error.message
    });
  }
});

/**
 * GET /api/users/interviewers
 * Get list of available interviewers
 */
router.get('/interviewers', async (req, res) => {
  try {
    await controller.getAvailableInterviewers(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interviewers',
      message: error.message
    });
  }
});

/**
 * POST /api/users/availability
 * Update interviewer availability
 */
router.post('/availability', requireRole('interviewer'), async (req, res) => {
  try {
    await controller.updateAvailability(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update availability',
      message: error.message
    });
  }
});

/**
 * POST /api/users/onboard
 * Complete user onboarding with role selection
 */
router.post('/onboard', async (req, res) => {
  try {
    await controller.onboard(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to complete onboarding',
      message: error.message
    });
  }
});

/**
 * GET /api/users/:clerkId/onboarding-status
 * Check if user has completed onboarding
 */
router.get('/:clerkId/onboarding-status', async (req, res) => {
  try {
    await controller.getOnboardingStatus(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check onboarding status',
      message: error.message
    });
  }
});

/**
 * GET /api/users/:userId/profile
 * Get specific user's profile (public view)
 */
router.get('/:userId/profile', async (req, res) => {
  try {
    await controller.getUserProfile(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
      message: error.message
    });
  }
});

/**
 * GET /api/users/:userId/stats
 * Get user's statistics
 */
router.get('/:userId/stats', async (req, res) => {
  try {
    await controller.getUserStats(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user statistics',
      message: error.message
    });
  }
});

module.exports = router;
