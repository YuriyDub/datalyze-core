import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { S3_CONFIG, s3 } from '../../config/aws';
import { IFile, IUploadResponse } from './types';

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
}
