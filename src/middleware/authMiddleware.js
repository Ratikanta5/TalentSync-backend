const { requireAuth } = require('@clerk/express');
const User = require('../database/models/User');

/**
 * Middleware to protect routes and verify user is authenticated
 * Loads user data from database
 */
const protectRoute = [
  requireAuth(), // Check if user is logged in with Clerk
  
  async (req, res, next) => {
    try {
      const clerkId = req.auth().userId;
      if (!clerkId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid token'
        });
      }

      // Find user in database by clerkId
      const user = await User.findOne({ clerkId });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (err) {
      console.error('Error in protectRoute middleware:', err);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
];

/**
 * Middleware to require onboarding completion
 * User must have selected a role
 */
const requireOnboarding = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Check if user has completed onboarding (has a valid role)
    const validRoles = ['candidate', 'interviewer', 'admin'];
    if (!req.user.role || !validRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Onboarding not completed. Please select a role.'
      });
    }

    next();
  } catch (error) {
    console.error('Error in requireOnboarding middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Middleware to check user role
 * Usage: requireRole('candidate', 'interviewer')
 */
const requireRole = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.user.role}`
        });
      }

      next();
    } catch (error) {
      console.error('Error in requireRole middleware:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};

/**
 * Middleware to check admin access
 */
const requireAdmin = requireRole('admin');

/**
 * Middleware to check interviewer access
 */
const requireInterviewer = requireRole('interviewer');

/**
 * Middleware to check candidate access
 */
const requireCandidate = requireRole('candidate');

module.exports = {
  protectRoute,
  requireOnboarding,
  requireRole,
  requireAdmin,
  requireInterviewer,
  requireCandidate
};
