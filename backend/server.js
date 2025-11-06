// =====================================
// 💊 Elevium Backend (Node + Express + MongoDB)
// =====================================

// 1️⃣ Import modules
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import axios from "axios";

// 2️⃣ Initialize app + environment
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// 3️⃣ Middleware
app.use(express.json());
app.use(cors());

// 4️⃣ Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`))
  .catch((err) => console.error(`❌ MongoDB Error: ${err.message}`));

// 5️⃣ Define Schemas
const batchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true },
  drugName: String,
  stage: { type: String, default: "Supplier" },
  status: { type: String, default: "In Progress" },
  createdAt: { type: Date, default: Date.now },
});
const Batch = mongoose.model("Batch", batchSchema);

const eventSchema = new mongoose.Schema({
  batchId: { type: String, required: true },
  actor: { type: String, required: true },
  action: { type: String, required: true },
  notes: String,
  timestamp: { type: Date, default: Date.now },
});
const Event = mongoose.model("Event", eventSchema);

// 6️⃣ Default Route
app.get("/", (req, res) => {
  res.send("💊 Elevium IoT Backend Running ✅");
});

// 7️⃣ API ROUTES
// ==========================

// ✅ Create or Restock Batch
app.post("/api/batches", async (req, res) => {
  try {
    const { batchId, drugName } = req.body;
    if (!batchId || !drugName)
      return res.status(400).json({ message: "Batch ID & Drug name required" });

    let batch = await Batch.findOne({ batchId });

    if (batch) {
      // If already exists, mark as restocked
      batch.status = "Restocked";
      await batch.save();

      await Event.create({
        batchId,
        actor: "Supplier",
        action: "Restocked",
        notes: "Existing batch restocked and ready for dispatch",
      });

      return res.json({ message: "Batch restocked successfully", batch });
    }

    // New batch
    batch = await Batch.create({ batchId, drugName, stage: "Supplier" });

    await Event.create({
      batchId,
      actor: "Supplier",
      action: "Created",
      notes: "New batch shipment initiated",
    });

    res.json({ message: "New batch created", batch });
  } catch (err) {
    console.error("POST /batches error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Update Batch Stage
app.put("/api/batches/:batchId/stage", async (req, res) => {
  try {
    const { batchId } = req.params;
    const { stage, actor } = req.body;

    const batch = await Batch.findOneAndUpdate(
      { batchId },
      { stage },
      { new: true }
    );

    if (!batch)
      return res.status(404).json({ message: "Batch not found" });

    await Event.create({
      batchId,
      actor,
      action: "Stage Updated",
      notes: `Moved to ${stage}`,
    });

    res.json({ success: true, batch });
  } catch (err) {
    console.error("PUT /batches/:batchId/stage error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get All Batches
app.get("/api/batches", async (req, res) => {
  try {
    const batches = await Batch.find().sort({ createdAt: -1 });
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Add Event
app.post("/api/events", async (req, res) => {
  try {
    const event = await Event.create(req.body);
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get All Events
app.get("/api/events", async (req, res) => {
  try {
    const events = await Event.find().sort({ timestamp: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Verify Events by Batch ID
app.get("/api/events/verify/:batchId", async (req, res) => {
  try {
    const events = await Event.find({ batchId: req.params.batchId }).sort({
      timestamp: 1,
    });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ IoT (ThingSpeak Data Fetch)
app.get("/api/iot", async (req, res) => {
  try {
    const channel = process.env.THINGSPEAK_CHANNEL;
    const url = `https://api.thingspeak.com/channels/${channel}/feeds.json?results=10`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching IoT data", error: error.message });
  }
});

// 8️⃣ Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
