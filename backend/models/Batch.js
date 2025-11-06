import mongoose from "mongoose";

const batchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true },
  drugName: { type: String },
  stage: { type: String, default: "Supplier" },
  status: { type: String, default: "In Progress" },
  createdAt: { type: Date, default: Date.now }
});

const Batch = mongoose.model("Batch", batchSchema);
export default Batch;
