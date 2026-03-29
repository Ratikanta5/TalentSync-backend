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
      console.log('🔐 protectRoute middleware - Checking auth...');
      
      // Get userId from Clerk auth object
      // Clerk Express provides req.auth which is an object (not a function)
      let userId;
      
      if (req.auth && typeof req.auth === 'object' && req.auth.userId) {
        userId = req.auth.userId;
        console.log('✅ Got userId from req.auth.userId:', userId);
      } else if (typeof req.auth === 'function') {
        const auth = req.auth();
        userId = auth?.userId;
        console.log('✅ Got userId from req.auth() call:', userId);
      } else {
        console.log('❌ req.auth structure:', req.auth);
        console.log('❌ Available keys on req:', Object.keys(req).filter(k => !k.includes('app')).slice(0, 20));
      }
      
      if (!userId) {
        console.error('❌ No clerkId/userId found in auth. req.auth:', req.auth);
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: No auth token'
        });
      }

      console.log(`✅ Found clerkId: ${userId}`);
      
      // Find user in database by clerkId
      const user = await User.findOne({ clerkId: userId });

      if (!user) {
        console.log(`❌ User not found for clerkId: ${userId}`);
        console.log(`   Available users with clerkId:`, await User.find({ clerkId: { $exists: true } }).select('clerkId name').limit(3));
        return res.status(404).json({
          success: false,
          error: 'User not found. Please complete onboarding.'
        });
      }

      console.log(`✅ Found user in DB: ${user._id}, name: ${user.name}`);
      
      // Attach user to request with both _id and clerkId
      req.user = {
        _id: user._id,
        clerkId: user.clerkId,
        name: user.name,
        email: user.email,
        profileImage: user.avatar,
        avatar: user.avatar,
        role: user.role
      };
      
      console.log('✅ User attached to request:', { clerkId: req.user.clerkId, name: req.user.name });
      next();
    } catch (err) {
      console.error('❌ Error in protectRoute middleware:', err.message);
      console.error('   Stack:', err.stack);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
];

module.exports.protectRoute = protectRoute;
