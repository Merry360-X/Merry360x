import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { generateFounderWelcomeEmailHtml } from "../lib/email-template-kit.js";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const targetEmail = "ocb04@yahoo.com";
const targetName = "Explorer";

if (!BREVO_API_KEY) {
  console.error("Error: BREVO_API_KEY is not defined in .env");
  process.exit(1);
}

const htmlContent = generateFounderWelcomeEmailHtml({
  firstName: "Valued Traveler",
  name: "Valued Traveler",
  email: targetEmail,
});

console.log("Preparing to send Founder Welcome Email to:", targetEmail);

const payload = {
  sender: {
    name: "Founder @ Merry360X",
    email: "support@merry360x.com",
  },
  to: [
    {
      email: targetEmail,
      name: targetName,
    },
  ],
  subject: "A Personal Note From Our Founder ✨",
  htmlContent,
  tags: ["test", "founder-welcome-email"],
};

async function send() {
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok) {
      console.log("SUCCESS! Email sent successfully. Message ID:", data.messageId);
    } else {
      console.error("FAILED to send email:", res.status, data);
    }
  } catch (err) {
    console.error("Network or execution error:", err);
  }
}

send();
