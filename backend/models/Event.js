import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  batchId: { type: String, required: true },
  actor: { type: String, required: true },
  action: { type: String, required: true },
  notes: { type: String },
  timestamp: { type: Date, default: Date.now }
});

const Event = mongoose.model("Event", eventSchema);
export default Event;
