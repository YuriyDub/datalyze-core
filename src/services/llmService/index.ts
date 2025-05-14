import { S3Service } from '../s3Service';
import { Dataset } from '../../models/Dataset';
import { Chat } from '../../models/Chat';
import { IDatabaseSchema, ILLMResponse, ITableSchema } from './types';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { toCamelCase } from '../../utils/toCamelCase';

export class LLMService {
  private static readonly TEMP_DIR = 'uploads/temp';
  private static readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  static initialize(): void {
    if (!this.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY is not set. LLM functionality will not work.');
    }

    if (!fs.existsSync(this.TEMP_DIR)) {
      fs.mkdirSync(this.TEMP_DIR, { recursive: true });
    }
  }

  private static async getDatabaseSchema(dbPath: string): Promise<IDatabaseSchema> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(new Error(`Failed to open database: ${err.message}`));
          return;
        }
      });

      const schema: IDatabaseSchema = { tables: [] };

      db.all(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
        [],
        (err, tables: { name: string }[]) => {
          if (err) {
            db.close();
            reject(new Error(`Failed to get tables: ${err.message}`));
            return;
          }

          if (tables.length === 0) {
            db.close();
            resolve(schema);
            return;
          }

          let tablesProcessed = 0;

          tables.forEach((table) => {
            db.all(`PRAGMA table_info(${table.name})`, [], (err, columns: any[]) => {
              if (err) {
                db.close();
                reject(new Error(`Failed to get columns for table ${table.name}: ${err.message}`));
                return;
              }

              const tableSchema: ITableSchema = {
                name: table.name,
                columns: columns.map((col) => ({
                  name: col.name,
                  type: col.type,
                })),
              };

              schema.tables.push(tableSchema);
              tablesProcessed++;

              if (tablesProcessed === tables.length) {
                db.close();
                resolve(schema);
              }
            });
          });
        },
      );
    });
  }

  private static async executeSqlQuery(
    dbPath: string,
    query: string,
  ): Promise<{ columns: string[]; rows: any[] }> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(new Error(`Failed to open database: ${err.message}`));
          return;
        }
      });

      db.all(query, [], (err, rows) => {
        if (err) {
          db.close();
          reject(new Error(`Failed to execute query: ${err.message}`));
          return;
        }

        const columns = rows.length > 0 ? Object.keys(toCamelCase(rows[0] as object)) : [];

        db.close();
        resolve({ columns, rows });
      });
    });
  }

  private static async downloadDataset(datasetId: string): Promise<string> {
    const dataset = await Dataset.findById(datasetId);
    if (!dataset) {
      throw new Error(`Dataset with ID ${datasetId} not found`);
    }

    const url = await S3Service.generatePresignedUrl(dataset.file_key);
    if (!url) {
      throw new Error(`Failed to generate presigned URL for dataset ${datasetId}`);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download dataset: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const dbPath = path.join(this.TEMP_DIR, `${dataset.id}.db`);

    fs.writeFileSync(dbPath, Buffer.from(buffer));

    return dbPath;
  }

  private static extractSqlQueryAndTile(content: string): { title?: string; sqlQuery?: string } {
    const regex = /```([^\n]+) sql\n([\s\S]*?)```/gi;
    const matches = [...content.matchAll(regex)];
    const [_, title, sqlQuery] = matches[0] ?? [];
    if (sqlQuery) {
      return { title: title.trim(), sqlQuery: sqlQuery.trim() };
    }

    return { title: undefined, sqlQuery: undefined };
  }

  static async processMessage(
    chatId: string,
    message: string,
    userId: string,
  ): Promise<ILLMResponse> {
    try {
      if (!this.OPENAI_API_KEY) {
        return {
          content:
            'OpenAI API key is not configured. Please set the OPENAI_API_KEY environment variable.',
          error: 'OpenAI API key not configured',
        };
      }

      const chat = await Chat.findById(chatId);
      if (!chat) {
        return {
          content: `Chat with ID ${chatId} not found`,
          error: 'Chat not found',
        };
      }

      if (chat.user_id !== userId) {
        return {
          content: 'You do not have permission to access this chat',
          error: 'Permission denied',
        };
      }

      const dbPath = await this.downloadDataset(chat.dataset_id);

      const schema = await this.getDatabaseSchema(dbPath);

      const previousMessages = await Chat.getMessages(chatId);

      const chatHistory = previousMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      await Chat.addMessage(chatId, message, 'user');

      const model = new ChatOpenAI({
        openAIApiKey: this.OPENAI_API_KEY,
        modelName: 'gpt-4o-mini',
        temperature: 0,
      });

      const systemPrompt = `
You are a data analytics assistant that helps users analyze SQLite databases.
You have access to a database with the following schema:

${schema.tables
  .map(
    (table) => `Table: ${table.name}
Columns: ${table.columns.map((col) => `${col.name} (${col.type})`).join(', ')}`,
  )
  .join('\n\n')}

When answering questions about the data, follow these rules:
1. For analytical questions (averages, medians, distributions, correlations, etc.), generate a SQL query that answers the question.
2. Wrap the SQL query in a code block with the sql tag: \`\`\`sql
3. Provide title before sql: \`\`\`title sql
4. Title describes what type of data we get from the query.
5. If you cannot answer a question with the available data, explain why.
6. Never make up data or tables that don't exist in the schema.
7. Use proper SQL syntax for SQLite.
8. Do not talk about sql query for example:
 - To see all products, you can use a simple SQL query that selects all columns from the 'products' table. Here's the SQL query to retrieve all products:
 - Here's the query to retrieve all clients from the users table:

Examples of good responses (it's just example do not use it as answer):

User: Hello, what's the average age of users?
Assistant: 
Hello, the average age of users:
\`\`\`Average age sql
SELECT AVG(age) AS average_age FROM users;
\`\`\`
What you want to know next?

User: Show me the distribution of product categories
Assistant: 
Here's the distribution of product categories:
\`\`\`Categories distribution sql
SELECT category, COUNT(*) as count 
FROM products 
GROUP BY category 
ORDER BY count DESC;
\`\`\`
Have any questions?
`;

      const chatPrompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        ...chatHistory.map((msg) => [msg.role, msg.content] as [string, string]),
        ['user', message],
      ]);

      const chain = RunnableSequence.from([chatPrompt, model, new StringOutputParser()]);

      const result = await chain.invoke({});

      const { sqlQuery, title } = this.extractSqlQueryAndTile(result);
      await Chat.addMessage(chatId, result, 'assistant', title, sqlQuery);

      try {
        fs.unlinkSync(dbPath);
      } catch (error) {
        console.error(`Failed to delete temporary file ${dbPath}:`, error);
      }
      return {
        content: result,
        sqlQuery,
        title,
      };
    } catch (error) {
      console.error('Error processing message:', error);
      if (error instanceof Error) {
        return {
          content: `An error occurred: ${error.message}`,
          error: error.message,
        };
      }
      return {
        content: 'An unknown error occurred',
        error: 'Unknown error',
      };
    }
  }

  static async executeQuery(datasetId: string, sqlQuery: string, userId: string): Promise<any> {
    try {
      const dataset = await Dataset.findById(datasetId);
      if (!dataset) {
        throw new Error(`Dataset with ID ${datasetId} not found`);
      }

      if (dataset.user_id !== userId) {
        throw new Error('You do not have permission to access this dataset');
      }

      const dbPath = await this.downloadDataset(datasetId);

      const result = await this.executeSqlQuery(dbPath, sqlQuery);
      try {
        fs.unlinkSync(dbPath);
      } catch (error) {
        console.error(`Failed to delete temporary file ${dbPath}:`, error);
      }

      return result;
    } catch (error) {
      console.error('Error executing query:', error);
      throw error;
    }
  }
}
