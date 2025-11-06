// =====================================
// 💊 Elevium Backend (Full Feature Version)
// Includes: Restock + Export + Clear + Distributor→Pharmacy
// =====================================

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import axios from "axios";
import ExcelJS from "exceljs"; // ✅ Import once only

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

// 🧠 MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, { dbName: "pharma_iot" })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// =====================================
// 📦 Schemas
// =====================================
const batchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true },
  drugName: String,
  stage: { type: String, default: "Supplier" },
  status: { type: String, default: "In Progress" },
  createdAt: { type: Date, default: Date.now },
});
const Batch = mongoose.model("Batch", batchSchema);

const eventSchema = new mongoose.Schema({
  batchId: String,
  actor: String,
  action: String,
  notes: String,
  timestamp: { type: Date, default: Date.now },
});
const Event = mongoose.model("Event", eventSchema);

// =====================================
// 🌍 Default Route
// =====================================
app.get("/", (req, res) => res.send("💊 Elevium IoT Backend Running ✅"));

// =====================================
// 📦 Create or Restock Batch
// =====================================
app.post("/api/batches", async (req, res) => {
  try {
    const { batchId, drugName } = req.body;
    if (!batchId || !drugName)
      return res.status(400).json({ message: "Batch ID & Drug name required" });

    let batch = await Batch.findOne({ batchId });

    if (batch) {
      // 🔁 Restock
      batch.stage = "Supplier";
      batch.status = "Restocked";
      await batch.save();

      await Event.create({
        batchId,
        actor: "Supplier",
        action: "Restocked",
        notes: "Existing batch restocked and ready",
      });

      return res.json({ message: "Batch restocked successfully", batch });
    }

    // 🆕 Create new
    batch = await Batch.create({ batchId, drugName, stage: "Supplier" });
    await Event.create({
      batchId,
      actor: "Supplier",
      action: "Created",
      notes: "New shipment created",
    });

    res.json({ message: "New batch created successfully", batch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================
// 🏭 Update Stage
// =====================================
app.put("/api/batches/:batchId/stage", async (req, res) => {
  try {
    const { batchId } = req.params;
    const { stage, actor } = req.body;

    const batch = await Batch.findOneAndUpdate({ batchId }, { stage }, { new: true });
    if (!batch) return res.status(404).json({ message: "Batch not found" });

    await Event.create({
      batchId,
      actor,
      action: "Stage Updated",
      notes: `Moved to ${stage}`,
    });

    res.json({ success: true, batch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================
// 🧾 Get all batches
// =====================================
app.get("/api/batches", async (req, res) => {
  const batches = await Batch.find().sort({ createdAt: -1 });
  res.json(batches);
});

// =====================================
// 🧾 Events
// =====================================
app.post("/api/events", async (req, res) => {
  const event = await Event.create(req.body);
  res.json(event);
});

app.get("/api/events", async (req, res) => {
  const events = await Event.find().sort({ timestamp: -1 });
  res.json(events);
});

app.get("/api/events/verify/:batchId", async (req, res) => {
  const events = await Event.find({ batchId: req.params.batchId }).sort({ timestamp: 1 });
  res.json(events);
});

// =====================================
// 🧠 IoT Feed from ThingSpeak
// =====================================
app.get("/api/iot", async (req, res) => {
  try {
    const ch = process.env.THINGSPEAK_CHANNEL;
    const { data } = await axios.get(
      `https://api.thingspeak.com/channels/${ch}/feeds.json?results=10`
    );
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =====================================
// 🗑️ Clear All Data
// =====================================
app.delete("/api/clear", async (req, res) => {
  await Batch.deleteMany();
  await Event.deleteMany();
  res.json({ message: "All data cleared from MongoDB ✅" });
});

// =====================================
// 📤 EXPORT DATA TO EXCEL (All Rows)
// =====================================
app.get("/api/export", async (req, res) => {
  try {
    console.log("📥 Export route triggered...");

    const batches = await Batch.find().sort({ createdAt: -1 });
    const events = await Event.find().sort({ timestamp: -1 });

    if (!batches.length && !events.length) {
      return res.status(400).json({ message: "No data to export" });
    }

    const workbook = new ExcelJS.Workbook();

    // ---------------- BATCHES SHEET ----------------
    const batchSheet = workbook.addWorksheet("Batches");
    batchSheet.columns = [
      { header: "Batch ID", key: "batchId", width: 20 },
      { header: "Drug Name", key: "drugName", width: 25 },
      { header: "Stage", key: "stage", width: 20 },
      { header: "Status", key: "status", width: 20 },
      { header: "Created At", key: "createdAt", width: 25 },
    ];

    batchSheet.getRow(1).font = { bold: true };
    batches.forEach((b) => batchSheet.addRow(b.toObject()));

    // ---------------- EVENTS SHEET ----------------
    const eventSheet = workbook.addWorksheet("Events");
    eventSheet.columns = [
      { header: "Batch ID", key: "batchId", width: 20 },
      { header: "Actor", key: "actor", width: 20 },
      { header: "Action", key: "action", width: 25 },
      { header: "Notes", key: "notes", width: 30 },
      { header: "Timestamp", key: "timestamp", width: 25 },
    ];

    eventSheet.getRow(1).font = { bold: true };
    events.forEach((e) => eventSheet.addRow(e.toObject()));

    // ---------------- STYLING ----------------
    [batchSheet, eventSheet].forEach((sheet) => {
      sheet.columns.forEach((col) => {
        col.alignment = { vertical: "middle", horizontal: "left" };
      });
    });

    // ---------------- SEND TO CLIENT ----------------
    const filename = `Pharma_Export_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

    console.log("✅ Excel export completed successfully.");
  } catch (err) {
    console.error("❌ Export error:", err);
    res.status(500).json({ message: "Export failed", error: err.message });
  }
});

// =====================================
// 🚀 Start Server
// =====================================
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
