import { S3Service } from '../s3Service';
import { IFile } from '../s3Service/types';
import { S3_CONFIG } from '../../config/aws';
import { csvToJson } from '../../utils/fileConverter';
import {
  IColumnDefinition,
  ICsvToSqliteOptions,
  IJsonToSqliteOptions,
  ISqliteServiceResult,
  ITableDefinition,
} from './types';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';

export class SqliteService {
  private static readonly TEMP_DIR = 'uploads/temp';

  static async clearTempFiles(): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      if (!fs.existsSync(this.TEMP_DIR)) {
        fs.mkdirSync(this.TEMP_DIR, { recursive: true });
        return { success: true, message: 'No temporary files to clear', count: 0 };
      }

      const files = await fs.promises.readdir(this.TEMP_DIR);

      if (files.length === 0) {
        return { success: true, message: 'No temporary files to clear', count: 0 };
      }

      let deletedCount = 0;
      for (const file of files) {
        const filePath = path.join(this.TEMP_DIR, file);

        const stats = await fs.promises.stat(filePath);
        if (stats.isFile()) {
          await fs.promises.unlink(filePath);
          deletedCount++;
        }
      }

      return {
        success: true,
        message: `Successfully cleared ${deletedCount} temporary files`,
        count: deletedCount,
      };
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, message: `Failed to clear temporary files: ${error.message}` };
      }
      return { success: false, message: 'Failed to clear temporary files: Unknown error' };
    }
  }

  private static inferColumnType(value: any): 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' | 'NULL' {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'INTEGER' : 'REAL';
    }
    if (typeof value === 'string') return 'TEXT';
    if (typeof value === 'boolean') return 'INTEGER';
    if (Buffer.isBuffer(value)) return 'BLOB';

    return 'TEXT';
  }

  private static async jsonToSqlite(
    jsonData: any,
    dbPath: string,
    options?: IJsonToSqliteOptions,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) return reject(err);
      });

      try {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          if (options?.tables && options.tables.length > 0) {
            for (const table of options.tables) {
              this.createTableFromDefinition(db, table);

              if (Array.isArray(jsonData)) {
                for (const item of jsonData) {
                  this.insertDataIntoTable(db, table.name, item);
                }
              } else if (jsonData[table.name] && Array.isArray(jsonData[table.name])) {
                for (const item of jsonData[table.name]) {
                  this.insertDataIntoTable(db, table.name, item);
                }
              }
            }
          } else if (options?.inferTypes) {
            if (Array.isArray(jsonData)) {
              const tableName = 'data';
              const sampleItem = jsonData[0] || {};
              const columns = this.inferColumnsFromObject(sampleItem);

              this.createTableFromColumns(db, tableName, columns);

              for (const item of jsonData) {
                this.insertDataIntoTable(db, tableName, item);
              }
            } else {
              for (const [key, value] of Object.entries(jsonData)) {
                if (Array.isArray(value) && value.length > 0) {
                  const tableName = key;
                  const sampleItem = value[0] || {};
                  const columns = this.inferColumnsFromObject(sampleItem);

                  this.createTableFromColumns(db, tableName, columns);

                  for (const item of value) {
                    this.insertDataIntoTable(db, tableName, item);
                  }
                }
              }
            }
          } else {
            db.run('CREATE TABLE IF NOT EXISTS json_data (id INTEGER PRIMARY KEY, data TEXT)');
            db.run('INSERT INTO json_data (data) VALUES (?)', [JSON.stringify(jsonData)]);
          }

          db.run('COMMIT', (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
      } catch (error) {
        db.run('ROLLBACK');
        reject(error);
      } finally {
        db.close();
      }
    });
  }

  private static async csvToSqlite(
    csvFilePath: string,
    dbPath: string,
    options: ICsvToSqliteOptions,
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const jsonData = await csvToJson(csvFilePath);

        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const db = new sqlite3.Database(dbPath, (err) => {
          if (err) return reject(err);
        });

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          const tableDefinition: ITableDefinition = {
            name: options.tableName,
            columns: options.columns,
          };

          this.createTableFromDefinition(db, tableDefinition);

          for (const item of jsonData) {
            this.insertDataIntoTable(db, options.tableName, item);
          }

          db.run('COMMIT', (err) => {
            if (err) return reject(err);
            resolve();
          });
        });

        db.close();
      } catch (error) {
        reject(error);
      }
    });
  }

  private static createTableFromDefinition(db: sqlite3.Database, table: ITableDefinition): void {
    const columnDefs = table.columns
      .map((col) => {
        let def = `"${col.name}" ${col.type}`;

        if (col.primaryKey) def += ' PRIMARY KEY';
        if (col.notNull) def += ' NOT NULL';
        if (col.unique) def += ' UNIQUE';
        if (col.defaultValue !== undefined) {
          def += ` DEFAULT ${
            typeof col.defaultValue === 'string' ? `'${col.defaultValue}'` : col.defaultValue
          }`;
        }

        return def;
      })
      .join(', ');

    const createTableSql = `CREATE TABLE IF NOT EXISTS "${table.name}" (${columnDefs})`;
    db.run(createTableSql);
  }

  private static createTableFromColumns(
    db: sqlite3.Database,
    tableName: string,
    columns: IColumnDefinition[],
  ): void {
    const tableDefinition: ITableDefinition = {
      name: tableName,
      columns,
    };

    this.createTableFromDefinition(db, tableDefinition);
  }

  private static inferColumnsFromObject(obj: any): IColumnDefinition[] {
    const columns: IColumnDefinition[] = [];

    columns.push({
      name: 'id',
      type: 'INTEGER',
      primaryKey: true,
    });

    for (const [key, value] of Object.entries(obj)) {
      if (!key) continue;

      columns.push({
        name: key,
        type: this.inferColumnType(value),
      });
    }

    return columns;
  }

  private static insertDataIntoTable(db: sqlite3.Database, tableName: string, data: any): void {
    const columns = Object.keys(data).filter((key) => key !== 'id');
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map((col) => {
      const val = data[col];

      if (val !== null && typeof val === 'object') {
        return JSON.stringify(val);
      }

      return val;
    });

    const sql = `INSERT INTO "${tableName}" (${columns
      .map((c) => `"${c}"`)
      .join(', ')}) VALUES (${placeholders})`;
    db.run(sql, values);
  }

  static async processJsonFile(
    file: IFile,
    userId: string,
    options?: IJsonToSqliteOptions,
  ): Promise<ISqliteServiceResult> {
    try {
      if (!fs.existsSync(this.TEMP_DIR)) {
        fs.mkdirSync(this.TEMP_DIR, { recursive: true });
      }
      const uniqueId = uuidv4();
      const jsonFilePath = path.join(this.TEMP_DIR, `${uniqueId}_${file.name}`);
      const dbFilePath = path.join(this.TEMP_DIR, `${uniqueId}_${path.parse(file.name).name}.db`);

      await fs.promises.writeFile(jsonFilePath, file.data);

      const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

      await this.jsonToSqlite(jsonData, dbFilePath, options);

      const dbFileName = path.basename(dbFilePath);
      const dbFileData = await fs.promises.readFile(dbFilePath);

      const sqliteFile: IFile = {
        data: dbFileData,
        name: dbFileName,
        mimetype: 'application/x-sqlite3',
        size: dbFileData.length,
        mv: async () => {},
        encoding: '',
        tempFilePath: '',
        truncated: false,
        md5: '',
      };

      const result = await S3Service.uploadPrivateDataset(sqliteFile, userId);

      fs.unlinkSync(jsonFilePath);
      fs.unlinkSync(dbFilePath);

      if (!result?.key) {
        return {
          error: 'Failed to upload SQLite file: No key returned from S3 service',
        };
      }

      return {
        key: result.key,
        message: 'JSON successfully converted to SQLite and uploaded',
      };
    } catch (error) {
      if (error instanceof Error) {
        return { error: `Failed to process JSON file: ${error.message}` };
      }
      return { error: 'Failed to process JSON file: Unknown error' };
    }
  }

  static async processCsvFile(
    file: IFile,
    userId: string,
    options: ICsvToSqliteOptions,
  ): Promise<ISqliteServiceResult> {
    try {
      if (!fs.existsSync(this.TEMP_DIR)) {
        fs.mkdirSync(this.TEMP_DIR, { recursive: true });
      }

      const uniqueId = uuidv4();
      const csvFilePath = path.join(this.TEMP_DIR, `${uniqueId}_${file.name}`);
      const dbFilePath = path.join(this.TEMP_DIR, `${uniqueId}_${path.parse(file.name).name}.db`);

      await fs.promises.writeFile(csvFilePath, file.data);

      await this.csvToSqlite(csvFilePath, dbFilePath, options);

      const dbFileName = path.basename(dbFilePath);
      const dbFileData = await fs.promises.readFile(dbFilePath);

      const sqliteFile: IFile = {
        data: dbFileData,
        name: dbFileName,
        mimetype: 'application/x-sqlite3',
        size: dbFileData.length,
        mv: async () => {},
        encoding: '',
        tempFilePath: '',
        truncated: false,
        md5: '',
      };

      const result = await S3Service.uploadPrivateDataset(sqliteFile, userId);

      fs.unlinkSync(csvFilePath);
      fs.unlinkSync(dbFilePath);

      if (!result?.key) {
        return {
          error: 'Failed to upload SQLite file: No key returned from S3 service',
        };
      }

      return {
        key: result.key,
        message: 'CSV successfully converted to SQLite and uploaded',
      };
    } catch (error) {
      if (error instanceof Error) {
        return { error: `Failed to process CSV file: ${error.message}` };
      }
      return { error: 'Failed to process CSV file: Unknown error' };
    }
  }

  static async uploadSqliteFile(file: IFile, userId: string): Promise<ISqliteServiceResult> {
    try {
      const header = file.data.slice(0, 16).toString();
      if (!header.includes('SQLite format')) {
        return { error: 'Invalid SQLite file format' };
      }

      const result = await S3Service.uploadPrivateDataset(file, userId);

      if (!result?.key) {
        return {
          error: 'Failed to upload SQLite file: No key returned from S3 service',
        };
      }

      return {
        key: result.key,
        message: 'SQLite file successfully uploaded',
      };
    } catch (error) {
      if (error instanceof Error) {
        return { error: `Failed to upload SQLite file: ${error.message}` };
      }
      return { error: 'Failed to upload SQLite file: Unknown error' };
    }
  }
}
