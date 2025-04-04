import { NextFunction, Request, Response } from 'express';
import { S3Service } from '../services/s3Service';
import { SqliteService } from '../services/sqliteService';
import { ICsvToSqliteOptions, IJsonToSqliteOptions } from '../services/sqliteService/types';
import { UploadedFile } from 'express-fileupload';
import { Dataset } from '../models/Dataset';

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
    try {
      const userId = (req as any).user.id;
      const files = req.files;
      const { name } = req.body;

      if (!files?.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const file = files.file as UploadedFile;

      // Upload to S3
      const result = await S3Service.uploadPrivateDataset(file, userId);

      if (!result?.key) {
        res.status(500).json({ error: 'Failed to upload dataset to storage' });
        return;
      }

      // Get the file name from the uploaded file if not provided
      const fileName = name || file.name;

      // Save to database
      const dataset = await Dataset.create(fileName, result.key, userId, file.mimetype, file.size);

      res.json({
        message: 'Dataset uploaded successfully',
        dataset,
      });
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

  // New dataset management methods
  async getUserDatasets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const datasets = await Dataset.findByUserId(userId);
      res.json({
        datasets: datasets.map((d) => ({
          ...d,
          createdAt: d.created_at?.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteDataset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Dataset id is required' });
        return;
      }

      // First get the dataset from the database
      const dataset = await Dataset.findByFileId(id);

      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      // First delete from S3
      const s3Success = await S3Service.deleteDataset(dataset.file_key);

      if (!s3Success) {
        res.status(500).json({ error: 'Failed to delete dataset from storage' });
        return;
      }

      // Then delete from database
      const dbSuccess = await Dataset.deleteByFileKey(dataset.file_key);

      if (dbSuccess) {
        res.json({ message: 'Dataset deleted successfully' });
      } else {
        // S3 delete succeeded but DB delete failed
        res.status(500).json({
          error: 'Dataset was deleted from storage but failed to update database records',
          partialSuccess: true,
        });
      }
    } catch (error) {
      next(error);
    }
  },

  async renameDataset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { newName } = req.body;
      const userId = (req as any).user.id;

      if (!id) {
        res.status(400).json({ error: 'Dataset id is required' });
        return;
      }

      if (!newName || typeof newName !== 'string') {
        res.status(400).json({ error: 'New name is required' });
        return;
      }

      // First get the dataset from the database
      const dataset = await Dataset.findByFileId(id);

      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      // Rename in S3
      const newKey = await S3Service.renameDataset(dataset.file_key, newName, userId);

      if (!newKey) {
        res.status(500).json({ error: 'Failed to rename dataset in storage' });
        return;
      }

      // Update the database record
      const updatedDataset = await Dataset.updateFileKey(dataset.id, newKey);

      // Also update the name in the database
      const renamedDataset = await Dataset.updateName(dataset.id, newName);

      if (updatedDataset && renamedDataset) {
        res.json({
          message: 'Dataset renamed successfully',
          dataset: renamedDataset,
        });
      } else {
        res.status(500).json({
          error: 'Dataset was renamed in storage but failed to update database records',
          partialSuccess: true,
          key: newKey,
        });
      }
    } catch (error) {
      next(error);
    }
  },

  async jsonToSqlite(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userId = (req as any).user.id;
    const files = req.files;
    const { name } = req.body;
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

      if (!result.key) {
        res.status(500).json({ error: 'Failed to process JSON file: No key returned' });
        return;
      }

      // Get the file name from the uploaded file if not provided
      const fileName = name || `${file.name.replace(/\.[^/.]+$/, '')}.sqlite`;

      // Save to database
      const dataset = await Dataset.create(
        fileName,
        result.key,
        userId,
        'application/x-sqlite3',
        file.size, // This is approximate since the SQLite file size might differ
      );

      res.json({
        message: 'JSON successfully converted to SQLite and uploaded',
        dataset,
      });
    } catch (error) {
      next(error);
    }
  },

  async csvToSqlite(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userId = (req as any).user.id;
    const files = req.files;
    const { name } = req.body;

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

      if (!result.key) {
        res.status(500).json({ error: 'Failed to process CSV file: No key returned' });
        return;
      }

      // Get the file name from the uploaded file if not provided
      const fileName = name || `${file.name.replace(/\.[^/.]+$/, '')}.sqlite`;

      // Save to database
      const dataset = await Dataset.create(
        fileName,
        result.key,
        userId,
        'application/x-sqlite3',
        file.size, // This is approximate since the SQLite file size might differ
      );

      res.json({
        message: 'CSV successfully converted to SQLite and uploaded',
        dataset,
      });
    } catch (error) {
      next(error);
    }
  },

  async uploadSqlite(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userId = (req as any).user.id;
    const files = req.files;
    const { name } = req.body;

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

      if (!result.key) {
        res.status(500).json({ error: 'Failed to upload SQLite file: No key returned' });
        return;
      }

      // Get the file name from the uploaded file if not provided
      const fileName = name || file.name;

      // Save to database
      const dataset = await Dataset.create(
        fileName,
        result.key,
        userId,
        'application/x-sqlite3',
        file.size,
      );

      res.json({
        message: 'SQLite file successfully uploaded',
        dataset,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default fileController;
