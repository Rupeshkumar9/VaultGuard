const mongoose = require('mongoose');

const vaultEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ──── Metadata (stored as plaintext for search/filtering) ────
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [255, 'Title cannot exceed 255 characters'],
    },
    website: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
      enum: [
        'General',
        'Social Media',
        'Email',
        'Banking',
        'Shopping',
        'Work',
        'Entertainment',
        'Development',
        'Gaming',
        'Other',
      ],
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },

    // ──── Encrypted Data (encrypted on client, opaque to server) ────
    encryptedData: {
      type: String,
      required: [true, 'Encrypted data is required'],
    },
    iv: {
      type: String,
      required: [true, 'Initialization vector is required'],
    },
    salt: {
      type: String,
      required: [true, 'Salt is required'],
    },

    // ──── Optional metadata ────
    notes: {
      type: String,
      default: '',
    },
    lastUsed: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
vaultEntrySchema.index({ user: 1, category: 1 });
vaultEntrySchema.index({ user: 1, isFavorite: 1 });
vaultEntrySchema.index({ user: 1, title: 'text' });

module.exports = mongoose.model('VaultEntry', vaultEntrySchema);
