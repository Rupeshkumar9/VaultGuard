import VaultEntry from '../models/VaultEntry.js';
import { escapeRegex } from '../utils/regex.js';

export const getUserVaultEntries = async ({ userId, category, favorite, search, trash }) => {
  const filter = { user: userId };

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

  if (typeof search === 'string' && search.trim()) {
    const safeSearch = escapeRegex(search.trim().slice(0, 100));
    filter.$or = [
      { title: { $regex: safeSearch, $options: 'i' } },
      { website: { $regex: safeSearch, $options: 'i' } },
    ];
  }

  return VaultEntry.find(filter)
    .sort({ updatedAt: -1 })
    .select('-__v');
};

export const getVaultEntryById = async ({ id, userId }) => {
  return VaultEntry.findOne({ _id: id, user: userId });
};

export const createVaultEntry = async ({ userId, title, website, category, encryptedData, iv, salt, notes }) => {
  return VaultEntry.create({
    user: userId,
    title,
    website: website || '',
    category: category || 'General',
    encryptedData,
    iv,
    salt,
    notes: notes || '',
  });
};

export const updateVaultEntry = async ({ id, userId, updateFields }) => {
  const entry = await VaultEntry.findOne({ _id: id, user: userId });
  if (!entry) return null;

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
    if (updateFields[field] !== undefined) {
      entry[field] = updateFields[field];
    }
  });

  await entry.save();
  return entry;
};

export const toggleEntryFavorite = async ({ id, userId }) => {
  const entry = await VaultEntry.findOne({ _id: id, user: userId });
  if (!entry) return null;

  entry.isFavorite = !entry.isFavorite;
  await entry.save();
  return entry;
};

export const updateEntryLastUsed = async ({ id, userId }) => {
  return VaultEntry.findOneAndUpdate(
    { _id: id, user: userId },
    { lastUsed: new Date() },
    { returnDocument: 'after' }
  );
};

export const softDeleteVaultEntry = async ({ id, userId }) => {
  return VaultEntry.findOneAndUpdate(
    { _id: id, user: userId },
    { $set: { isInTrash: true, isFavorite: false } },
    { returnDocument: 'after' }
  );
};

export const restoreVaultEntry = async ({ id, userId }) => {
  return VaultEntry.findOneAndUpdate(
    { _id: id, user: userId },
    { $set: { isInTrash: false } },
    { returnDocument: 'after' }
  );
};

export const permanentDeleteVaultEntry = async ({ id, userId }) => {
  return VaultEntry.findOneAndDelete({ _id: id, user: userId });
};

export const bulkUpdateVaultEntries = async ({ ids, userId, updates }) => {
  const allowedUpdates = {};
  if (updates.title !== undefined) allowedUpdates.title = updates.title;
  if (updates.category !== undefined) allowedUpdates.category = updates.category;
  if (updates.website !== undefined) allowedUpdates.website = updates.website;

  return VaultEntry.updateMany(
    { _id: { $in: ids }, user: userId },
    { $set: allowedUpdates }
  );
};

export const bulkSoftDeleteVaultEntries = async ({ ids, userId }) => {
  return VaultEntry.updateMany(
    { _id: { $in: ids }, user: userId },
    { $set: { isInTrash: true, isFavorite: false } }
  );
};

export const bulkRestoreVaultEntries = async ({ ids, userId }) => {
  return VaultEntry.updateMany(
    { _id: { $in: ids }, user: userId },
    { $set: { isInTrash: false } }
  );
};

export const bulkPermanentDeleteVaultEntries = async ({ ids, userId }) => {
  return VaultEntry.deleteMany({
    _id: { $in: ids },
    user: userId,
  });
};
