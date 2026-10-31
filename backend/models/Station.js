// Police station or hospital. Stored as a GeoJSON Point so we can find the nearest one with $near (Stage 6).
const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['police', 'hospital'], required: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [longitude, latitude]
  },
});

// $near only works when this 2dsphere index exists
stationSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Station', stationSchema);
