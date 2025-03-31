import { NextFunction, Request, Response } from 'express';
import { S3Service } from '../services/s3Service';
import { UploadedFile } from 'express-fileupload';

const fileController = {
  async uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userId = (req as any).user.id;
    const files = req.files;
    try {
      if (!files?.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const result = await S3Service.uploadPublicAvatar(files.file as UploadedFile, userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async uploadDataset(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id, files } = req.body;
    try {
      if (!files?.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const result = await S3Service.uploadPrivateDataset(files.file, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async getPrivateUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fileKey } = req.query;
      if (!fileKey || typeof fileKey !== 'string') {
        res.status(400).json({ error: 'Valid file key required' });
        return;
      }

      const url = await S3Service.generatePresignedUrl(fileKey);
      res.json({ url });
    } catch (error) {
      next(error);
    }
  },
};

export default fileController;
