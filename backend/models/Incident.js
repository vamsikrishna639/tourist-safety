// An incident (mainly SOS). Status flow: Reported -> Assigned -> Resolved (Stage 4).
const mongoose = require('mongoose');

const STATUSES = ['Reported', 'Assigned', 'Resolved'];

const incidentSchema = new mongoose.Schema(
  {
    touristId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['SOS', 'ZONE_ALERT', 'ANOMALY'], default: 'SOS' },
    message: { type: String, trim: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    status: { type: String, enum: STATUSES, default: 'Reported' },
    assignedTo: { type: String, trim: true }, // officer or unit name
    nearestStation: { type: mongoose.Schema.Types.ObjectId, ref: 'Station' },
    // Audit trail of every status change
    history: [
      {
        status: { type: String, enum: STATUSES },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
    // Blockchain proof: hash of the latest state logged on chain + its transaction (null if the chain was down)
    chainHash: String,
    chainTxHash: String,
    chainLoggedAt: Date,
  },
  { timestamps: true }
);

// Fast "my incidents, newest first" and "all open incidents" queries
incidentSchema.index({ touristId: 1, createdAt: -1 });
incidentSchema.index({ status: 1, createdAt: -1 });

incidentSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Incident', incidentSchema);
