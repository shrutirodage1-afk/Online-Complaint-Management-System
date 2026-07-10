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
      enum: ["Pending", "In Progress", "Closed"],
      default: "Pending"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Complaint", complaintSchema);
