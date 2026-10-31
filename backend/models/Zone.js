// Geo-fence zone drawn by the admin. Stored as a GeoJSON Polygon.
const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // red = restricted, yellow = caution, green = safe
    type: { type: String, enum: ['red', 'yellow', 'green'], required: true },
    description: { type: String, trim: true },
    geometry: {
      type: { type: String, enum: ['Polygon'], default: 'Polygon' },
      // GeoJSON order is [longitude, latitude]. The first and last point must be the same (closed ring).
      coordinates: { type: [[[Number]]], required: true },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Lets MongoDB validate the polygon and run geo queries. The point-in-zone check itself uses Turf.js (Stage 3).
zoneSchema.index({ geometry: '2dsphere' });

module.exports = mongoose.model('Zone', zoneSchema);
