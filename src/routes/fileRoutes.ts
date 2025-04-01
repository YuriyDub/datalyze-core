import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import fileController from '../controllers/fileController';

const router = Router();

router.post('/avatar', authMiddleware, fileController.uploadAvatar);
router.post('/dataset', authMiddleware, fileController.uploadDataset);
router.get('/private-url', authMiddleware, fileController.getPrivateUrl);

router.post('/json-to-sqlite', authMiddleware, fileController.jsonToSqlite);
router.post('/csv-to-sqlite', authMiddleware, fileController.csvToSqlite);
router.post('/upload-sqlite', authMiddleware, fileController.uploadSqlite);

router.post('/clear-temp', authMiddleware, fileController.clearTempFiles);

export default router;
