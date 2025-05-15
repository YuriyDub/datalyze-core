import {
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { S3_CONFIG, s3 } from '../../config/aws';
import { IDatasetInfo, IFile, IUploadResponse } from './types';

export class S3Service {
  static async uploadPublicAvatar(file: IFile, userId: string): Promise<IUploadResponse | void> {
    const extension = file.name.split('.').pop();
    const fileName = `avatar_${userId}.${extension}`;
    const key = `${S3_CONFIG.publicAvatarPrefix}${fileName}`;

    const command = new PutObjectCommand({
      Bucket: S3_CONFIG.bucketName,
      Key: key,
      Body: file.data,
      ContentType: file.mimetype,
    });

    try {
      await s3.send(command);
      const region = await s3.config.region();
      const location = `https://${S3_CONFIG.bucketName}.s3.${region}.amazonaws.com/${key}`;
      return { url: location };
    } catch (error) {
      if (error instanceof Error) throw new Error(`Failed to upload avatar: ${error.message}`);
      return;
    }
  }

  static async uploadPrivateDataset(file: IFile, userId: string): Promise<IUploadResponse | void> {
    const uniqueId = uuidv4();
    const fileName = `${uniqueId}_${file.name}`;
    const key = `${S3_CONFIG.privateDatasetPrefix}${userId}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: S3_CONFIG.bucketName,
      Key: key,
      Body: file.data,
      ContentType: file.mimetype,
    });

    try {
      await s3.send(command);
      return { key };
    } catch (error) {
      if (error instanceof Error) throw new Error(`Failed to upload dataset: ${error.message}`);
      return;
    }
  }

  static async generatePresignedUrl(
    fileKey: string,
    expires: number = 3600,
  ): Promise<string | void> {
    const command = new GetObjectCommand({
      Bucket: S3_CONFIG.bucketName,
      Key: fileKey,
    });

    try {
      return await getSignedUrl(s3, command, { expiresIn: expires });
    } catch (error) {
      if (error instanceof Error) throw new Error(`Failed to generate URL: ${error.message}`);
      return;
    }
  }

  static async listUserDatasets(userId: string): Promise<IDatasetInfo[]> {
    const prefix = `${S3_CONFIG.privateDatasetPrefix}${userId}/`;

    const command = new ListObjectsV2Command({
      Bucket: S3_CONFIG.bucketName,
      Prefix: prefix,
    });

    try {
      const response = await s3.send(command);

      if (!response.Contents || response.Contents.length === 0) {
        return [];
      }

      return response.Contents.map((item) => {
        const key = item.Key || '';
        const fullName = key.split('/').pop() || '';
        const nameParts = fullName.split('_');
        const name = nameParts.slice(1).join('_');
        return {
          key,
          name,
          size: item.Size || 0,
          lastModified: item.LastModified || new Date(),
          type: name.split('.').pop() || '',
        };
      });
    } catch (error) {
      if (error instanceof Error) throw new Error(`Failed to list datasets: ${error.message}`);
      return [];
    }
  }

  static async deleteDataset(key: string): Promise<boolean> {
    const command = new DeleteObjectCommand({
      Bucket: S3_CONFIG.bucketName,
      Key: key,
    });

    try {
      await s3.send(command);
      return true;
    } catch (error) {
      if (error instanceof Error) throw new Error(`Failed to delete dataset: ${error.message}`);
      return false;
    }
  }

  static async renameDataset(key: string, newName: string, userId: string): Promise<string | void> {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: S3_CONFIG.bucketName,
        Key: key,
      });

      const response = await s3.send(getCommand);

      if (!response.Body) {
        throw new Error('Dataset not found');
      }

      const fullName = key.split('/').pop() || '';
      const uniqueId = fullName.split('_')[0];

      const newKey = `${S3_CONFIG.privateDatasetPrefix}${userId}/${uniqueId}_${newName}`;

      const copyCommand = new CopyObjectCommand({
        Bucket: S3_CONFIG.bucketName,
        CopySource: `${S3_CONFIG.bucketName}/${key}`,
        Key: newKey,
        ContentType: response.ContentType,
      });

      await s3.send(copyCommand);

      const deleteCommand = new DeleteObjectCommand({
        Bucket: S3_CONFIG.bucketName,
        Key: key,
      });

      await s3.send(deleteCommand);

      return newKey;
    } catch (error) {
      if (error instanceof Error) throw new Error(`Failed to rename dataset: ${error.message}`);
      return;
    }
  }
}
