// User = a Tourist or an Admin/Police officer (one collection, told apart by "role").
const mongoose = require('mongoose');

// Tourist-only fields use this so admins can be saved without them
const requiredForTourist = function () {
  return this.role === 'tourist';
};

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // bcrypt hash, never the plain password. select:false = not returned by queries unless asked for.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['tourist', 'admin'], default: 'tourist' },
    phone: { type: String, trim: true },

    // ----- Tourist details (kept off-chain, in MongoDB only) -----
    govtId: { type: String, trim: true, required: requiredForTourist }, // passport / Aadhaar number
    nationality: { type: String, trim: true },
    tripStart: { type: Date, required: requiredForTourist },
    tripEnd: {
      type: Date,
      required: requiredForTourist,
      validate: {
        validator: function (value) {
          return !this.tripStart || value > this.tripStart;
        },
        message: 'Trip end date must be after trip start date',
      },
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relation: { type: String, trim: true },
    },

    // ----- Digital ID -----
    salt: { type: String, select: false }, // random per tourist, needed to recompute the hash
    idHash: { type: String, unique: true, sparse: true }, // "0x..." SHA-256, the same value is stored on chain
    idTxHash: String, // blockchain transaction that registered the ID
    idRevokedAt: Date, // copy of the on-chain revocation, so chain:sync can restore it after a node reset

    // ----- Live tracking state (history is in the Location collection) -----
    lastLocation: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], default: undefined }, // [longitude, latitude]
    },
    lastSeenAt: Date,
    // Zone at the last update. Compared with the new zone to alert only on a CHANGE (Stage 3).
    lastZoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
    lastZoneType: { type: String, enum: ['red', 'yellow', 'green', 'none'], default: 'none' },
  },
  { timestamps: true } // adds createdAt and updatedAt
);

// Never send secrets to the client, even if they were selected
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.salt;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
