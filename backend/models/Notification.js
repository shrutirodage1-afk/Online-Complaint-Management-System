const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    audience: { type: String, enum: ["all", "user", "admin"], default: "all" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
