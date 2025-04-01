import { NextFunction, Request, Response } from 'express';
import { S3Service } from '../services/s3Service';
import { SqliteService } from '../services/sqliteService';
import { ICsvToSqliteOptions, IJsonToSqliteOptions } from '../services/sqliteService/types';
import { UploadedFile } from 'express-fileupload';

const fileController = {
  async clearTempFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await SqliteService.clearTempFiles();

      if (!result.success) {
        res.status(500).json({ error: result.message });
        return;
      }

      res.json({
        message: result.message,
        count: result.count,
      });
    } catch (error) {
      next(error);
    }
  },

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

  async jsonToSqlite(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userId = (req as any).user.id;
    const files = req.files;
    const options: IJsonToSqliteOptions = req.body.options
      ? JSON.parse(req.body.options)
      : { inferTypes: true };

    try {
      if (!files?.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const file = files.file as UploadedFile;
      if (file.mimetype !== 'application/json') {
        res.status(400).json({ error: 'File must be JSON format' });
        return;
      }

      const result = await SqliteService.processJsonFile(file, userId, options);

      if (result.error) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async csvToSqlite(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userId = (req as any).user.id;
    const files = req.files;

    try {
      if (!files?.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const file = files.file as UploadedFile;
      if (file.mimetype !== 'text/csv') {
        res.status(400).json({ error: 'File must be CSV format' });
        return;
      }

      if (!req.body.options) {
        res.status(400).json({ error: 'Column definitions are required for CSV conversion' });
        return;
      }

      const options: ICsvToSqliteOptions = JSON.parse(req.body.options);

      if (
        !options.tableName ||
        !options.columns ||
        !Array.isArray(options.columns) ||
        options.columns.length === 0
      ) {
        res.status(400).json({ error: 'Invalid options: tableName and columns are required' });
        return;
      }

      const result = await SqliteService.processCsvFile(file, userId, options);

      if (result.error) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async uploadSqlite(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userId = (req as any).user.id;
    const files = req.files;

    try {
      if (!files?.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const file = files.file as UploadedFile;

      const result = await SqliteService.uploadSqliteFile(file, userId);

      if (result.error) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
};

export default fileController;
