const express = require("express");
const User = require("../models/User");
const { protect, requireRole } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    department: user.department,
    address: user.address,
    avatar: user.avatar,
    status: user.status,
    createdAt: user.createdAt
  };
}

// @route  GET /api/users/profile
// @desc   Get logged-in user's profile
router.get("/profile", protect, async (req, res) => {
  res.json({ success: true, user: sanitizeUser(req.user) });
});

// @route  PUT /api/users/profile
// @desc   Update logged-in user's profile (incl. avatar upload)
router.put("/profile", protect, upload.single("avatar"), async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email.toLowerCase();
    if (phone) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (req.file) updates.avatar = `/uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, message: "Profile updated successfully", user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// @route  GET /api/users
// @desc   Get all registered users (admin only)
router.get("/", protect, requireRole("admin"), async (req, res) => {
  try {
    const users = await User.find({ role: "user" }).sort({ createdAt: -1 });
    res.json({ success: true, users: users.map(sanitizeUser) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// @route  DELETE /api/users/:id
// @desc   Delete a user (admin only)
router.delete("/:id", protect, requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;
