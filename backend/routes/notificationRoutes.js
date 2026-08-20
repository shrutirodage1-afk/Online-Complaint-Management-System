const express = require("express");
const Notification = require("../models/Notification");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

// @route  GET /api/notifications
// @desc   Get notifications visible to the logged-in user
router.get("/", protect, async (req, res) => {
  try {
    const audience = req.user.role === "admin" ? ["all", "admin"] : ["all", "user"];
    const query = { audience: { $in: audience } };

    if (req.user.role !== "admin") {
      query.$or = [{ recipient: null }, { recipient: req.user._id }];
    }

    const notifications = await Notification.find(query).sort({ createdAt: -1 });
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// @route  POST /api/notifications
// @desc   Send a notification (admin only)
router.post("/", protect, requireRole("admin"), async (req, res) => {
  try {
    const { message, audience, recipient } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    const normalizedAudience = (() => {
      const value = String(audience || "all").toLowerCase();
      if (["active_all", "all"].includes(value)) return "all";
      if (["active_users", "loggedin", "logged", "logged-in", "user", "users"].includes(value)) return "user";
      if (["active_staff", "admin", "staff"].includes(value)) return "admin";
      return "all";
    })();

    const notification = await Notification.create({
      message,
      audience: normalizedAudience,
      recipient: recipient || null,
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, message: "Notification sent successfully", notification });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;
