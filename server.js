const cron = require("node-cron");
require("dotenv").config();
const nodemailer = require("nodemailer");
const express = require("express");
const analyticsData = require("./analyticsData");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;

// API: Generate analytics report for a selected date range
app.get("/api/analytics", (req, res) => {
  const { startDate, endDate } = req.query;

  // Validate dates
  if (!startDate || !endDate) {
    return res.status(400).json({
      error: "Please provide startDate and endDate"
    });
  }

  // Filter data according to date range
  const filteredData = analyticsData.filter((item) => {
    return item.date >= startDate && item.date <= endDate;
  });

  // Calculate summary
  const summary = {
    totalEvents: filteredData.length,

    pageViews: filteredData.filter(
      (item) => item.event === "page_view"
    ).length,

    buttonClicks: filteredData.filter(
      (item) => item.event === "button_click"
    ).length,

    purchases: filteredData.filter(
      (item) => item.event === "purchase"
    ).length
  };

  // Convert summary into CSV format
  const csv = [
    "Metric,Count",
    `Total Events,${summary.totalEvents}`,
    `Page Views,${summary.pageViews}`,
    `Button Clicks,${summary.buttonClicks}`,
    `Purchases,${summary.purchases}`
  ].join("\n");

  // Save CSV file
  const filePath = path.join(__dirname, "weekly-report.csv");
  fs.writeFileSync(filePath, csv, "utf8");

  // Return summary and download link
  res.json({
    message: "Analytics report generated successfully",
    startDate,
    endDate,
    summary,
    downloadUrl: "/api/analytics/download"
  });
});

// API: Download generated CSV report
app.get("/api/analytics/download", (req, res) => {
  const filePath = path.join(__dirname, "weekly-report.csv");

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: "Report not found. Generate the report first."
    });
  }

  res.download(filePath, "weekly-report.csv");
});


app.post("/api/analytics/email", async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS.replace(/\s/g, ""),
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "Weekly Analytics Report",
      text: "Please find the attached dummy analytics report.",
      attachments: [
        {
          filename: "weekly-report.csv",
          path: path.join(__dirname, "weekly-report.csv"),
        },
      ],
    });

    res.json({ message: "Report email sent successfully!" });
  } catch (error) {
    console.error("Email error:", error.message);
    res.status(500).json({ message: "Failed to send email." });
  }
});


cron.schedule(
  "0 9 * * 1",
  async () => {
    try {
      console.log("Starting weekly analytics report...");

      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      const endDate = new Date(`${today}T00:00:00Z`);
      const startDate = new Date(endDate);
      startDate.setUTCDate(startDate.getUTCDate() - 6);

      const formatDate = (date) => date.toISOString().slice(0, 10);

      const start = formatDate(startDate);
      const end = today;

      const reportResponse = await fetch(
        `http://localhost:3001/api/analytics?startDate=${start}&endDate=${end}`
      );

      if (!reportResponse.ok) {
        throw new Error("Report generation failed");
      }

      const emailResponse = await fetch(
        "http://localhost:3001/api/analytics/email",
        { method: "POST" }
      );

      if (!emailResponse.ok) {
        throw new Error("Email sending failed");
      }

      console.log("Weekly report generated and emailed successfully!");
    } catch (error) {
      console.error("Weekly report error:", error.message);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);

console.log("Weekly scheduler registered: Every Monday at 9:00 AM IST");

// Start backend server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
