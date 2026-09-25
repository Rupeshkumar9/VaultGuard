import * as vaultService from '../services/vault.service.js';
import { validateIds } from '../utils/validators.js';

export const getEntries = async (req, res, next) => {
  try {
    const { category, favorite, search, trash } = req.query;
    const entries = await vaultService.getUserVaultEntries({
      userId: req.user._id,
      category,
      favorite,
      search,
      trash,
    });

    res.status(200).json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (error) {
    next(error);
  }
};

export const getEntryById = async (req, res, next) => {
  try {
    const entry = await vaultService.getVaultEntryById({
      id: req.params.id,
      userId: req.user._id,
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
};

export const createEntry = async (req, res, next) => {
  try {
    const { title, website, category, encryptedData, iv, salt, notes } = req.body;

    if (!title || !encryptedData || !iv || !salt) {
      return res.status(400).json({
        success: false,
        message: 'Title, encryptedData, iv, and salt are required.',
      });
    }

    const entry = await vaultService.createVaultEntry({
      userId: req.user._id,
      title,
      website,
      category,
      encryptedData,
      iv,
      salt,
      notes,
    });

    res.status(201).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
};

export const updateEntry = async (req, res, next) => {
  try {
    const entry = await vaultService.updateVaultEntry({
      id: req.params.id,
      userId: req.user._id,
      updateFields: req.body,
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
};

export const toggleFavorite = async (req, res, next) => {
  try {
    const entry = await vaultService.toggleEntryFavorite({
      id: req.params.id,
      userId: req.user._id,
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
};

export const updateLastUsed = async (req, res, next) => {
  try {
    const entry = await vaultService.updateEntryLastUsed({
      id: req.params.id,
      userId: req.user._id,
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
};

export const softDeleteEntry = async (req, res, next) => {
  try {
    const entry = await vaultService.softDeleteVaultEntry({
      id: req.params.id,
      userId: req.user._id,
    });

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
};

export const restoreEntry = async (req, res, next) => {
  try {
    const entry = await vaultService.restoreVaultEntry({
      id: req.params.id,
      userId: req.user._id,
    });

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
};

export const permanentDeleteEntry = async (req, res, next) => {
  try {
    const entry = await vaultService.permanentDeleteVaultEntry({
      id: req.params.id,
      userId: req.user._id,
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
};

export const bulkUpdate = async (req, res, next) => {
  try {
    const { ids, updates } = req.body;
    if (!validateIds(ids) || !updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'IDs array and updates object are required.',
      });
    }

    const result = await vaultService.bulkUpdateVaultEntries({
      ids,
      userId: req.user._id,
      updates,
    });

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} entries updated successfully.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkSoftDelete = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) {
      return res.status(400).json({
        success: false,
        message: 'An array of IDs is required for bulk deletion.',
      });
    }

    const result = await vaultService.bulkSoftDeleteVaultEntries({
      ids,
      userId: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} entries moved to Trash successfully.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkRestore = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) {
      return res.status(400).json({
        success: false,
        message: 'An array of IDs is required for bulk restoration.',
      });
    }

    const result = await vaultService.bulkRestoreVaultEntries({
      ids,
      userId: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} entries restored successfully.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkPermanentDelete = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) {
      return res.status(400).json({
        success: false,
        message: 'An array of IDs is required for permanent deletion.',
      });
    }

    const result = await vaultService.bulkPermanentDeleteVaultEntries({
      ids,
      userId: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} entries permanently deleted.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};
