const sendEmail = require("../config/email");

await sendEmail(
    complaint.email,
    "Complaint Status Updated",
    `Hello ${complaint.name},

Your complaint status has been changed to:

${complaint.status}

Thank you.
OCMS Team`
);