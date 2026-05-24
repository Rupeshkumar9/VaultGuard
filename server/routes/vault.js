const express = require('express');
const VaultEntry = require('../models/VaultEntry');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All vault routes require authentication
router.use(protect);

// ──────────────────────────────────────────────
// GET /api/vault
// Get all vault entries for the logged-in user
// Supports: ?category=Social Media&favorite=true&search=google
// ──────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { category, favorite, search, trash } = req.query;

    // Build query filter
    const filter = { user: req.user._id };

    if (trash === 'true') {
      filter.isInTrash = true;
    } else if (trash === 'all') {
      // Include both trash and non-trash items
    } else {
      filter.isInTrash = { $ne: true };
    }

    if (category) {
      filter.category = category;
    }

    if (favorite === 'true') {
      filter.isFavorite = true;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { website: { $regex: search, $options: 'i' } },
      ];
    }

    const entries = await VaultEntry.find(filter)
      .sort({ updatedAt: -1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────
// GET /api/vault/:id
// Get a single vault entry by ID
// ──────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const entry = await VaultEntry.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found.',
      });
    }

    res.status(200).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────
// POST /api/vault
// Create a new vault entry
// ──────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { title, website, category, encryptedData, iv, salt, notes } =
      req.body;

    if (!title || !encryptedData || !iv || !salt) {
      return res.status(400).json({
        success: false,
        message: 'Title, encryptedData, iv, and salt are required.',
      });
    }

    const entry = await VaultEntry.create({
      user: req.user._id,
      title,
      website: website || '',
      category: category || 'General',
      encryptedData,
      iv,
      salt,
      notes: notes || '',
    });

    res.status(201).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────
// PUT /api/vault/:id
// Update a vault entry
// ──────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    // Ensure the entry belongs to this user
    let entry = await VaultEntry.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found.',
      });
    }

    // Update allowed fields
    const allowedFields = [
      'title',
      'website',
      'category',
      'encryptedData',
      'iv',
      'salt',
      'notes',
      'isFavorite',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        entry[field] = req.body[field];
      }
    });

    await entry.save();

    res.status(200).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────
// PATCH /api/vault/:id/favorite
// Toggle favorite status
// ──────────────────────────────────────────────
router.patch('/:id/favorite', async (req, res, next) => {
  try {
    const entry = await VaultEntry.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found.',
      });
    }

    entry.isFavorite = !entry.isFavorite;
    await entry.save();

    res.status(200).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────
// PATCH /api/vault/:id/last-used
// Update last used timestamp (when user copies a password)
// ──────────────────────────────────────────────
router.patch('/:id/last-used', async (req, res, next) => {
  try {
    const entry = await VaultEntry.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { lastUsed: new Date() },
      { new: true }
    );

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found.',
      });
    }

    res.status(200).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────
// POST /api/vault/update-bulk
// Update multiple vault entries in bulk
// ──────────────────────────────────────────────
router.post('/update-bulk', async (req, res, next) => {
  try {
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids) || !updates) {
      return res.status(400).json({
        success: false,
        message: 'IDs array and updates object are required.',
      });
    }

    // Filter allowed bulk update fields (only non-sensitive metadata)
    const allowedUpdates = {};
    if (updates.title !== undefined) allowedUpdates.title = updates.title;
    if (updates.category !== undefined) allowedUpdates.category = updates.category;
    if (updates.website !== undefined) allowedUpdates.website = updates.website;

    const result = await VaultEntry.updateMany(
      { _id: { $in: ids }, user: req.user._id },
      { $set: allowedUpdates }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} entries updated successfully.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────
// POST /api/vault/delete-bulk
// Move multiple vault entries to Trash (soft delete)
// ──────────────────────────────────────────────
router.post('/delete-bulk', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: 'An array of IDs is required for bulk deletion.',
      });
    }

    const result = await VaultEntry.updateMany(
      { _id: { $in: ids }, user: req.user._id },
      { $set: { isInTrash: true, isFavorite: false } }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} entries moved to Trash successfully.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────
// POST /api/vault/delete-bulk-permanent
// Delete multiple vault entries permanently (hard delete)
// ──────────────────────────────────────────────
router.post('/delete-bulk-permanent', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: 'An array of IDs is required for permanent deletion.',
      });
    }

    const result = await VaultEntry.deleteMany({
      _id: { $in: ids },
      user: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} entries permanently deleted.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────
// POST /api/vault/restore-bulk
// Restore multiple vault entries from Trash
// ──────────────────────────────────────────────
router.post('/restore-bulk', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: 'An array of IDs is required for bulk restoration.',
      });
    }

    const result = await VaultEntry.updateMany(
      { _id: { $in: ids }, user: req.user._id },
      { $set: { isInTrash: false } }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} entries restored successfully.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────
// DELETE /api/vault/:id
// Move a vault entry to Trash (soft delete)
// ──────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const entry = await VaultEntry.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { isInTrash: true, isFavorite: false } },
      { new: true }
    );

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Entry moved to Trash successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────
// DELETE /api/vault/:id/permanent
// Delete a vault entry permanently
// ──────────────────────────────────────────────
router.delete('/:id/permanent', async (req, res, next) => {
  try {
    const entry = await VaultEntry.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Entry permanently deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────
// POST /api/vault/:id/restore
// Restore a vault entry from Trash
// ──────────────────────────────────────────────
router.post('/:id/restore', async (req, res, next) => {
  try {
    const entry = await VaultEntry.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { isInTrash: false } },
      { new: true }
    );

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Entry restored successfully.',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
