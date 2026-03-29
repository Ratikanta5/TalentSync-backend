const { chatClient, streamClient, upsertStreamUser } = require("../config/stream/stream");

module.exports.getStreamToken = async (req, res) => {
    try {
        // Use clerkId for Stream (not MongoDB _id) - must match Stream dashboard
        const userId = req.user?.clerkId;
        const userName = req.user?.name;
        const userImage = req.user?.profileImage || req.user?.avatar;
        const userRole = req.user?.role;

        console.log('🔑 Generating Stream tokens for user:', {
          userId,
          userName,
          userRole: userRole || 'unknown',
          hasImage: !!userImage
        });

        if (!userId || !userName) {
            console.error('❌ Missing user data:', { userId, userName, userImage });
            return res.status(400).json({
                message: "Missing user data",
                error: "User ID or name not available"
            });
        }

        // ✅ STEP 1: Upsert user to Stream.io (create or update user)
        // CRITICAL: Do this before generating tokens to ensure user exists in Stream
        console.log('👤 Upserting user to Stream with role:', userRole);
        try {
          await upsertStreamUser({
              id: userId,
              name: userName,
              image: userImage,
              role: userRole
          });
          console.log('✅ User upserted to Stream successfully');
        } catch (upsertErr) {
          console.error('❌ Upsert error (continuing anyway):', upsertErr.message);
        }

        // ✅ STEP 2: Generate CHAT token (for Stream Chat SDK)
        console.log('💬 Generating chat token...');
        let chatToken;
        try {
            chatToken = chatClient.createToken(userId);
            console.log('✅ Chat token generated:', chatToken ? `${chatToken.substring(0, 20)}...` : 'EMPTY');
        } catch (tokenErr) {
            console.error('❌ Failed to create chat token:', tokenErr.message);
            throw new Error(`Chat token generation failed: ${tokenErr.message}`);
        }

        if (!chatToken) {
            console.error('❌ Chat token is empty/undefined');
            throw new Error('Chat token generation returned empty result');
        }

        // ✅ STEP 3: Generate VIDEO token (for Stream Video SDK)
        // Must grant access to all calls with proper permissions
        console.log('📞 Generating video token for user:', userId);
        let videoToken;
        try {
            // Generate video token with all required metadata
            const videoTokenConfig = {
                user_id: userId,
                call_cids: ["default/*"], // Allow joining any call in "default" type
            };
            
            // Add role if available for permission-based access
            if (userRole && userRole !== 'candidate') {
                videoTokenConfig.role = userRole || 'user';
            }
            
            console.log('🔐 Video token config:', {
              user_id: videoTokenConfig.user_id,
              call_cids: videoTokenConfig.call_cids,
              role: videoTokenConfig.role || 'default'
            });
            
            videoToken = streamClient.generateCallToken(videoTokenConfig);
            
            if (!videoToken || typeof videoToken !== 'string') {
                throw new Error(`Invalid token returned: ${typeof videoToken}`);
            }
            
            console.log('✅ Video token generated successfully');
            console.log('📊 Token preview:', {
              length: videoToken.length,
              prefix: videoToken.substring(0, 30),
              isBase64: /^[A-Za-z0-9+/=]+$/.test(videoToken.substring(0, 20))
            });
        } catch (videoErr) {
            console.error('❌ Failed to generate video token:', {
              message: videoErr.message,
              userId: userId,
              stack: videoErr.stack
            });
            throw new Error(`Video token generation failed: ${videoErr.message}`);
        }

        console.log('🎉 All tokens generated successfully');
        
        const response = {
            token: chatToken,
            videoToken: videoToken,
            userId: userId,
            userName: userName,
            userImage: userImage
        };
        
        console.log('📤 Sending token response:', {
            hasChatToken: !!response.token,
            hasVideoToken: !!response.videoToken,
            userId: response.userId,
            userName: response.userName
        });
        
        res.status(200).json(response);
    } catch (err) {
        console.error('❌ Error in getStreamToken:', err.message);
        console.error('Stack:', err.stack);
        res.status(500).json({
            message: "Failed to generate Stream tokens",
            error: err.message
        });
    }
};