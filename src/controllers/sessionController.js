const { chatClient, streamClient, upsertStreamUser } = require("../config/stream/stream");
const Session = require("../models/Session");

module.exports.createSession = async (req, res) => {
  try {
    const { problem, difficulty } = req.body;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;
    const userName = req.user.name;
    const userImage = req.user.profileImage;

    // ✅ VALIDATION
    if (!problem || !difficulty) {
      return res.status(400).json({ message: "Problem and difficulty are required" });
    }

    const validDifficulties = ["easy", "medium", "hard"];
    if (!validDifficulties.includes(difficulty.toLowerCase())) {
      return res.status(400).json({ message: "Difficulty must be easy, medium, or hard" });
    }

    console.log('🎯 Creating session:', { problem, difficulty, hostId: clerkId });

    // ✅ STEP 1: Upsert the host user to Stream.io BEFORE creating resources
    console.log('👤 Upserting host user to Stream...');
    await upsertStreamUser({
      id: clerkId,
      name: userName,
      image: userImage,
      role: req.user.role
    });
    console.log('✅ Host user upserted to Stream');

    // ✅ STEP 2: Generate unique IDs for Stream resources
    const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const channelId = `channel_${callId}`; // Keep channel consistent with call
    console.log('📝 Generated Stream IDs:', { callId, channelId });

    // ✅ STEP 3: Create Stream Video call with proper metadata
    console.log('📞 Creating Stream video call...');
    await streamClient.video.call("default", callId).getOrCreate({
      data: {
        created_by_id: clerkId,
        custom: { 
          problem, 
          difficulty, 
          type: "session",
          hostId: clerkId 
        },
      },
    });
    console.log('✅ Stream video call created:', callId);

    // ✅ STEP 4: Create Stream Chat channel with proper members setup
    console.log('💬 Creating Stream chat channel...');
    const channel = chatClient.channel("messaging", channelId, {
      name: `${problem} Session - ${difficulty}`,
      created_by_id: clerkId,
      members: [clerkId], // Add host as initial member
      custom: {
        type: "session",
        callId: callId,
        problem: problem,
        difficulty: difficulty
      }
    });
    await channel.create();
    console.log('✅ Chat channel created:', channelId);

    // ✅ STEP 5: Watch the channel as host so messages appear immediately
    console.log('👁️ Host watching chat channel...');
    await channel.watch();
    console.log('✅ Channel being watched by host');

    // ✅ STEP 6: Create session in database with proper status
    console.log('💾 Creating session in database...');
    const session = await Session.create({
      problem,
      difficulty,
      host: userId,
      callId,
      channelId,
      status: "active",
      startedAt: new Date()
    });
    console.log('✅ Session created in DB:', session._id);

    // ✅ Populate before responding
    const populatedSession = await session.populate("host", "name email profileImage clerkId");

    console.log('🎉 Session created successfully');
    res.status(201).json({ 
      session: populatedSession,
      message: "Session created successfully"
    });
  } catch (error) {
    console.error('❌ Error in createSession:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      message: "Failed to create session",
      error: error.message 
    });
  }
};

module.exports.getActiveSessions = async (_, res) => {
  try {
    const sessions = await Session.find({ status: "active" })
      .populate("host", "name profileImage email clerkId")
      .populate("participant", "name profileImage email clerkId")
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({ sessions });
  } catch (error) {
    console.log("Error in getActiveSessions controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getMyRecentSessions = async (req, res) => {
  try {
    const userId = req.user._id;

    // get sessions where user is either host or participant
    const sessions = await Session.find({
      status: "completed",
      $or: [{ host: userId }, { participant: userId }],
    })
      .populate("host", "name profileImage email clerkId")
      .populate("participant", "name profileImage email clerkId")
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({ sessions });
  } catch (error) {
    console.log("Error in getMyRecentSessions controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await Session.findById(id)
      .populate("host", "name email profileImage clerkId")
      .populate("participant", "name email profileImage clerkId");

    if (!session) return res.status(404).json({ message: "Session not found" });

    res.status(200).json({ session });
  } catch (error) {
    console.log("Error in getSessionById controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.joinSession = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;
    const userName = req.user.name;
    const userImage = req.user.profileImage;
    const userRole = req.user.role;

    console.log('🚪 Participant joining session:', { sessionId: id, participantId: clerkId });

    // ✅ VALIDATION
    const session = await Session.findById(id).populate("host", "clerkId");

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.status !== "active") {
      return res.status(400).json({ message: "Cannot join an inactive session" });
    }

    if (session.host._id.toString() === userId.toString()) {
      return res.status(400).json({ message: "Host cannot join as participant" });
    }

    if (session.participant) {
      return res.status(409).json({ message: "Session is already full" });
    }

    // ✅ STEP 1: Upsert participant to Stream.io BEFORE adding to channel
    console.log('👤 Upserting participant to Stream...');
    await upsertStreamUser({
      id: clerkId,
      name: userName,
      image: userImage,
      role: userRole
    });
    console.log('✅ Participant upserted to Stream');

    // ✅ STEP 2: Add participant to chat channel
    console.log('💬 Adding participant to chat channel:', session.channelId);
    const channel = chatClient.channel("messaging", session.channelId);
    await channel.addMembers([clerkId]);
    console.log('✅ Participant added to channel');

    // ✅ STEP 3: Watch the channel as participant
    console.log('👁️ Participant watching chat channel...');
    await channel.watch();
    console.log('✅ Channel being watched by participant');

    // ✅ STEP 4: Update session in database
    console.log('💾 Updating session participant...');
    session.participant = userId;
    await session.save();
    console.log('✅ Session participant updated');

    // ✅ Populate and return
    const populatedSession = await session
      .populate("host", "name email profileImage clerkId")
      .populate("participant", "name email profileImage clerkId");

    console.log('🎉 Participant joined successfully');
    res.status(200).json({ 
      session: populatedSession,
      message: "Successfully joined session"
    });
  } catch (error) {
    console.error('❌ Error in joinSession:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      message: "Failed to join session",
      error: error.message 
    });
  }
};

module.exports.endSession = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    console.log('🛑 Ending session:', { sessionId: id, hostId: userId });

    // ✅ VALIDATION
    const session = await Session.findById(id).populate("host", "_id");

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Only host can end the session
    if (session.host._id.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the host can end this session" });
    }

    // Cannot end already completed session
    if (session.status === "completed") {
      return res.status(400).json({ message: "Session is already completed" });
    }

    // ✅ STEP 1: Delete Stream Video call
    console.log('📞 Deleting Stream video call:', session.callId);
    try {
      const call = streamClient.video.call("default", session.callId);
      await call.delete({ hard: true });
      console.log('✅ Stream video call deleted');
    } catch (err) {
      console.warn('⚠️ Warning deleting call (may not exist):', err.message);
    }

    // ✅ STEP 2: Delete Stream Chat channel
    console.log('💬 Deleting Stream chat channel:', session.channelId);
    try {
      const channel = chatClient.channel("messaging", session.channelId);
      await channel.delete();
      console.log('✅ Stream chat channel deleted');
    } catch (err) {
      console.warn('⚠️ Warning deleting channel (may not exist):', err.message);
    }

    // ✅ STEP 3: Update session status in database
    console.log('💾 Updating session status to completed...');
    session.status = "completed";
    session.completedAt = new Date();
    await session.save();
    console.log('✅ Session marked as completed');

    // ✅ Populate and return
    const populatedSession = await session
      .populate("host", "name email profileImage clerkId")
      .populate("participant", "name email profileImage clerkId");

    console.log('🎉 Session ended successfully');
    res.status(200).json({ 
      session: populatedSession,
      message: "Session ended successfully"
    });
  } catch (error) {
    console.error('❌ Error in endSession:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      message: "Failed to end session",
      error: error.message 
    });
  }
};

module.exports.removeParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    console.log('🚪 Removing participant from session:', { sessionId: id, hostId: userId });

    // ✅ VALIDATION
    const session = await Session.findById(id)
      .populate("host", "_id clerkId")
      .populate("participant", "_id clerkId");

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Only the host can remove a participant
    if (session.host._id.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the host can remove participants" });
    }

    // Check if there's a participant to remove
    if (!session.participant) {
      return res.status(400).json({ message: "No participant to remove" });
    }

    const participantClerkId = session.participant.clerkId;
    console.log('👤 Removing participant:', participantClerkId);

    // ✅ STEP 1: Remove participant from chat channel
    console.log('💬 Removing participant from chat channel...');
    try {
      const channel = chatClient.channel("messaging", session.channelId);
      await channel.removeMembers([participantClerkId]);
      console.log('✅ Participant removed from channel');
    } catch (err) {
      console.warn('⚠️ Warning removing from channel:', err.message);
    }

    // ✅ STEP 2: Update session in database
    console.log('💾 Clearing session participant...');
    session.participant = null;
    await session.save();
    console.log('✅ Session participant cleared');

    // ✅ Populate and return
    const populatedSession = await session
      .populate("host", "name email profileImage clerkId")
      .populate("participant", "name email profileImage clerkId");

    console.log('🎉 Participant removed successfully');
    res.status(200).json({ 
      session: populatedSession,
      message: "Participant removed successfully"
    });
  } catch (error) {
    console.error('❌ Error in removeParticipant:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      message: "Failed to remove participant",
      error: error.message 
    });
  }
};