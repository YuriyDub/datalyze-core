import { S3 } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { S3_CONFIG, s3 } from '../../config/aws';
import { IFile, IUploadResponse } from './types';

export class S3Service {
  static async uploadPublicAvatar(file: IFile, userId: string): Promise<IUploadResponse | void> {
    const extension = file.name.split('.').pop();
    const fileName = `avatar_${userId}.${extension}`;

    const params: S3.PutObjectRequest = {
      Bucket: S3_CONFIG.bucketName,
      Key: `${S3_CONFIG.publicAvatarPrefix}${fileName}`,
      Body: file.data,
      ContentType: file.mimetype,
    };

    try {
      const result = await s3.upload(params).promise();
      return { url: result.Location };
    } catch (error) {
      if (error instanceof Error) throw new Error(`Failed to upload avatar: ${error.message}`);
      return;
    }
  }

  static async uploadPrivateDataset(file: IFile, userId: string): Promise<IUploadResponse | void> {
    const uniqueId = uuidv4();
    const fileName = `${uniqueId}_${file.name}`;

    const params: S3.PutObjectRequest = {
      Bucket: S3_CONFIG.bucketName,
      Key: `${S3_CONFIG.privateDatasetPrefix}${userId}/${fileName}`,
      Body: file.data,
      ContentType: file.mimetype,
    };

    try {
      const result = await s3.upload(params).promise();
      return { key: result.Key };
    } catch (error) {
      if (error instanceof Error) throw new Error(`Failed to upload dataset: ${error.message}`);
      return;
    }
  }

  static async generatePresignedUrl(
    fileKey: string,
    expires: number = 3600,
  ): Promise<string | void> {
    const params = {
      Bucket: S3_CONFIG.bucketName,
      Key: fileKey,
      Expires: expires,
    };

    try {
      return await s3.getSignedUrlPromise('getObject', params);
    } catch (error) {
      if (error instanceof Error) throw new Error(`Failed to generate URL: ${error.message}`);
      return;
    }
  }
}
