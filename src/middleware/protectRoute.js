const { requireAuth } = require('@clerk/express');
const { User } = require('../models/User');


//if we do within an array when we call this protectRoute middleware in an api endpoint in server first it run the array first element which is requireAuth() then it run its another element whichs is a async function , not required write 2 things as middleware in endpoints in server.
module.exports.protectRoute = [
    requireAuth(), //this is for checking the user is login or not

    async (req, res, next) => { //
        try {
            const clerkId = req.auth().userId; //if we are login this check your details who you are and store you in req.user;
            if (!clerkId) return res.status(401).json({ msg: "unauthorized: invalid token" })

            //find user  in db by clerkId
            const user = await user.findOne({ clerkId });

            if (!user) return res.status(404).json({ msg: "user not found" });

            req.user = user;
            next();
        }
        catch (err) {
            console.error("Error in protectRoute middleware", err);
            res.status(500).json({ msg: "Internal Server error" })
        }
    }
]