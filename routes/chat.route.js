// Backend/routes/chat.route.js
const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// POST /api/chat — Send message to AI agent
router.post("/", verifyToken, chatController.sendMessage);

// POST /api/chat/reset — Clear conversation history
router.post("/reset", verifyToken, chatController.resetConversation);

module.exports = router;
