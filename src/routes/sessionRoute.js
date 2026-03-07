const express = require('express');
const { protectRoute } = require('../middleware/protectRoute');
const { createSession, getActiveSessions, getMyRecentSessions, getSessionById, joinSession, endSession, removeParticipant } = require('../controllers/sessionController');
const router = express.Router();


router.post("/", protectRoute, createSession);
router.get("/active", protectRoute, getActiveSessions);
router.get("/my-recent", protectRoute, getMyRecentSessions);


router.get("/:id", protectRoute, getSessionById);
router.post("/:id/join", protectRoute, joinSession);
router.post("/:id/remove-participant", protectRoute, removeParticipant);
router.post("/:id/end", protectRoute, endSession);


module.exports = router;