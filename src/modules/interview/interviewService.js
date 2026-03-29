const mongoose = require('mongoose');
const Interview = require('../../database/models/Interview');
const User = require('../../database/models/User');
const Problem = require('../../database/models/Problem');
const crypto = require('crypto');

class InterviewService {
  /**
   * Create a new interview session
   * @param {Object} data - Interview data
   * @param {string} interviewerId - ID of the interviewer
   * @returns {Promise<Object>} Created interview
   */
  async createInterview(data, interviewerId) {
    try {
      const sessionId = this.generateSessionId();

      const interview = new Interview({
        sessionId,
        interviewer: interviewerId,
        title: data.title.trim(),
        description: data.description?.trim() || '',
        timeLimit: data.timeLimit || 60,
        settings: {
          videoEnabled: data.videoEnabled !== false,
          chatEnabled: data.chatEnabled !== false,
          collaborativeCodeEnabled: data.collaborativeCodeEnabled !== false,
          autoTimerEnabled: data.autoTimerEnabled !== false
        },
        status: data.scheduledFor ? 'scheduled' : 'draft',
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null
      });

      await interview.save();

      // Populate interviewer info before returning
      const populatedInterview = await interview.populate('interviewer', 'name email avatar');

      return populatedInterview;
    } catch (error) {
      throw new Error(`Failed to create interview: ${error.message}`);
    }
  }

  /**
   * Get all interviews for a user based on role
   * @param {string} userId - User ID
   * @param {string} role - User role (interviewer/candidate)
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} Array of interviews
   */
  async getUserInterviews(userId, role, filters = {}) {
    try {
      let query = {};

      if (role === 'interviewer') {
        query.interviewer = userId;
      } else if (role === 'candidate') {
        query['candidates.userId'] = userId;
      }

      if (filters.status) query.status = filters.status;
      if (filters.level) {
        query['questions.level'] = filters.level;
      }

      const interviews = await Interview.find(query)
        .populate('interviewer', 'name avatar company')
        .populate('candidates.userId', 'name avatar')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 20)
        .skip(filters.skip || 0);

      return interviews;
    } catch (error) {
      throw new Error(`Failed to fetch interviews: ${error.message}`);
    }
  }

  /**
   * Get interview by ID or meeting link
   * @param {string} identifier - Interview ID or meeting link
   * @param {string} type - 'id' or 'link'
   * @returns {Promise<Object>} Interview data
   */
  async getInterviewById(identifier, type = 'id') {
    try {
      let query = {};

      if (type === 'id') {
        query._id = identifier;
      } else if (type === 'link' || type === 'sessionId') {
        query.sessionId = identifier;
      }

      const interview = await Interview.findOne(query)
        .populate('interviewer', 'name avatar company email')
        .populate('candidates.userId', 'name avatar email')
        .populate('company', 'name logo');

      if (!interview) {
        throw new Error('Interview not found');
      }

      return interview;
    } catch (error) {
      throw new Error(`Failed to fetch interview: ${error.message}`);
    }
  }

  /**
   * Add question to interview
   * @param {string} interviewId - Interview ID
   * @param {Object} questionData - Question details
   * @returns {Promise<Object>} Updated interview
   */
  async addQuestion(interviewId, questionData) {
    try {
      const interview = await Interview.findById(interviewId);
      if (!interview) throw new Error('Interview not found');

      const question = {
        _id: new mongoose.Types.ObjectId(),
        title: questionData.title,
        summary: questionData.summary || '',
        level: questionData.level || 'medium',
        problemStatement: questionData.problemStatement || '',
        timer: questionData.timer || 30,
        addedAt: new Date()
      };

      interview.questions.push(question);
      await interview.save();

      return interview;
    } catch (error) {
      throw new Error(`Failed to add question: ${error.message}`);
    }
  }

  /**
   * Start an interview session
   * @param {string} interviewId - Interview ID
   * @param {string} clerkId - User's Clerk ID
   * @param {string} userName - User's name
   * @param {string} userImage - User's profile image
   * @param {string} userRole - User's role (interviewer/candidate/admin)
   * @returns {Promise<Object>} Started interview
   */
  async startInterview(interviewId, clerkId, userName, userImage, userRole) {
    try {
      console.log('🎯 Starting interview creation process...', { interviewId, clerkId, userName });
      
      const interview = await Interview.findById(interviewId);
      if (!interview) throw new Error('Interview not found');
      console.log('✅ Interview found:', interview._id);

      // Generate unique Stream IDs
      const streamCallId = `interview_${interviewId}_${Date.now()}`;
      const streamChannelId = `interview_chat_${interviewId}`;
      console.log('📝 Generated Stream IDs:', { streamCallId, streamChannelId });

      // Import Stream clients
      const { streamClient, chatClient, upsertStreamUser } = require('../../config/stream/stream');
      console.log('✅ Stream clients imported');

      // Step 1: Upsert interviewer to Stream
      console.log('🔄 Upserting user to Stream.io...');
      await upsertStreamUser({
        id: clerkId,
        name: userName,
        image: userImage,
        role: userRole
      });
      console.log('✅ User upserted to Stream.io');

      // Step 2: Create Stream video call
      console.log('📞 Creating Stream video call...');
      await streamClient.video.call('default', streamCallId).getOrCreate({
        data: {
          created_by_id: clerkId,
          custom: {
            interviewId: interview._id.toString(),
            title: interview.title,
            type: 'interview'
          }
        }
      });
      console.log('✅ Stream video call created:', streamCallId);

      // Step 3: Create Stream chat channel
      console.log('💬 Creating Stream chat channel...');
      const channel = chatClient.channel('messaging', streamChannelId, {
        name: `Interview: ${interview.title}`,
        interview_id: interview._id.toString(),
        created_by_id: clerkId,
        members: [clerkId],
        // Ensure channel allows users to read/watch it
        custom: {
          interviewId: interview._id.toString(),
          allowPublicReading: true
        }
      });
      await channel.create();
      console.log('✅ Stream chat channel created:', streamChannelId);

      // Step 4: Update interview with Stream IDs and status
      console.log('💾 Updating interview status to active...');
      interview.status = 'active';
      interview.startedAt = new Date();
      interview.streamCallId = streamCallId;
      interview.streamChannelId = streamChannelId;

      await interview.save();
      console.log('✅ Interview saved with Stream IDs');
      console.log('🎉 Interview started successfully:', { streamCallId, streamChannelId });
      
      return interview;
    } catch (error) {
      console.error('❌ Error starting interview:', error.message);
      console.error('Stack:', error.stack);
      throw new Error(`Failed to start interview: ${error.message}`);
    }
  }

  /**
   * Join interview as candidate
   * @param {string} identifier - sessionId or interview _id
   * @param {string} userId - Candidate user ID
   * @returns {Promise<Object>} Interview data
   */
  async joinInterview(identifier, userId, userInfo = {}) {
    try {
      let interview;
      
      // Try to find by sessionId first (for sharing link)
      interview = await this.getInterviewById(identifier, 'sessionId');
      
      // If not found by sessionId, try by interview ID
      if (!interview) {
        interview = await this.getInterviewById(identifier, 'id');
      }

      if (!interview) throw new Error('Interview not found');
      if (interview.status === 'completed' || interview.status === 'cancelled') {
        throw new Error('Interview is no longer available');
      }

      // Check if candidate already joined
      const candidateExists = interview.candidates.some(c => c.userId.toString() === userId);

      // ✅ Step 1: Upsert candidate to Stream.io
      if (userInfo.clerkId && userInfo.userName) {
        console.log('🔄 Upserting candidate to Stream.io...');
        const { upsertStreamUser } = require('../../config/stream/stream');
        try {
          await upsertStreamUser({
            id: userInfo.clerkId,
            name: userInfo.userName,
            image: userInfo.userImage,
            role: userInfo.userRole
          });
          console.log('✅ Candidate upserted to Stream.io');
        } catch (upsertError) {
          console.warn('⚠️ Warning: Failed to upsert candidate, but continuing:', upsertError.message);
          // Don't throw - upsert failing shouldn't block channel access
        }

        // ✅ Step 2: Add candidate to chat channel
        if (interview.streamChannelId) {
          console.log('💬 Adding candidate to chat channel:', interview.streamChannelId);
          const { chatClient } = require('../../config/stream/stream');
          try {
            const channel = chatClient.channel('messaging', interview.streamChannelId);
            // Add as member with explicit permissions
            await channel.addMembers([userInfo.clerkId]);
            console.log('✅ Candidate added to chat channel as member');
            
            // Also try to update channel data to include this user
            try {
              await channel.update({
                // Just update to trigger any necessary updates
              });
              console.log('✅ Channel updated for candidate');
            } catch (updateError) {
              console.warn('⚠️ Channel update skipped:', updateError.message);
            }
          } catch (addMembersError) {
            console.error('❌ Failed to add candidate to channel:', addMembersError.message);
            // Log but don't throw - the candidate might still be able to access via other means
            throw new Error(`Failed to add candidate to chat channel: ${addMembersError.message}`);
          }
        } else {
          console.warn('⚠️ No streamChannelId found for interview');
        }
      }

      if (!candidateExists) {
        interview.candidates.push({
          userId,
          joinedAt: new Date(),
          status: 'joined'
        });
        await interview.save();
      }

      console.log(`✅ Candidate ${userId} joined interview ${identifier}`);
      return interview;
    } catch (error) {
      throw new Error(`Failed to join interview: ${error.message}`);
    }
  }

  /**
   * Submit code for a question
   * @param {string} interviewId - Interview ID
   * @param {string} userId - User ID
   * @param {Object} submissionData - Code and language
   * @returns {Promise<Object>} Submission result
   */
  async submitCode(interviewId, userId, submissionData) {
    try {
      const interview = await Interview.findById(interviewId);
      if (!interview) throw new Error('Interview not found');

      const submission = {
        userId,
        code: submissionData.code,
        language: submissionData.language || 'javascript',
        status: 'pending',
        submittedAt: new Date()
      };

      interview.submissions.push(submission);
      await interview.save();

      return submission;
    } catch (error) {
      throw new Error(`Failed to submit code: ${error.message}`);
    }
  }

  /**
   * End interview session
   * @param {string} interviewId - Interview ID
   * @returns {Promise<Object>} Completed interview
   */
  async endInterview(interviewId) {
    try {
      const interview = await Interview.findById(interviewId);
      if (!interview) throw new Error('Interview not found');

      // Clean up Stream resources if they exist
      if (interview.streamCallId || interview.streamChannelId) {
        const { streamClient, chatClient } = require('../../config/stream/stream');

        // Delete Stream video call
        if (interview.streamCallId) {
          try {
            await streamClient.video.call('default', interview.streamCallId).delete({ hard: true });
            console.log(`✅ Deleted Stream call: ${interview.streamCallId}`);
          } catch (err) {
            console.error(`Error deleting Stream call: ${err.message}`);
          }
        }

        // Delete Stream chat channel
        if (interview.streamChannelId) {
          try {
            const channel = chatClient.channel('messaging', interview.streamChannelId);
            await channel.delete();
            console.log(`✅ Deleted Stream channel: ${interview.streamChannelId}`);
          } catch (err) {
            console.error(`Error deleting Stream channel: ${err.message}`);
          }
        }
      }

      // Update interview status
      interview.status = 'completed';
      interview.endedAt = new Date();

      if (interview.startedAt) {
        interview.duration = Math.floor((interview.endedAt - interview.startedAt) / 60000);
      }

      await interview.save();
      return interview;
    } catch (error) {
      throw new Error(`Failed to end interview: ${error.message}`);
    }
  }

  /**
   * Update interview details (can edit draft, scheduled, pending, and even rejected)
   * @param {string} interviewId - Interview ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated interview
   */
  async updateInterview(interviewId, updateData, userId) {
    try {
      const interview = await Interview.findById(interviewId);
      if (!interview) throw new Error('Interview not found');

      // Verify user is the owner of the interview
      const interviewerIdStr = interview.interviewer.toString();
      const userIdStr = userId.toString();
      
      console.log(`🔒 Permission check - Interview interviewer: ${interviewerIdStr}, Requesting user: ${userIdStr}`);
      console.log(`🔒 Interviewer type: ${typeof interview.interviewer}, User type: ${typeof userId}`);
      
      if (interviewerIdStr !== userIdStr) {
        console.log(`❌ Permission denied - IDs don't match`);
        throw new Error('You do not have permission to update this interview');
      }
      
      console.log(`✅ Permission check passed`);

      // Can only update if interview hasn't started (active) or completed
      if (interview.status === 'active' || interview.status === 'completed' || interview.status === 'cancelled') {
        throw new Error('Cannot update an interview that has started, completed, or been cancelled');
      }

      console.log(`📋 Original interview data:`, {
        title: interview.title,
        description: interview.description,
        timeLimit: interview.timeLimit,
        status: interview.status,
        scheduledFor: interview.scheduledFor,
        settings: interview.settings
      });
      
      console.log(`📨 Received update data:`, updateData);

      const allowedFields = ['title', 'description', 'timeLimit', 'settings', 'scheduledFor', 'company'];
      const fieldsToUpdate = Object.keys(updateData).filter(key => allowedFields.includes(key));
      const ignoredFields = Object.keys(updateData).filter(key => !allowedFields.includes(key));
      
      if (ignoredFields.length > 0) {
        console.log(`⚠️  Ignored fields (not allowed): ${ignoredFields.join(', ')}`);
      }
      
      console.log(`✏️  Fields being updated: ${fieldsToUpdate.join(', ') || 'none'}`);
      
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          if (key === 'settings' && updateData[key]) {
            // Merge settings instead of replacing them
            interview.settings = {
              ...interview.settings,
              ...Object.fromEntries(
                Object.entries(updateData.settings).filter(([_, v]) => v !== undefined)
              )
            };
            console.log(`  ✓ Updated settings:`, interview.settings);
          } else {
            interview[key] = updateData[key];
            console.log(`  ✓ Updated ${key}:`, updateData[key]);
          }
        }
      });

      // Update status based on scheduledFor
      if ('scheduledFor' in updateData) {
        if (updateData.scheduledFor) {
          interview.status = 'scheduled';
        } else if (interview.status === 'scheduled') {
          interview.status = 'draft';
        }
        console.log(`  ✓ Updated status based on scheduledFor:`, interview.status);
      }

      console.log(`💾 Saving interview...`);
      await interview.save();
      console.log(`✅ Interview saved successfully`);
      
      return await interview.populate('interviewer', 'name email avatar');
    } catch (error) {
      throw new Error(`Failed to update interview: ${error.message}`);
    }
  }

  /**
   * Cancel an interview
   * @param {string} interviewId - Interview ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancelled interview
   */
  async cancelInterview(interviewId, reason) {
    try {
      const interview = await Interview.findById(interviewId);
      if (!interview) throw new Error('Interview not found');

      if (interview.status === 'completed') {
        throw new Error('Cannot cancel a completed interview');
      }

      interview.status = 'cancelled';
      interview.cancellationReason = reason || null;
      await interview.save();

      return interview;
    } catch (error) {
      throw new Error(`Failed to cancel interview: ${error.message}`);
    }
  }

  /**
   * Reject an interview
   * @param {string} interviewId - Interview ID
   * @param {string} rejectionReason - Rejection reason
   * @returns {Promise<Object>} Rejected interview
   */
  async rejectInterview(interviewId, rejectionReason) {
    try {
      const interview = await Interview.findById(interviewId);
      if (!interview) throw new Error('Interview not found');

      interview.status = 'rejected';
      interview.rejectionReason = rejectionReason || null;
      await interview.save();

      return interview;
    } catch (error) {
      throw new Error(`Failed to reject interview: ${error.message}`);
    }
  }

  /**
   * Delete an interview
   * @param {string} interviewId - Interview ID
   * @returns {Promise<void>}
   */
  async deleteInterview(interviewId) {
    try {
      const interview = await Interview.findById(interviewId);
      if (!interview) throw new Error('Interview not found');

      if (interview.status !== 'draft' && interview.status !== 'cancelled') {
        throw new Error('Can only delete draft or cancelled interviews');
      }

      await Interview.findByIdAndDelete(interviewId);
    } catch (error) {
      throw new Error(`Failed to delete interview: ${error.message}`);
    }
  }

  /**
   * Add a candidate to the interview
   * @param {string} interviewId - Interview ID
   * @param {Object} candidateData - Candidate info
   * @returns {Promise<Object>} Updated interview
   */
  async addCandidate(interviewId, candidateData) {
    try {
      const interview = await Interview.findById(interviewId);
      if (!interview) throw new Error('Interview not found');

      // Check if candidate already added
      const candidateExists = interview.candidates.some(c => c.email === candidateData.email);
      if (candidateExists) {
        throw new Error('Candidate already added');
      }

      interview.candidates.push({
        userId: candidateData.userId || null,
        email: candidateData.email,
        name: candidateData.name,
        status: 'invited'
      });

      await interview.save();
      return interview;
    } catch (error) {
      throw new Error(`Failed to add candidate: ${error.message}`);
    }
  }

  /**
   * Leave interview (candidate action)
   * @param {string} identifier - Session ID or interview ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated interview
   */
  async leaveInterview(identifier, userId) {
    try {
      let interview;
      
      // Try to find by sessionId first
      interview = await this.getInterviewById(identifier, 'sessionId');
      
      // If not found by sessionId, try by interview ID
      if (!interview) {
        interview = await this.getInterviewById(identifier, 'id');
      }
      
      if (!interview) throw new Error('Interview not found');

      const candidateIndex = interview.candidates.findIndex(c => c.userId && c.userId.toString() === userId);
      if (candidateIndex === -1) {
        throw new Error('You are not a candidate in this interview');
      }

      interview.candidates[candidateIndex].status = 'left';
      interview.candidates[candidateIndex].leftAt = new Date();
      await interview.save();

      console.log(`✅ Candidate ${userId} left interview ${identifier}`);
      return interview;
    } catch (error) {
      throw new Error(`Failed to leave interview: ${error.message}`);
    }
  }

  /**
   * Delete a question from interview
   * @param {string} interviewId - Interview ID
   * @param {string} questionId - Question ID
   * @returns {Promise<Object>} Updated interview
   */
  async deleteQuestion(interviewId, questionId) {
    try {
      const interview = await Interview.findById(interviewId);
      if (!interview) throw new Error('Interview not found');

      interview.questions = interview.questions.filter(q => q._id.toString() !== questionId);
      await interview.save();

      return interview;
    } catch (error) {
      throw new Error(`Failed to delete question: ${error.message}`);
    }
  }

  /**
   * Helper: Generate unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper: Generate meeting link
   * @returns {string} Meeting link
   */
  generateMeetingLink() {
    return crypto.randomBytes(8).toString('hex');
  }
}

module.exports = InterviewService;
