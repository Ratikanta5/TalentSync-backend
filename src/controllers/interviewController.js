const Interview = require('../database/models/Interview');
const User = require('../database/models/User');
const mongoose = require('mongoose');
const { upsertStreamUser, streamClient, chatClient } = require('../config/stream/stream');

// ================== CREATE INTERVIEW ==================
/**
 * Create a new interview
 * POST /api/interviews
 */
exports.createInterview = async (req, res) => {
  try {
    const userId = req.user._id; // From auth middleware
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

    // Validation
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Interview title is required'
      });
    }

    if (timeLimit && (timeLimit < 10 || timeLimit > 480)) {
      return res.status(400).json({
        success: false,
        message: 'Time limit must be between 10 and 480 minutes'
      });
    }

    // Create new interview
    const newInterview = new Interview({
      interviewer: userId,
      title: title.trim(),
      description: description?.trim() || '',
      company: req.body.company || null,
      timeLimit: timeLimit || 60,
      settings: {
        videoEnabled: videoEnabled !== false,
        chatEnabled: chatEnabled !== false,
        collaborativeCodeEnabled: collaborativeCodeEnabled !== false,
        autoTimerEnabled: autoTimerEnabled !== false
      },
      status: scheduledFor ? 'scheduled' : 'draft',
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null
    });

    await newInterview.save();

    res.status(201).json({
      success: true,
      message: 'Interview created successfully',
      data: newInterview
    });
  } catch (error) {
    console.error('Create interview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create interview',
      error: error.message
    });
  }
};

// ================== GET ALL INTERVIEWS ==================
exports.getInterviews = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query;

    let query = { interviewer: userId };
    if (status) {
      query.status = status;
    }

    const interviews = await Interview.find(query)
      .populate('interviewer', 'name email avatar')
      .populate('candidates.userId', 'name email avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: interviews,
      total: interviews.length
    });
  } catch (error) {
    console.error('Get interviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch interviews',
      error: error.message
    });
  }
};

// ================== GET INTERVIEW BY ID ==================
exports.getInterviewById = async (req, res) => {
  try {
    const { id } = req.params;
    let interview;

    // Try to find by MongoDB ObjectId first
    try {
      interview = await Interview.findById(id)
        .populate('interviewer', 'name email avatar company')
        .populate('candidates.userId', 'name email avatar role');
    } catch (err) {
      // If findById fails, try by sessionId
      interview = null;
    }

    // If not found by ID, try by sessionId
    if (!interview) {
      interview = await Interview.findOne({ sessionId: id })
        .populate('interviewer', 'name email avatar company')
        .populate('candidates.userId', 'name email avatar role');
    }

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    res.status(200).json({
      success: true,
      data: interview
    });
  } catch (error) {
    console.error('Get interview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch interview',
      error: error.message
    });
  }
};

// ================== UPDATE INTERVIEW ==================
/**
 * Update interview details (can edit drafted, scheduled, pending interviews)
 * PUT /api/interviews/:id
 */
exports.updateInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const updateData = req.body;

    const interview = await Interview.findById(id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Only interviewer can update
    if (interview.interviewer.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this interview'
      });
    }

    // Can only update if interview hasn't started (active) or completed or cancelled
    if (interview.status === 'active' || interview.status === 'completed' || interview.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update an interview that has started, completed, or been cancelled'
      });
    }

    // Update allowed fields
    const allowedFields = ['title', 'description', 'timeLimit', 'settings', 'scheduledFor', 'company'];
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        interview[key] = updateData[key];
      }
    });

    await interview.save();

    res.status(200).json({
      success: true,
      message: 'Interview updated successfully',
      data: interview
    });
  } catch (error) {
    console.error('Update interview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update interview',
      error: error.message
    });
  }
};

// ================== START INTERVIEW ==================
/**
 * Start an interview
 * POST /api/interviews/:id/start
 */
exports.startInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;
    const name = req.user.name;

    const interview = await Interview.findById(id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    if (interview.interviewer.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to start this interview'
      });
    }

    if (interview.status === 'active' || interview.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Interview is already active or completed'
      });
    }

    // Upsert interviewer to Stream.io
    await upsertStreamUser({
      id: clerkId,
      name: name,
      image: null,
      role: req.user.role
    });

    // Generate unique callId for Stream
    const streamCallId = `interview_${interview._id}_${Date.now()}`;
    const streamChannelId = `interview_chat_${interview._id}`;

    // Create Stream video call
    await streamClient.video.call("default", streamCallId).getOrCreate({
      data: {
        created_by_id: clerkId,
        custom: {
          interviewId: interview._id.toString(),
          title: interview.title,
          type: 'interview'
        }
      }
    });

    // Create Stream chat channel
    const channel = chatClient.channel('messaging', streamChannelId, {
      name: `Interview: ${interview.title}`,
      interview_id: interview._id.toString(),
      created_by_id: clerkId,
      members: [clerkId]
    });

    await channel.create();

    // Update status to active and store Stream IDs
    interview.status = 'active';
    interview.startedAt = new Date();
    interview.streamCallId = streamCallId;
    interview.streamChannelId = streamChannelId;
    await interview.save();

    res.status(200).json({
      success: true,
      message: 'Interview started',
      data: interview
    });
  } catch (error) {
    console.error('Start interview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start interview',
      error: error.message
    });
  }
};

// ================== ADD CANDIDATE ==================
exports.addCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { candidateEmail, candidateName, candidateId } = req.body;

    const interview = await Interview.findById(id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    if (interview.interviewer.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this interview'
      });
    }

    // Check if candidate already added
    const candidateExists = interview.candidates.some(c => c.email === candidateEmail);
    if (candidateExists) {
      return res.status(400).json({
        success: false,
        message: 'Candidate already added'
      });
    }

    interview.candidates.push({
      userId: candidateId || null,
      email: candidateEmail,
      name: candidateName,
      status: 'invited'
    });

    await interview.save();

    res.status(200).json({
      success: true,
      message: 'Candidate added successfully',
      data: interview
    });
  } catch (error) {
    console.error('Add candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add candidate',
      error: error.message
    });
  }
};

// ================== REJECT INTERVIEW ==================
exports.rejectInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { rejectionReason } = req.body;

    const interview = await Interview.findById(id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    if (interview.interviewer.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject this interview'
      });
    }

    interview.status = 'rejected';
    interview.rejectionReason = rejectionReason || null;
    await interview.save();

    res.status(200).json({
      success: true,
      message: 'Interview rejected successfully',
      data: interview
    });
  } catch (error) {
    console.error('Reject interview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject interview',
      error: error.message
    });
  }
};

// ================== END INTERVIEW ==================
/**
 * End/Complete an interview
 * POST /api/interviews/:id/end
 */
exports.endInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const interview = await Interview.findById(id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    if (interview.interviewer.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to end this interview'
      });
    }

    // Delete Stream video call if it exists
    if (interview.streamCallId) {
      try {
        const call = streamClient.video.call("default", interview.streamCallId);
        await call.delete({ hard: true });
      } catch (err) {
        console.error('Error deleting Stream call:', err);
      }
    }

    // Delete Stream chat channel if it exists
    if (interview.streamChannelId) {
      try {
        const channel = chatClient.channel("messaging", interview.streamChannelId);
        await channel.delete();
      } catch (err) {
        console.error('Error deleting Stream channel:', err);
      }
    }

    interview.status = 'completed';
    interview.endedAt = new Date();
    await interview.save();

    res.status(200).json({
      success: true,
      message: 'Interview ended successfully',
      data: interview
    });
  } catch (error) {
    console.error('End interview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end interview',
      error: error.message
    });
  }
};

// ================== CANCEL INTERVIEW ==================
/**
 * Cancel an interview
 * POST /api/interviews/:id/cancel
 */
exports.cancelInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { reason } = req.body;

    const interview = await Interview.findById(id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    if (interview.interviewer.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this interview'
      });
    }

    if (interview.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed interview'
      });
    }

    interview.status = 'cancelled';
    interview.cancellationReason = reason || 'No reason provided';

    await interview.save();

    res.status(200).json({
      success: true,
      message: 'Interview cancelled successfully',
      data: interview
    });
  } catch (error) {
    console.error('Cancel interview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel interview',
      error: error.message
    });
  }
};

// ================== DELETE INTERVIEW ==================
exports.deleteInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const interview = await Interview.findById(id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    if (interview.interviewer.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this interview'
      });
    }

    // Can only delete draft or cancelled interviews
    if (interview.status !== 'draft' && interview.status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Can only delete draft or cancelled interviews'
      });
    }

    await Interview.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Interview deleted successfully'
    });
  } catch (error) {
    console.error('Delete interview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete interview',
      error: error.message
    });
  }
};

// ================== JOIN INTERVIEW ==================
exports.joinInterview = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;
    const name = req.user.name;
    const profileImage = req.user.profileImage;

    const interview = await Interview.findOne({ sessionId });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview session not found'
      });
    }

    // Find candidate in interview
    const candidateIndex = interview.candidates.findIndex(c => c.userId && c.userId.toString() === userId);

    if (candidateIndex === -1) {
      return res.status(403).json({
        success: false,
        message: 'You are not a candidate in this interview'
      });
    }

    // Upsert user to Stream.io
    await upsertStreamUser({
      id: clerkId,
      name: name,
      image: profileImage,
      role: req.user.role
    });

    // Update candidate status
    interview.candidates[candidateIndex].status = 'joined';
    interview.candidates[candidateIndex].joinedAt = new Date();
    await interview.save();

    res.status(200).json({
      success: true,
      message: 'Joined interview successfully',
      data: interview
    });
  } catch (error) {
    console.error('Join interview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join interview',
      error: error.message
    });
  }
};

// ================== LEAVE INTERVIEW ==================
exports.leaveInterview = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const interview = await Interview.findOne({ sessionId });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview session not found'
      });
    }

    // Find candidate in interview
    const candidateIndex = interview.candidates.findIndex(c => c.userId && c.userId.toString() === userId);

    if (candidateIndex === -1) {
      return res.status(403).json({
        success: false,
        message: 'You are not a candidate in this interview'
      });
    }

    // Update candidate status
    interview.candidates[candidateIndex].status = 'left';
    interview.candidates[candidateIndex].leftAt = new Date();
    await interview.save();

    res.status(200).json({
      success: true,
      message: 'Left interview successfully',
      data: interview
    });
  } catch (error) {
    console.error('Leave interview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave interview',
      error: error.message
    });
  }
};
