import { Request } from 'express';

export interface IFile {
  data: Buffer;
  name: string;
  mimetype: string;
  size: number;
  mv: (path: string) => Promise<void>;
  encoding: string;
  tempFilePath: string;
  truncated: boolean;
  md5: string;
}

export interface IFileRequest extends Request {
  file?: IFile;
  files?: {
    file?: IFile;
  };
}

export interface IUploadResponse {
  url?: string;
  key?: string;
  message?: string;
}
