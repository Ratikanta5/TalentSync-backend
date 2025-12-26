const { StreamChat } = require('stream-chat');
const { StreamClient } = require('@stream-io/node-sdk');


const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
    console.error("STREAM_API_KEY OR STREAM_API_SECRET is missing");
    process.exit(1);
}


const chatClient = StreamChat.getInstance(apiKey, apiSecret); //this is for chat features
const streamClient = new StreamClient(apiKey, apiSecret); //this will be use for videocalls



const upsertStreamUser = async (userData) => {
    try {
        await chatClient.upsertUser(userData);
        console.log("stream user upserted successfully:", userData);
    } catch (err) {
        console.error("Error upserting Stream user:", err);
    }
};

const deleteStreamUser = async (userId) => {
    try {
        await chatClient.deleteUser(userId);
        console.log("stream user deleted successfully:", userId);
    } catch (err) {
        console.error("Error deleting the Stream user:", err);
    }
};

module.exports = {
    chatClient,
    streamClient,
    upsertStreamUser,
    deleteStreamUser
};
