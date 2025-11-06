import express from "express";
import axios from "axios";
const router = express.Router();

// Fetch latest ThingSpeak IoT data
router.get("/", async (req, res) => {
  try {
    const channel = process.env.THINGSPEAK_CHANNEL;
    const url = `https://api.thingspeak.com/channels/${channel}/feeds.json?results=10`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: "Error fetching IoT data" });
  }
});

export default router;
