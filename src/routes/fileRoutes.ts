import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import fileController from '../controllers/fileController';

const router = Router();

router.post('/avatar', authMiddleware, fileController.uploadAvatar);

router.post('/dataset', authMiddleware, fileController.uploadDataset);

router.get('/private-url', authMiddleware, fileController.getPrivateUrl);

export default router;
