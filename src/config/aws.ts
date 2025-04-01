import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

export const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  retryMode: 'standard',
  maxAttempts: 3,
  logger: console,
});

export const S3_CONFIG = {
  bucketName: process.env.S3_BUCKET_NAME || 'your-app-bucket',
  publicAvatarPrefix: 'public/avatars/',
  privateDatasetPrefix: 'private/datasets/',
};
