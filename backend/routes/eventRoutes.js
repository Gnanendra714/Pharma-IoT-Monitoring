import express from "express";
import Event from "../models/Event.js";
const router = express.Router();

// Add new event (ledger)
router.post("/", async (req, res) => {
  try {
    const event = await Event.create(req.body);
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all events (FDA ledger view)
router.get("/", async (req, res) => {
  const events = await Event.find().sort({ timestamp: -1 });
  res.json(events);
});

// Verify batch (Patient)
router.get("/verify/:batchId", async (req, res) => {
  const events = await Event.find({ batchId: req.params.batchId }).sort({ timestamp: 1 });
  res.json(events);
});

export default router;
