import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import chatController from '../controllers/chatController';

const router = Router();

router.post('/', authMiddleware, chatController.createChat);
router.get('/', authMiddleware, chatController.getUserChats);
router.get('/:id', authMiddleware, chatController.getChat);
router.put('/:id/title', authMiddleware, chatController.updateChatTitle);
router.delete('/:id', authMiddleware, chatController.deleteChat);

router.post('/:id/messages', authMiddleware, chatController.sendMessage);
router.post('/execute-query', authMiddleware, chatController.executeQuery);

export default router;
