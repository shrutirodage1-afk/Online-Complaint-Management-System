const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    complaintId: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ["Water Issue", "Electricity", "Road Problem", "Others"]
    },
    description: { type: String, required: true },
    location: { type: String, required: true },
    image: { type: String, default: "" }, // stored file path, served statically
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Closed", "Reopened", "Fake"],
      default: "Pending"
    },

    // --- Proof passcode: generated when a complaint is marked Closed,
    // proves to the citizen that the issue was actually resolved. ---
    resolutionCode: { type: String, default: "" },

    // --- User rating & reopen feature ---
    rating: { type: Number, min: 1, max: 5 },
    ratingFeedback: { type: String, default: "" },
    reopenReason: { type: String, default: "" },
    reopenCount: { type: Number, default: 0 },

    // --- Fake complaint handling ---
    isFake: { type: Boolean, default: false },
    fakeReason: { type: String, default: "" },
    fakeMarkedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    fakeMarkedAt: { type: Date, default: null },
    punishmentApplied: { type: String, default: "" },

    // --- Duplicate complaint detection bookkeeping ---
    isPossibleDuplicate: { type: Boolean, default: false },
    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Complaint", complaintSchema);
