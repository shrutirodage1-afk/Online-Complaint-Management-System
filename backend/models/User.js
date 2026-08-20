const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    department: {
      type: String,
      enum: ["electricity", "road", "water", "others", null],
      default: null
    },
    address: { type: String, default: "" },
    avatar: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Suspended"], default: "Active" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);