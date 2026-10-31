// One GPS reading from a tourist (browser GPS or the simulator). Gives us the movement history.
const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [longitude, latitude]
  },
  // Zone the tourist was inside at this moment (filled by the geo-fence service in Stage 3)
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
  zoneType: { type: String, enum: ['red', 'yellow', 'green', 'none'], default: 'none' },
  source: { type: String, enum: ['gps', 'simulator'], default: 'gps' },
  timestamp: { type: Date, default: Date.now },
});

// Fast lookup of "latest locations of this tourist"
locationSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Location', locationSchema);
