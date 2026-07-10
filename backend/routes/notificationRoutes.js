const express = require("express");
const Notification = require("../models/Notification");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

// @route  GET /api/notifications
// @desc   Get notifications visible to the logged-in user
router.get("/", protect, async (req, res) => {
  try {
    const audience = req.user.role === "admin" ? ["all", "admin"] : ["all", "user"];
    const notifications = await Notification.find({ audience: { $in: audience } }).sort({ createdAt: -1 });
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// @route  POST /api/notifications
// @desc   Send a notification (admin only)
router.post("/", protect, requireRole("admin"), async (req, res) => {
  try {
    const { message, audience } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }
    const notification = await Notification.create({
      message,
      audience: audience || "all",
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, message: "Notification sent successfully", notification });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;
