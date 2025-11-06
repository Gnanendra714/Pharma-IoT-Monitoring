import express from "express";
import Batch from "../models/Batch.js";
import Event from "../models/Event.js";
const router = express.Router();

// Create new batch (Supplier)
router.post("/", async (req, res) => {
  try {
    const { batchId, drugName } = req.body;
    const exists = await Batch.findOne({ batchId });
    if (exists) return res.status(400).json({ message: "Batch already exists" });

    const batch = await Batch.create({ batchId, drugName });
    await Event.create({ batchId, actor: "Supplier", action: "Created", notes: "Shipment started" });
    res.json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update stage (next stakeholder)
router.put("/:batchId/stage", async (req, res) => {
  try {
    const { batchId } = req.params;
    const { stage, actor } = req.body;

    const batch = await Batch.findOneAndUpdate({ batchId }, { stage }, { new: true });
    if (!batch) return res.status(404).json({ message: "Batch not found" });

    await Event.create({ batchId, actor, action: "Stage Update", notes: `Moved to ${stage}` });
    res.json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all batches
router.get("/", async (req, res) => {
  const batches = await Batch.find();
  res.json(batches);
});

export default router;
