const dns = require('dns');
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const mongoose = require("mongoose");

async function connectDB() {
 const uri = process.env.MONGO_URI || "mongodb+srv://Shruti:SHRUTI17@cluster0.nildp3d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

  try {
    await mongoose.connect(uri);
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
