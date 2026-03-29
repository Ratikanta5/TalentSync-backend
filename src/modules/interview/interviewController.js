const InterviewService = require('./interviewService');
const { validateInterviewCreation, validateQuestionData } = require('./interviewValidator');
const codeExecutor = require('../../services/codeExecutor');

function withViewerRole(interview, currentUserId) {
  if (!interview) return interview;

  const raw = typeof interview.toObject === 'function' ? interview.toObject() : interview;
  const interviewerId =
    raw?.interviewer?._id?.toString?.() ||
    raw?.interviewer?.toString?.() ||
    null;

  return {
    ...raw,
    viewerRole: interviewerId === currentUserId.toString() ? 'interviewer' : 'candidate'
  };
}

class InterviewController {
  constructor() {
    this.interviewService = new InterviewService();
  }

  /**
   * POST /api/interviews
   * Create a new interview session
   */
  async createInterview(req, res) {
    try {
      const userId = req.user._id;
      const { 
        title, 
        description, 
        timeLimit, 
        videoEnabled, 
        chatEnabled, 
        collaborativeCodeEnabled,
        autoTimerEnabled,
        scheduledFor
      } = req.body;

      // Validate input
      const validation = validateInterviewCreation({ title, description });
      if (!validation.valid) {
        return res.status(400).json({ 
          success: false,
          error: validation.errors 
        });
      }

      const interview = await this.interviewService.createInterview(
        {
          title,
          description,
          timeLimit,
          videoEnabled,
          chatEnabled,
          collaborativeCodeEnabled,
          autoTimerEnabled,
          scheduledFor
        },
        userId
      );

      res.status(201).json({
        success: true,
        message: 'Interview created successfully',
        data: interview
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/interviews
   * Get user's interviews
   */
  async getInterviews(req, res) {
    try {
      const userId = req.user._id;
      const role = req.user.role;
      const { status, level, limit, skip } = req.query;

      console.log(`📖 Fetching interviews for user ${userId} (role: ${role})`);

      const interviews = await this.interviewService.getUserInterviews(userId, role, {
        status,
        level,
        limit: parseInt(limit) || 20,
        skip: parseInt(skip) || 0
      });

      console.log(`✓ Found ${interviews.length} interviews`);

      res.status(200).json({
        success: true,
        data: interviews,
        count: interviews.length
      });
    } catch (error) {
      console.error('✗ Error in getInterviews:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/interviews/:id
   * Get interview by ID or sessionId
   * Supports both interview._id and interview.sessionId
   */
  async getInterviewById(req, res) {
    try {
      const { id } = req.params;

      let interview;
      try {
        // Try to fetch by interview ID first
        interview = await this.interviewService.getInterviewById(id, 'id');
      } catch (error) {
        // If not found by ID, try sessionId
        try {
          interview = await this.interviewService.getInterviewById(id, 'sessionId');
        } catch (fallbackError) {
          throw new Error('Interview not found');
        }
      }

      res.status(200).json({
        success: true,
        data: withViewerRole(interview, req.user._id)
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/interviews/:id/questions
   * Add question to interview
   */
  async addQuestion(req, res) {
    try {
      const { id } = req.params;
      const questionData = req.body;

      // Validate question data
      const validation = validateQuestionData(questionData);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.errors });
      }

      const interview = await this.interviewService.addQuestion(id, questionData);

      res.status(200).json({
        success: true,
        message: 'Question added successfully',
        data: withViewerRole(interview, req.user._id)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/interviews/:id/start
   * Start interview session
   */
  async startInterview(req, res) {
    try {
      const { id } = req.params;
      const clerkId = req.user.clerkId;
      const userName = req.user.name;
      const userImage = req.user.profileImage;
      const userRole = req.user.role;

      const interview = await this.interviewService.startInterview(id, clerkId, userName, userImage, userRole);

      res.status(200).json({
        success: true,
        message: 'Interview started successfully',
        data: withViewerRole(interview, req.user._id)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/interviews/join/:meetingLink
   * Join interview by meeting link
   */
  async joinInterview(req, res) {
    try {
      const { meetingLink } = req.params;
      const userId = req.user._id;

      const interview = await this.interviewService.joinInterview(meetingLink, userId);

      res.status(200).json({
        success: true,
        message: 'Joined interview successfully',
        data: interview
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/interviews/:id/submit-code
   * Submit code for question (DEPRECATED - out of scope)
   */
  async submitCode(req, res) {
    try {
      return res.status(501).json({
        success: false,
        error: 'Code submission is out of scope for this interview platform'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/interviews/execute-code
   * Execute code in the selected language
   */
  async executeCode(req, res) {
    try {
      const { code, language, input, timeLimit } = req.body;

      if (!code || !code.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Code cannot be empty'
        });
      }

      if (!language) {
        return res.status(400).json({
          success: false,
          error: 'Language is required'
        });
      }

      const result = await codeExecutor.executeCode(
        code,
        language,
        input || '',
        timeLimit
      );

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to execute code'
      });
    }
  }

  /**
   * GET /api/interviews/code-runtime-health
   * Check whether code execution backend is reachable
   */
  async getCodeRuntimeHealth(req, res) {
    try {
      const healthy = await codeExecutor.healthCheck();

      return res.status(200).json({
        success: true,
        data: {
          healthy,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to check code runtime health',
      });
    }
  }

  /**
   * POST /api/interviews/:id/end
   * End interview session
   */
  async endInterview(req, res) {
    try {
      const { id } = req.params;

      const interview = await this.interviewService.endInterview(id);

      res.status(200).json({
        success: true,
        message: 'Interview ended successfully',
        data: interview
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * PUT /api/interviews/:id
   * Update interview details (can edit draft, scheduled, pending interviews)
   */
  async updateInterview(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      let updateData = req.body;

      console.log(`📝 Starting interview update - ID: ${id}, UserId: ${userId}`);

      // Transform individual setting fields into settings object
      const settingFields = ['videoEnabled', 'chatEnabled', 'collaborativeCodeEnabled', 'autoTimerEnabled'];
      const hasSettingFields = settingFields.some(field => field in updateData);
      
      if (hasSettingFields) {
        // Only add defined settings
        updateData.settings = {};
        if (updateData.videoEnabled !== undefined) updateData.settings.videoEnabled = updateData.videoEnabled;
        if (updateData.chatEnabled !== undefined) updateData.settings.chatEnabled = updateData.chatEnabled;
        if (updateData.collaborativeCodeEnabled !== undefined) updateData.settings.collaborativeCodeEnabled = updateData.collaborativeCodeEnabled;
        if (updateData.autoTimerEnabled !== undefined) updateData.settings.autoTimerEnabled = updateData.autoTimerEnabled;
        
        // Remove individual fields as we've consolidated them into settings
        settingFields.forEach(field => delete updateData[field]);
      }

      const interview = await this.interviewService.updateInterview(id, updateData, userId);

      res.status(200).json({
        success: true,
        message: 'Interview updated successfully',
        data: withViewerRole(interview, req.user._id)
      });
    } catch (error) {
      console.error('❌ Update interview error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/interviews/:id/cancel
   * Cancel an interview
   */
  async cancelInterview(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const interview = await this.interviewService.cancelInterview(id, reason);

      res.status(200).json({
        success: true,
        message: 'Interview cancelled successfully',
        data: interview
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/interviews/:id/reject
   * Reject an interview
   */
  async rejectInterview(req, res) {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;

      const interview = await this.interviewService.rejectInterview(id, rejectionReason);

      res.status(200).json({
        success: true,
        message: 'Interview rejected successfully',
        data: interview
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * DELETE /api/interviews/:id
   * Delete an interview (only draft or cancelled)
   */
  async deleteInterview(req, res) {
    try {
      const { id } = req.params;

      await this.interviewService.deleteInterview(id);

      res.status(200).json({
        success: true,
        message: 'Interview deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/interviews/:id/candidates
   * Add a candidate to the interview
   */
  async addCandidate(req, res) {
    try {
      const { id } = req.params;
      const { candidateEmail, candidateName, candidateId } = req.body;

      const interview = await this.interviewService.addCandidate(id, {
        email: candidateEmail,
        name: candidateName,
        userId: candidateId
      });

      res.status(200).json({
        success: true,
        message: 'Candidate added successfully',
        data: interview
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/interviews/:identifier/join
   * Join interview by sessionId or interview ID (candidate action)
   */
  async joinInterview(req, res) {
    try {
      const { identifier } = req.params;
      const userId = req.user._id;
      const clerkId = req.user.clerkId;
      const userName = req.user.name;
      const userImage = req.user.profileImage || req.user.avatar;
      const userRole = req.user.role;

      console.log(`\ud83d\ude2b Candidate attempting to join interview with identifier: ${identifier}`);

      const interview = await this.interviewService.joinInterview(identifier, userId, {
        clerkId,
        userName,
        userImage,
        userRole
      });

      res.status(200).json({
        success: true,
        message: 'Joined interview successfully',
        data: interview
      });
    } catch (error) {
      console.error(`\u274c Join interview error:`, error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/interviews/:identifier/leave
   * Leave interview (candidate action, accepts sessionId or interview ID)
   */
  async leaveInterview(req, res) {
    try {
      const { identifier } = req.params;
      const userId = req.user._id;

      console.log(`👋 Candidate attempting to leave interview with identifier: ${identifier}`);

      const interview = await this.interviewService.leaveInterview(identifier, userId);

      res.status(200).json({
        success: true,
        message: 'Left interview successfully',
        data: interview
      });
    } catch (error) {
      console.error(`❌ Leave interview error:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * DELETE /api/interviews/:id/questions/:questionId
   * Delete a question from the interview
   */
  async deleteQuestion(req, res) {
    try {
      const { id, questionId } = req.params;

      const interview = await this.interviewService.deleteQuestion(id, questionId);

      res.status(200).json({
        success: true,
        message: 'Question deleted successfully',
        data: withViewerRole(interview, req.user._id)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = InterviewController;
