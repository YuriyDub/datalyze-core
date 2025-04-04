import pool from '../config/db';
import { v4 as uuidv4 } from 'uuid';

export interface IDataset {
  id: string;
  name: string;
  file_key: string;
  user_id: string;
  created_at: Date;
  file_type: string;
  file_size: number;
}

export class Dataset {
  /**
   * Create the datasets table if it doesn't exist
   */
  static async createTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS datasets (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        file_key VARCHAR(255) NOT NULL UNIQUE,
        user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        file_type VARCHAR(50),
        file_size BIGINT
      )
    `;

    try {
      await pool.query(query);
    } catch (error) {
      console.error('Error creating datasets table:', error);
      throw error;
    }
  }

  /**
   * Create a new dataset record
   */
  static async create(
    name: string,
    fileKey: string,
    userId: string,
    fileType: string = '',
    fileSize: number = 0,
  ): Promise<IDataset> {
    const id = uuidv4();
    const query = `
      INSERT INTO datasets (id, name, file_key, user_id, created_at, file_type, file_size)
      VALUES ($1, $2, $3, $4, NOW(), $5, $6)
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [id, name, fileKey, userId, fileType, fileSize]);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating dataset:', error);
      throw error;
    }
  }

  /**
   * Get all datasets for a user
   */
  static async findByUserId(userId: string): Promise<IDataset[]> {
    const query = `
      SELECT * FROM datasets
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    try {
      const result = await pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error finding datasets by user ID:', error);
      throw error;
    }
  }

  /**
   * Get a dataset by its ID
   */
  static async findById(id: string): Promise<IDataset | null> {
    const query = `
      SELECT * FROM datasets
      WHERE id = $1
    `;

    try {
      const result = await pool.query(query, [id]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error finding dataset by ID:', error);
      throw error;
    }
  }

  /**
   * Get a dataset by its file key
   */
  static async findByFileId(id: string): Promise<IDataset | null> {
    const query = `
      SELECT * FROM datasets
      WHERE id = $1
    `;

    try {
      const result = await pool.query(query, [id]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error finding dataset by file id:', error);
      throw error;
    }
  }

  /**
   * Update a dataset's name
   */
  static async updateName(id: string, name: string): Promise<IDataset | null> {
    const query = `
      UPDATE datasets
      SET name = $1
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [name, id]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error updating dataset name:', error);
      throw error;
    }
  }

  /**
   * Update a dataset's file key (when renaming in S3)
   */
  static async updateFileKey(id: string, fileKey: string): Promise<IDataset | null> {
    const query = `
      UPDATE datasets
      SET file_key = $1
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [fileKey, id]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error updating dataset file key:', error);
      throw error;
    }
  }

  /**
   * Delete a dataset by its ID
   */
  static async delete(id: string): Promise<boolean> {
    const query = `
      DELETE FROM datasets
      WHERE id = $1
      RETURNING id
    `;

    try {
      const result = await pool.query(query, [id]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting dataset:', error);
      throw error;
    }
  }

  /**
   * Delete a dataset by its file key
   */
  static async deleteByFileKey(fileKey: string): Promise<boolean> {
    const query = `
      DELETE FROM datasets
      WHERE file_key = $1
      RETURNING id
    `;

    try {
      const result = await pool.query(query, [fileKey]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting dataset by file key:', error);
      throw error;
    }
  }
}
