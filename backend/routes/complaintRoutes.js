const express = require("express");
const Complaint = require("../models/Complaint");
const { protect, requireRole } = require("../middleware/auth");
const upload = require("../middleware/upload");
const sendEmail = require("../config/email");

const router = express.Router();

function genComplaintId() {
  return "OCMS" + Date.now();
}

// @route  POST /api/complaints
// @desc   Submit a new complaint (logged-in user)
router.post("/", protect, upload.single("image"), async (req, res) => {
  try {
    const { title, category, description, location } = req.body;

    if (!title || !category || !description || !location) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const complaint = await Complaint.create({
      complaintId: genComplaintId(),
      user: req.user._id,
      title,
      category,
      description,
      location,
      image: req.file ? `/uploads/${req.file.filename}` : ""
    });

    res.status(201).json({ success: true, message: "Complaint submitted successfully", complaint });
    await sendEmail(req.user.email, "Complaint Submitted", "Your complaint submitted successfully");
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// @route  GET /api/complaints/mine
// @desc   Get logged-in user's complaints
router.get("/mine", protect, async (req, res) => {
  try {
    const complaints = await Complaint.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// @route  GET /api/complaints/track/:complaintId
// @desc   Track a complaint by its public ID (no auth required)
router.get("/track/:complaintId", async (req, res) => {
  try {
    const complaint = await Complaint.findOne({
      complaintId: new RegExp(`^${req.params.complaintId}$`, "i")
    }).populate("user", "name email");

    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }
    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// @route  GET /api/complaints
// @desc   Get all complaints (admin only)
router.get("/", protect, requireRole("admin"), async (req, res) => {
  try {
    const complaints = await Complaint.find().populate("user", "name email phone").sort({ createdAt: -1 });
    res.json({ success: true, complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// @route  GET /api/complaints/stats
// @desc   Dashboard stats (admin only)
router.get("/stats", protect, requireRole("admin"), async (req, res) => {
  try {
    const [total, pending, inProgress, closed] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: "Pending" }),
      Complaint.countDocuments({ status: "In Progress" }),
      Complaint.countDocuments({ status: "Closed" })
    ]);
    res.json({ success: true, stats: { total, pending, inProgress, closed } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// @route  GET /api/complaints/:id
// @desc   Get single complaint by Mongo _id
router.get("/:id", protect, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id).populate("user", "name email phone");
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }
    if (req.user.role !== "admin" && String(complaint.user._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// @route  PATCH /api/complaints/:id/status
// @desc   Update complaint status (admin only)
// router.patch("/:id/status", protect, requireRole("admin"), async (req, res) => {
//   try {
//     const { status } = req.body;
//     if (!["Pending", "In Progress", "Closed"].includes(status)) {
//       return res.status(400).json({ success: false, message: "Invalid status value" });
//     }

//     const complaint = await Complaint.findOneAndUpdate(
//       { complaintId: req.params.id },
//       { status },
//       { new: true }
//     );

//     if (!complaint) {
//       return res.status(404).json({ success: false, message: "Complaint not found" });
//     }
//     res.json({ success: true, message: "Status updated", complaint });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Server error", error: err.message });
//   }
// });

router.patch("/:id/status", protect, requireRole("admin"), async (req, res) => {
  try {
    const { status } = req.body;

    if (!["Pending", "In Progress", "Closed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value"
      });
    }

    const complaint = await Complaint.findOneAndUpdate(
      { complaintId: req.params.id },
      { status },
      { new: true }
    ).populate("user", "name email");

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found"
      });
    }

    const recipientEmail = complaint.user?.email;
    if (recipientEmail) {
      let subject = "Complaint Status Updated";
      let message = `Hello ${complaint.user?.name || "User"},\n\nYour complaint status has been updated to ${complaint.status}.\n\nThank you,\nOCMS Team`;

      if (complaint.status === "Pending") {
        subject = "Complaint Pending";
        message = `Hello ${complaint.user?.name || "User"},\n\nYour complaint is still pending. Our team will review it soon.\n\nThank you,\nOCMS Team`;
      } else if (complaint.status === "In Progress") {
        subject = "Complaint In Progress";
        message = `Hello ${complaint.user?.name || "User"},\n\nYour complaint is now in progress and our team is working on it.\n\nThank you,\nOCMS Team`;
      } else if (complaint.status === "Closed") {
        subject = "Complaint Solved";
        message = `Hello ${complaint.user?.name || "User"},\n\nYour complaint has been solved and marked as closed.\n\nThank you,\nOCMS Team`;
      }

      try {
        await sendEmail(recipientEmail, subject, message);
      } catch (mailErr) {
        console.error("Failed to send complaint status email:", mailErr.message);
      }
    }

    res.json({
      success: true,
      message: "Status updated",
      complaint
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;
