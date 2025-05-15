import { NextFunction, Request, Response } from 'express';
import { Chat } from '../models/Chat';
import { Dataset } from '../models/Dataset';
import { LLMService } from '../services/llmService';

const chatController = {
  async createChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { datasetId, title } = req.body;

      if (!datasetId) {
        res.status(400).json({ error: 'Dataset ID is required' });
        return;
      }

      const dataset = await Dataset.findById(datasetId);
      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      if (dataset.user_id !== userId) {
        res.status(403).json({ error: 'You do not have permission to access this dataset' });
        return;
      }

      const chatTitle = title || `Chat about ${dataset.name}`;

      const chat = await Chat.create(userId, datasetId, chatTitle);

      res.json({
        message: 'Chat created successfully',
        chat,
      });
    } catch (error) {
      next(error);
    }
  },

  async getUserChats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const chats = await Chat.findByUserId(userId);

      res.json({
        chats: chats.map((chat) => ({
          ...chat,
          createdAt: chat.created_at?.toISOString(),
          updatedAt: chat.updated_at?.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  },

  async getChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Chat ID is required' });
        return;
      }

      const chat = await Chat.findById(id);
      if (!chat) {
        res.status(404).json({ error: 'Chat not found' });
        return;
      }

      if (chat.user_id !== userId) {
        res.status(403).json({ error: 'You do not have permission to access this chat' });
        return;
      }

      const messages = await Chat.getMessages(id);

      res.json({
        chat: {
          ...chat,
          createdAt: chat.created_at?.toISOString(),
          updatedAt: chat.updated_at?.toISOString(),
        },
        messages: messages.map((msg) => ({
          ...msg,
          createdAt: msg.created_at?.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  },

  async updateChatTitle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const { title } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Chat ID is required' });
        return;
      }

      if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }

      const chat = await Chat.findById(id);
      if (!chat) {
        res.status(404).json({ error: 'Chat not found' });
        return;
      }

      if (chat.user_id !== userId) {
        res.status(403).json({ error: 'You do not have permission to access this chat' });
        return;
      }

      const updatedChat = await Chat.updateTitle(id, title);

      res.json({
        message: 'Chat title updated successfully',
        chat: {
          ...updatedChat,
          createdAt: updatedChat?.created_at?.toISOString(),
          updatedAt: updatedChat?.updated_at?.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Chat ID is required' });
        return;
      }

      const chat = await Chat.findById(id);
      if (!chat) {
        res.status(404).json({ error: 'Chat not found' });
        return;
      }

      if (chat.user_id !== userId) {
        res.status(403).json({ error: 'You do not have permission to access this chat' });
        return;
      }

      const success = await Chat.delete(id);

      if (success) {
        res.json({ message: 'Chat deleted successfully' });
      } else {
        res.status(500).json({ error: 'Failed to delete chat' });
      }
    } catch (error) {
      next(error);
    }
  },

  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const { message } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Chat ID is required' });
        return;
      }

      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const response = await LLMService.processMessage(id, message, userId);

      if (response.error) {
        res.status(400).json({ error: response.error });
        return;
      }

      res.json({
        message: 'Message sent successfully',
        response: {
          content: response.content,
          sqlQuery: response.sqlQuery,
          title: response.title,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async executeQuery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { datasetId, sqlQuery } = req.body;

      if (!datasetId) {
        res.status(400).json({ error: 'Dataset ID is required' });
        return;
      }

      if (!sqlQuery) {
        res.status(400).json({ error: 'SQL query is required' });
        return;
      }

      const result = await LLMService.executeQuery(datasetId, sqlQuery, userId);

      res.json({
        message: 'Query executed successfully',
        result,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        next(error);
      }
    }
  },
};

export default chatController;
