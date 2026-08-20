const express = require("express");
const Complaint = require("../models/Complaint");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { protect, requireRole } = require("../middleware/auth");
const upload = require("../middleware/upload");
const sendEmail = require("../config/email");

const router = express.Router();

function genComplaintId() {
  return "OCMS" + Date.now();
}

// ---------------------------------------------------------------
// Feature: Proof passcode — generated once a complaint is marked
// "Closed", so the citizen has proof their issue was resolved.
// ---------------------------------------------------------------
function generateResolutionCode() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PRF-${part()}-${part()}`;
}

// ---------------------------------------------------------------
// Feature: Duplicate complaint detector — before a new complaint is
// created, look for an existing (not-yet-closed) complaint in the
// same category whose location/title/description are very similar.
// Pure text heuristic, no extra dependency needed.
// ---------------------------------------------------------------
function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function similarity(textA, textB) {
  const setA = new Set(tokenize(textA));
  const setB = new Set(tokenize(textB));
  if (!setA.size || !setB.size) return 0;
  let common = 0;
  setA.forEach((word) => {
    if (setB.has(word)) common++;
  });
  return common / Math.max(setA.size, setB.size);
}

async function findPossibleDuplicate({ category, location, title, description }) {
  const candidates = await Complaint.find({
    category,
    status: { $ne: "Closed" }
  })
    .select("complaintId title description location status createdAt")
    .limit(200)
    .lean();

  let best = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const locationScore = similarity(location, candidate.location);
    const textScore = similarity(`${title} ${description}`, `${candidate.title} ${candidate.description}`);
    const combined = locationScore * 0.4 + textScore * 0.6;

    if (combined > bestScore) {
      bestScore = combined;
      best = candidate;
    }
  }

  const DUPLICATE_THRESHOLD = 0.45;
  return bestScore >= DUPLICATE_THRESHOLD ? { complaint: best, score: bestScore } : null;
}

// @route  POST /api/complaints
// @desc   Submit a new complaint (logged-in user)
router.post("/", protect, upload.single("image"), async (req, res) => {
  try {
    const { title, category, description, location, force } = req.body;

    if (!title || !category || !description || !location) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // --- Duplicate complaint detector ---
    // Unless the user has explicitly confirmed they want to submit anyway
    // (force=true), warn them instead of silently creating a near-duplicate.
    let duplicateMatch = null;
    if (String(force).toLowerCase() !== "true") {
      duplicateMatch = await findPossibleDuplicate({ category, location, title, description });
      if (duplicateMatch) {
        return res.status(409).json({
          success: false,
          duplicate: true,
          message: "A similar complaint appears to already be registered nearby.",
          similarity: Math.round(duplicateMatch.score * 100),
          existingComplaint: {
            complaintId: duplicateMatch.complaint.complaintId,
            title: duplicateMatch.complaint.title,
            status: duplicateMatch.complaint.status,
            location: duplicateMatch.complaint.location,
            createdAt: duplicateMatch.complaint.createdAt
          }
        });
      }
    }

    const complaint = await Complaint.create({
      complaintId: genComplaintId(),
      user: req.user._id,
      title,
      category,
      description,
      location,
      image: req.file ? `/uploads/${req.file.filename}` : "",
      isPossibleDuplicate: String(force).toLowerCase() === "true"
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

    if (!["Pending", "In Progress", "Closed", "Reopened", "Fake"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value"
      });
    }

    const complaint = await Complaint.findOne({ complaintId: req.params.id }).populate("user", "name email");
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found"
      });
    }

    complaint.status = status;
    complaint.isFake = status === "Fake";
    if (status === "Closed") {
      complaint.resolutionCode = generateResolutionCode();
    } else if (status !== "Fake") {
      complaint.resolutionCode = "";
    }

    if (status === "Fake") {
      complaint.fakeReason = complaint.fakeReason || "Marked by department admin";
      complaint.fakeMarkedBy = req.user._id;
      complaint.fakeMarkedAt = new Date();
      complaint.punishmentApplied = "";
    }

    await complaint.save();

    res.json({
      success: true,
      message: "Status updated",
      complaint
    });

    try {
      if (complaint.user && complaint.user.email) {
        if (complaint.status === "Closed") {
          await sendEmail(
            complaint.user.email,
            "Complaint Resolved",
            `Your complaint is resolved.\n\nProof passcode (keep this as confirmation of resolution): ${complaint.resolutionCode}`
          );
        } else {
          await sendEmail(complaint.user.email, "Complaint Status Updated", `Your complaint status is ${complaint.status}`);
        }
      }
    } catch (emailErr) {
      console.error("Status email failed:", emailErr.message);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// @route  PATCH /api/complaints/:id/fake
// @desc   Mark a complaint as fake and optionally suspend the user
router.patch("/:id/fake", protect, requireRole("admin"), async (req, res) => {
  try {
    const { reason, punishUser } = req.body;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: "A reason is required" });
    }

    const complaint = await Complaint.findOne({ complaintId: req.params.id }).populate("user", "name email status");
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    complaint.status = "Fake";
    complaint.isFake = true;
    complaint.fakeReason = String(reason).trim();
    complaint.fakeMarkedBy = req.user._id;
    complaint.fakeMarkedAt = new Date();
    complaint.punishmentApplied = punishUser ? "Suspended" : "";
    complaint.resolutionCode = "";

    if (punishUser && complaint.user) {
      await User.findByIdAndUpdate(complaint.user._id, { status: "Suspended" });
    }

    await complaint.save();

    const punishmentText = punishUser ? " This account has been suspended." : " No further punishment was applied.";
    const notificationMessage = `Your complaint ${complaint.complaintId} was marked as fake by the admin. Reason: ${complaint.fakeReason}.${punishmentText}`;

    await Notification.create({
      message: notificationMessage,
      audience: "user",
      recipient: complaint.user ? complaint.user._id : null,
      createdBy: req.user._id
    });

    try {
      if (complaint.user && complaint.user.email) {
        await sendEmail(complaint.user.email, "Complaint Marked as Fake", notificationMessage);
      }
    } catch (emailErr) {
      console.error("Fake complaint email failed:", emailErr.message);
    }

    res.json({
      success: true,
      message: punishUser ? "Complaint marked as fake and the user account was suspended." : "Complaint marked as fake.",
      complaint
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  POST /api/complaints/:id/rating
// @desc   Feature: User rating — citizen rates a resolved (Closed) complaint
router.post("/:id/rating", protect, async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    const stars = Number(rating);

    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    }

    const complaint = await Complaint.findOne({ complaintId: req.params.id });
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }
    if (String(complaint.user) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    if (complaint.status !== "Closed") {
      return res.status(400).json({ success: false, message: "You can rate a complaint only after it is resolved" });
    }

    complaint.rating = stars;
    complaint.ratingFeedback = feedback || "";
    await complaint.save();

    res.json({ success: true, message: "Thanks for rating our service!", complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// @route  POST /api/complaints/:id/reopen
// @desc   Feature: Reopen — citizen reopens a resolved complaint they're unhappy with
router.post("/:id/reopen", protect, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: "Please provide a reason to reopen the complaint" });
    }

    const complaint = await Complaint.findOne({ complaintId: req.params.id });
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }
    if (String(complaint.user) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    if (complaint.status !== "Closed") {
      return res.status(400).json({ success: false, message: "Only resolved complaints can be reopened" });
    }

    complaint.status = "Reopened";
    complaint.reopenReason = String(reason).trim();
    complaint.reopenCount = (complaint.reopenCount || 0) + 1;
    complaint.resolutionCode = "";
    complaint.rating = undefined;
    complaint.ratingFeedback = "";
    await complaint.save();

    res.json({ success: true, message: "Complaint reopened. Our team will review it again.", complaint });

    try {
      await sendEmail(
        req.user.email,
        "Complaint Reopened",
        `Your complaint ${complaint.complaintId} has been reopened.\n\nReason: ${complaint.reopenReason}`
      );
    } catch (emailErr) {
      console.error("Reopen email failed:", emailErr.message);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;
