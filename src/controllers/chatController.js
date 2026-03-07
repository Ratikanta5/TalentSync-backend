const { chatClient } = require("../config/stream/stream");

module.exports.getStreamToken = async (req, res) => {
    try {
        //user clerkId for Stream (not mongodb _id) => because it should match the id we have in the stream dashboard
        const token = chatClient.createToken(req.user.clerkId);

        res.status(200).json({
            token,
            userId: req.user.clerkId,
            userName: req.user.name,
            userImage: req.user.profileImage
        })
    } catch (err) {
        console.error("Error in getStreamToken controller:", err);
        res.status(500).json({
            msg: "Internal Server Error",
            error: err.message
        })

    }
}