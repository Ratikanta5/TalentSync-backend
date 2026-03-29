const { StreamChat } = require('stream-chat');
const { StreamClient } = require('@stream-io/node-sdk');

// ✅ Validate credentials
const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
    console.error("❌ CRITICAL: STREAM_API_KEY or STREAM_API_SECRET is missing");
    console.error("   API Key present:", !!apiKey);
    console.error("   API Secret present:", !!apiSecret);
    console.error("❌ Application cannot start without Stream credentials");
    process.exit(1);
}

console.log('✅ Stream credentials validated');

// ✅ Initialize clients with proper error handling
let chatClient;
let streamClient;

try {
    chatClient = StreamChat.getInstance(apiKey, apiSecret);
    console.log('✅ Stream Chat client initialized');
} catch (err) {
    console.error('❌ Failed to initialize Stream Chat client:', err.message);
    process.exit(1);
}

try {
    streamClient = new StreamClient(apiKey, apiSecret);
    console.log('✅ Stream Video client initialized');
} catch (err) {
    console.error('❌ Failed to initialize Stream Video client:', err.message);
    process.exit(1);
}

/**
 * Upsert user to Stream.io
 * Creates user if doesn't exist, updates if exists
 * CRITICAL: Must be called before adding user to channels or creating calls
 * 
 * @param {Object} userData - User data
 * @param {string} userData.id - Clerk ID (user identifier in Stream)
 * @param {string} userData.name - User's display name
 * @param {string} userData.image - User's profile image URL
 * @param {string} userData.role - User's role (interviewer/candidate/admin)
 */
const upsertStreamUser = async (userData) => {
    try {
        if (!userData.id || !userData.name) {
            throw new Error('User ID and name are required for Stream upsert');
        }

        console.log('👤 Upserting user:', userData.id, 'with role:', userData.role || 'candidate');
        
        // ✅ Build user payload
        const userPayload = {
            id: userData.id,
            name: userData.name,
        };

        // Add image if provided
        if (userData.image) {
            userPayload.image = userData.image;
        }

        // Add custom role data for app-level tracking
        if (userData.role) {
            userPayload.custom = {
                app_role: userData.role  // Use app_role to avoid conflict with Stream's role system
            };
        }
        
        console.log('🔄 Calling chatClient.upsertUser...');
        await chatClient.upsertUser(userPayload);
        
        console.log('✅ User upserted to Stream:', {
            userId: userData.id,
            appRole: userData.role || 'candidate'
        });
        return true;
    } catch (err) {
        console.error('❌ Failed to upsert Stream user:', userData.id);
        console.error('   Error:', err.message);
        throw new Error(`Stream upsert failed for user ${userData.id}: ${err.message}`);
    }
};

/**
 * Delete user from Stream.io
 * Removes user and all associated data
 * 
 * @param {string} userId - Clerk ID
 */
const deleteStreamUser = async (userId) => {
    try {
        if (!userId) {
            throw new Error('User ID is required');
        }

        console.log('🗑️ Deleting Stream user:', userId);
        await chatClient.deleteUser(userId);
        console.log('✅ User deleted successfully:', userId);
        return true;
    } catch (err) {
        console.error('❌ Failed to delete Stream user:', userId);
        console.error('   Error:', err.message);
        throw new Error(`Stream delete failed for user ${userId}: ${err.message}`);
    }
};

module.exports = {
    chatClient,
    streamClient,
    upsertStreamUser,
    deleteStreamUser
};
