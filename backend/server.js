const dns = require('dns');
dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const complaintRoutes = require("./routes/complaintRoutes");
const userRoutes = require("./routes/userRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const OpenAI = require('openai');

const jwt = require("jsonwebtoken");
const Complaint = require("./models/Complaint");

const app = express();

// --- Core middleware ---
app.use(cors({
  origin: "https://online-complaint-management-system-alpha.vercel.app",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images (complaint photos, avatars)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- API routes ---
app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "OCMC API is running" });
});

const client = new OpenAI({
  apiKey: process.env.GROQ_AI_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const OCMS_SYSTEM_PROMPT = `You are the OCMS (Online Complaint Management System) support assistant.

ABOUT OCMS:
OCMS lets citizens report civic issues and track their resolution.
- Complaint categories: Water Issue, Electricity, Road Problem, Others.
- Complaint statuses: Pending → In Progress → Closed.
- Each complaint has a unique complaintId (e.g. OCMS1728394829), title, description, category, location, and optional photo.
- Users register/login, submit complaints from "Submit Complaint", and view their own complaints under "My Complaints".
- Anyone (even without login) can track a complaint's status via its complaintId on the "Track Complaint" page.
- Admins log in separately (admin portal) to view all complaints, see stats, and update complaint status. When a complaint is marked "Closed" or its status changes, the user gets an email notification.

HOW-TO GUIDES:
- File a complaint: Login → "Submit Complaint" → fill title, category, description, location, optional photo → Submit.
- Check status: Login → "My Complaints", OR use "Track Complaint" with your complaint ID (no login needed).
- Edit/cancel a complaint: not currently supported after submission — contact admin.
- Forgot password: Login page → "Forgot Password".

YOUR ROLE:
- Answer questions about how OCMS works and how to use it.
- If the user's own complaint data is provided below, use it to answer accurately (status, count, category, dates). Never invent complaint data that isn't provided.
- If no complaint data is provided and they ask about "my complaints", tell them to make sure they're logged in.
- If asked something unrelated to OCMS (general trivia, coding, other topics), politely say: "I'm here to help with OCMS-related questions."
- Keep answers short and friendly.`;

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    let contextBlock = "";

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const complaints = await Complaint.find({ user: decoded.id })
          .sort({ createdAt: -1 })
          .limit(10)
          .select("complaintId title status category createdAt");

        contextBlock = complaints.length
          ? `\n\nCURRENT USER'S COMPLAINTS (most recent 10):\n${JSON.stringify(complaints, null, 2)}`
          : `\n\nCURRENT USER: logged in, no complaints filed yet.`;
      } catch (e) {
        // expired/invalid token — treat as guest
      }
    }

    const messages = [
      { role: "system", content: OCMS_SYSTEM_PROMPT + contextBlock },
      ...(Array.isArray(history) ? history : []),
      { role: "user", content: message },
    ];

    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.3,
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Something went wrong. Please try again." });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error"
  });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 OCMC backend running on http://localhost:${PORT}`);
  });
});
