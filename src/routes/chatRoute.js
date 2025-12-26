const express= require('express');

const router = express.Router();
const {getStreamToken } = require('../controllers/chatController');
const { protectRoute } = require('../middleware/protectRoute');



router.get("/token",protectRoute, getStreamToken);




module.exports = router;