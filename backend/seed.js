/**
 * seed.js
 * -----------------------------------------------------------------
 * One-time script to insert the 4 department admin accounts into
 * MongoDB with properly bcrypt-hashed passwords, matching the real
 * User schema (role: "admin", department: "<dept>").
 *
 * Run this once from your project root:
 *   node seed.js
 *
 * Safe to re-run: existing admins (matched by email) are skipped,
 * not duplicated or overwritten.
 * -----------------------------------------------------------------
 */

require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");
const User = require("./models/User");

const departmentAdmins = [
    {
        name: "Electricity Department Admin",
        email: "shruu17@gmail.com",
        phone: "9999900001",
        password: "1217",
        department: "electricity"
    },
    {
        name: "Road Department Admin",
        email: "bharii15@gmail.com",
        phone: "9999900002",
        password: "2008",
        department: "road"
    },
    {
        name: "Water Department Admin",
        email: "sau26@gmail.com",
        phone: "9999900003",
        password: "2612",
        department: "water"
    },
    {
        name: "Others Department Admin",
        email: "sanika29@gmail.com",
        phone: "9999900004",
        password: "2912",
        department: "others"
    }
];

async function seed() {
    await connectDB();

    console.log("\n🌱 Seeding department admin accounts...\n");

    for (const admin of departmentAdmins) {
        const existing = await User.findOne({ email: admin.email });

        if (existing) {
            console.log(`⏭  Skipped (already exists): ${admin.email}`);
            continue;
        }

        const hashedPassword = await bcrypt.hash(admin.password, 10);

        await User.create({
            name: admin.name,
            email: admin.email,
            phone: admin.phone,
            password: hashedPassword,
            role: "admin",
            department: admin.department
        });

        console.log(`✅ Created admin: ${admin.email}  (department: ${admin.department})`);
    }

    console.log("\n🌱 Seeding complete.\n");
    process.exit(0);
}

seed().catch((err) => {
    console.error("❌ Seeding failed:", err.message);
    process.exit(1);
});