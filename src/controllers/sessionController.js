const { streamClient, chatClient } = require("../config/stream/stream");
const Session = require("../models/Session");

module.exports.createSession = async (req, res) => {
    // Logic to create a new session
    try {
        const { problem, difficulty } = req.body;
        const userId = req.user._id;
        const clerkId = req.user.clerkId;

        if (!problem || !difficulty) {
            res.status(400).json({ msg: "Problem and difficulty are required" });
        }

        //generate a unique call id for stream video
        const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        //create a session in db
        const session = await Session.create({ problem, difficulty, host: userId, callId });

        //create stream video call
        await streamClient.video.call("default", callId).getOrCreate({
            data: {
                created_by_id: clerkId,
                custom: { problem, difficulty, sessionId: session._id.toString() }
            },
        })

        //chat messaging
        const channel = chatClient.channel("messaging", callId, {
            name: `${problem} Session`,
            created_by_id: clerkId,
            members: [clerkId]
        })

        await channel.create();
        res.status(201).json({ session });
    }
    catch (err) {
        console.log("Error in createSession controller:", err.message);
        res.status(500).json({ msg: "Internal Server Error" })
    }
};


module.exports.getActiveSessions = async (req, res) => {
    try {
        const sessions = (await Session.find({ status: "active" }).populate("host", "name profileImage email clerkId")).toSorted({ createdAt: -1 }).limit(20);
        res.status(200).json({ sessions })
    } catch (err) {
        console.log("Error in getActibeSessions controller:", err.message);
        res.status(500).json({ msg: "Internal Server Error" })
    }
};

module.exports.getMyRecentSessions = async (req, res) => {
    try {
        const userId = req.user._id;

        //get session where user is either host or participant
        const sessions = await Session.find({
            status: "completed",
            $or: [{ host: userId }, { participant: userId }],
        }).sort({ createdAt: -1 }).limit(20);

        res.status(200).json({ sessions })
    } catch (err) {
        console.log("Error in getMyRecentSessions controller:", err.message);
        res.status(500).json({ msg: "Internal Server Error" })

    }
};


module.exports.getSessionById = async (req, res) => {
    try {
        const { id } = req.params;
        const session = await Session.findById(id).populate("host", "name email profileImage clerkId").populate("participant", "name email profileImage clerkId");

        if (!session) res.status(404).josn({ msg: "Session not found" });

        res.status(200).json({ session })

    } catch (err) {
        console.log("Error in getSessionById controller:", err.message);
        res.status(500).json({ msg: "Internal Server Error" })
    }
};

module.exports.joinSession = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const clerkId = req.user.clerkId;

        const session = await Session.findById(id);

        if (!session) return res.status(404).josn({ msg: "Session not found" });

        //check if session is already full -  has a participant

        if (session.participant) return res.status(404).json({ msg: "Session is full" });

        session.participant = userId;
        await session.save();

        const channel = chatClient.channel("messaging", session.callId);
        await channel.addMembers([clerkId]);

        res.status(200).json({ session })

    } catch (err) {
        console.log("Error in joinSession controller:", err.message);
        res.status(500).json({ msg: "Internal Server Error" })
    }
};

module.exports.endSession = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const session = await Session.findById(id);

        if (!session) return res.status(404).josn({ msg: "Session not found" });

        //only host can end the session

        if (session.host.toString() !== userId.toString) {
            return res.status(403).json({ msg: "only host can end the message" });
        }

        //check if session is already completed

        if (session.status === "completed") {
            return res.status(400).json({ msg: "Session is already completed" });
        }


        session.status = "completed"
        await session.save();

        //delete stream video call
        const call = streamClient.video.call("default", session.callId);
        await call.delete({ hard: true });

        //delete stream chat channel
        const channel = chatClient.channel("messaging", session.callId);
        await channel.delete();

        res.status(200).json({ session, msg: "Session ended Successfully" });

    } catch (err) {
        console.log("Error in endSession controller:", err.message);
        res.status(500).json({ msg: "Internal Server Error" })

    }
};
