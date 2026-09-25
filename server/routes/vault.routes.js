import express from 'express';
import * as vaultController from '../controllers/vault.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All vault routes require authentication
router.use(protect);

// Bulk operations
router.post('/update-bulk', vaultController.bulkUpdate);
router.post('/delete-bulk', vaultController.bulkSoftDelete);
router.post('/delete-bulk-permanent', vaultController.bulkPermanentDelete);
router.post('/restore-bulk', vaultController.bulkRestore);

// Single item operations
router.get('/', vaultController.getEntries);
router.post('/', vaultController.createEntry);
router.get('/:id', vaultController.getEntryById);
router.put('/:id', vaultController.updateEntry);
router.patch('/:id/favorite', vaultController.toggleFavorite);
router.patch('/:id/last-used', vaultController.updateLastUsed);
router.delete('/:id', vaultController.softDeleteEntry);
router.delete('/:id/permanent', vaultController.permanentDeleteEntry);
router.post('/:id/restore', vaultController.restoreEntry);

export default router;
