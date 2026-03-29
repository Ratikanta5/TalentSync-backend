/**
 * User Controller
 * Handles HTTP requests for user profile and statistics
 */

const User = require('../../database/models/User');

class UserController {
  /**
   * GET /api/users/profile
   * Get current user's profile
   */
  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId)
        .select('-password')
        .populate('company');

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch profile',
        message: error.message
      });
    }
  }

  /**
   * PUT /api/users/profile
   * Update current user's profile
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { name, bio, skills, experience, preferredLanguages, availableForInterview, notificationPreferences } = req.body;

      // Validate input
      if (name && name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Name cannot be empty'
        });
      }

      if (experience !== undefined && (experience < 0 || experience > 60)) {
        return res.status(400).json({
          success: false,
          error: 'Experience must be between 0 and 60 years'
        });
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (bio !== undefined) updateData.bio = bio;
      if (skills !== undefined) updateData.skills = Array.isArray(skills) ? skills : [];
      if (experience !== undefined) updateData.experience = experience;
      if (preferredLanguages !== undefined) updateData.preferredLanguages = Array.isArray(preferredLanguages) ? preferredLanguages : [];
      if (availableForInterview !== undefined) updateData.availableForInterview = availableForInterview;
      if (notificationPreferences !== undefined) updateData.notificationPreferences = notificationPreferences;

      const user = await User.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true })
        .select('-password');

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: user
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update profile',
        message: error.message
      });
    }
  }

  /**
   * GET /api/users/:userId/profile
   * Get specific user's profile (public view)
   */
  async getUserProfile(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId)
        .select('name email role company bio skills experience ratings stats availableForInterview createdAt')
        .populate('company');

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user profile',
        message: error.message
      });
    }
  }

  /**
   * GET /api/users/:userId/stats
   * Get user's statistics
   */
  async getUserStats(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select('stats ratings role');

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const stats = {
        role: user.role,
        stats: user.stats,
        ratings: user.ratings
      };

      // Add role-specific stats
      if (user.role === 'interviewer') {
        stats.interviewerStats = {
          interviewsConducted: user.stats.interviewsConducted,
          candidatesInterviewed: user.stats.candidatesInterviewed,
          averageRating: user.ratings.interviewerRating
        };
      } else if (user.role === 'candidate') {
        stats.candidateStats = {
          interviewsParticipated: user.stats.interviewsParticipated,
          problemsSolved: user.stats.problemsSolved,
          acceptanceRate: user.stats.acceptanceRate,
          averageRating: user.ratings.candidateRating
        };
      }

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
   * GET /api/users/leaderboard
   * Get top users by various metrics
   */
  async getLeaderboard(req, res) {
    try {
      const { metric = 'acceptanceRate', limit = 20 } = req.query;

      let sortQuery = {};
      let selectQuery = 'name email stats ratings role company';

      switch (metric) {
        case 'acceptanceRate':
          sortQuery = { 'stats.acceptanceRate': -1 };
          break;
        case 'problemsSolved':
          sortQuery = { 'stats.problemsSolved': -1 };
          break;
        case 'interviewsConducted':
          sortQuery = { 'stats.interviewsConducted': -1 };
          break;
        case 'rating':
          sortQuery = { 'ratings.interviewerRating': -1 };
          break;
        default:
          sortQuery = { 'stats.acceptanceRate': -1 };
      }

      const users = await User.find({ role: 'candidate' })
        .select(selectQuery)
        .sort(sortQuery)
        .limit(parseInt(limit))
        .populate('company');

      return res.status(200).json({
        success: true,
        data: users,
        metric,
        count: users.length
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch leaderboard',
        message: error.message
      });
    }
  }

  /**
   * GET /api/users/interviewers
   * Get list of available interviewers
   */
  async getAvailableInterviewers(req, res) {
    try {
      const { company, limit = 20, page = 1 } = req.query;

      const filter = {
        role: 'interviewer',
        availableForInterview: true
      };

      if (company) {
        filter.company = company;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const interviewers = await User.find(filter)
        .select('name email bio skills ratings company stats')
        .populate('company')
        .skip(skip)
        .limit(parseInt(limit));

      const total = await User.countDocuments(filter);

      return res.status(200).json({
        success: true,
        data: interviewers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch interviewers',
        message: error.message
      });
    }
  }

  /**
   * POST /api/users/availability
   * Update interviewer availability
   */
  async updateAvailability(req, res) {
    try {
      const userId = req.user.id;
      const { availableForInterview, timeSlots } = req.body;

      if (req.user.role !== 'interviewer') {
        return res.status(403).json({
          success: false,
          error: 'Only interviewers can update availability'
        });
      }

      const updateData = {
        availableForInterview
      };

      if (timeSlots !== undefined) {
        updateData.timeSlots = timeSlots;
      }

      const user = await User.findByIdAndUpdate(userId, updateData, { new: true });

      return res.status(200).json({
        success: true,
        message: 'Availability updated successfully',
        data: user
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update availability',
        message: error.message
      });
    }
  }

  /**
   * POST /api/users/onboard
   * Complete user onboarding with role selection
   */
  async onboard(req, res) {
    try {
      console.log('🎯 Onboarding request received');
      console.log('📋 Request body:', req.body);
      
      const { clerkId, email, name, role, companyName, avatar } = req.body;

      // Validate required fields
      if (!clerkId || !email || !name || !role) {
        console.log('❌ Missing required fields');
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: clerkId, email, name, role'
        });
      }

      // Validate role
      const validRoles = ['candidate', 'interviewer', 'admin'];
      if (!validRoles.includes(role)) {
        console.log('❌ Invalid role:', role);
        return res.status(400).json({
          success: false,
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
      }

      // Check if user already exists
      console.log(`🔍 Checking if user exists with clerkId: ${clerkId}`);
      let user = await User.findOne({ clerkId });

      if (user) {
        console.log('✅ User found, updating...');
        // Update existing user with role if not already set
        if (!user.role || user.role === 'candidate') {
          user.role = role;
          user.companyName = companyName || user.companyName;
          await user.save();
          console.log('✅ User updated successfully');
        }
      } else {
        console.log('📝 Creating new user...');
        // Create new user
        const userData = {
          clerkId,
          email,
          name,
          role,
          avatar: avatar || null,
          companyName: companyName || null,
          // Initialize stats
          stats: {
            interviewsConducted: 0,
            candidatesInterviewed: 0,
            interviewsAttempted: 0,
            problemsSolved: 0,
            acceptanceRate: 0,
            averageRating: 5
          }
        };

        console.log('📦 User data to create:', userData);
        user = await User.create(userData);
        console.log('✅ User created successfully:', user._id);
      }

      console.log('🎉 Onboarding successful');
      return res.status(201).json({
        success: true,
        message: 'Onboarding completed successfully',
        data: {
          user: {
            id: user._id,
            clerkId: user.clerkId,
            email: user.email,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
            companyName: user.companyName
          }
        }
      });
    } catch (error) {
      console.error('❌ Onboarding error:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        name: error.name,
        validationErrors: error.errors
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to complete onboarding',
        message: error.message,
        details: error.errors ? Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`) : undefined
      });
    }
  }

  /**
   * GET /api/users/:clerkId/onboarding-status
   * Check if user has completed onboarding
   */
  async getOnboardingStatus(req, res) {
    try {
      const { clerkId } = req.params;

      const user = await User.findOne({ clerkId })
        .select('_id clerkId email name role companyName avatar stats');

      if (!user) {
        return res.status(200).json({
          success: true,
          data: {
            isComplete: false,
            user: null
          }
        });
      }

      // Onboarding is complete if user has a valid role
      const isComplete = user.role && ['candidate', 'interviewer', 'admin'].includes(user.role);

      return res.status(200).json({
        success: true,
        data: {
          isComplete,
          user: {
            id: user._id,
            clerkId: user.clerkId,
            email: user.email,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
            companyName: user.companyName
          }
        }
      });
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to check onboarding status',
        message: error.message
      });
    }
  }
}

module.exports = UserController;
