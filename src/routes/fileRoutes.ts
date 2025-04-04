import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import fileController from '../controllers/fileController';

const router = Router();

// File upload routes
router.post('/avatar', authMiddleware, fileController.uploadAvatar);
router.post('/dataset', authMiddleware, fileController.uploadDataset);
router.get('/private-url', authMiddleware, fileController.getPrivateUrl);

// SQLite conversion routes
router.post('/json-to-sqlite', authMiddleware, fileController.jsonToSqlite);
router.post('/csv-to-sqlite', authMiddleware, fileController.csvToSqlite);
router.post('/upload-sqlite', authMiddleware, fileController.uploadSqlite);

// Dataset management routes
router.get('/datasets', authMiddleware, fileController.getUserDatasets);
router.delete('/datasets/:id', authMiddleware, fileController.deleteDataset);
router.put('/datasets/:id/rename', authMiddleware, fileController.renameDataset);

// Temporary files management
router.post('/clear-temp', authMiddleware, fileController.clearTempFiles);

export default router;
