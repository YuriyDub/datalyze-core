import pool from '../config/db';
import { v4 as uuidv4 } from 'uuid';

export interface IChat {
  id: string;
  user_id: string;
  dataset_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}

export interface IChatMessage {
  id: string;
  chat_id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: Date;
  sql_query?: string;
  visualization_type?: string;
}

export class Chat {

  static async createTables(): Promise<void> {
    const chatTableQuery = `
      CREATE TABLE IF NOT EXISTS chats (
        id UUID PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    const chatMessagesTableQuery = `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY,
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        sql_query TEXT,
        visualization_type VARCHAR(50)
      )
    `;

    try {
      await pool.query(chatTableQuery);
      await pool.query(chatMessagesTableQuery);
    } catch (error) {
      console.error('Error creating chat tables:', error);
      throw error;
    }
  }

  static async create(userId: string, datasetId: string, title: string): Promise<IChat> {
    const id = uuidv4();
    const query = `
      INSERT INTO chats (id, user_id, dataset_id, title, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [id, userId, datasetId, title]);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }

  static async findByUserId(userId: string): Promise<IChat[]> {
    const query = `
      SELECT c.*, d.name as dataset_name
      FROM chats c
      JOIN datasets d ON c.dataset_id = d.id
      WHERE c.user_id = $1
      ORDER BY c.updated_at DESC
    `;

    try {
      const result = await pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error finding chats by user ID:', error);
      throw error;
    }
  }

  static async findById(id: string): Promise<IChat | null> {
    const query = `
      SELECT c.*, d.name as dataset_name
      FROM chats c
      JOIN datasets d ON c.dataset_id = d.id
      WHERE c.id = $1
    `;

    try {
      const result = await pool.query(query, [id]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error finding chat by ID:', error);
      throw error;
    }
  }

  static async updateTitle(id: string, title: string): Promise<IChat | null> {
    const query = `
      UPDATE chats
      SET title = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [title, id]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error updating chat title:', error);
      throw error;
    }
  }

  static async delete(id: string): Promise<boolean> {
    const query = `
      DELETE FROM chats
      WHERE id = $1
      RETURNING id
    `;

    try {
      const result = await pool.query(query, [id]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  }

  static async addMessage(
    chatId: string,
    content: string,
    role: 'user' | 'assistant',
    title?: string,
    sqlQuery?: string,
    visualizationType?: string,
  ): Promise<IChatMessage> {
    const id = uuidv4();
    const query = `
      INSERT INTO chat_messages (id, chat_id, content, role, created_at, sql_query, visualization_type, title)
      VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7)
      RETURNING *
    `;
    try {
      const result = await pool.query(query, [
        id,
        chatId,
        content,
        role,
        sqlQuery || null,
        visualizationType || null,
        title || null,
      ]);

      await pool.query(
        `
        UPDATE chats
        SET updated_at = NOW()
        WHERE id = $1
      `,
        [chatId],
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error adding chat message:', error);
      throw error;
    }
  }

  static async getMessages(chatId: string): Promise<IChatMessage[]> {
    const query = `
      SELECT *
      FROM chat_messages
      WHERE chat_id = $1
      ORDER BY created_at ASC
    `;

    try {
      const result = await pool.query(query, [chatId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting chat messages:', error);
      throw error;
    }
  }
}
