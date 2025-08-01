import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import fileRoutes from './routes/fileRoutes';
import chatRoutes from './routes/chatRoutes';
import cookieParser from 'cookie-parser';
import { camelCaseMiddleware } from './middleware/camelCaseMiddleware';
import fileUpload from 'express-fileupload';
import { Dataset } from './models/Dataset';
import { Chat } from './models/Chat';
import { LLMService } from './services/llmService';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? 'http://ec2-51-20-122-41.eu-north-1.compute.amazonaws.com'
        : 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(camelCaseMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);

app.use(
  fileUpload({
    limits: { fileSize: 100 * 1024 * 1024 }, 
    abortOnLimit: true,
    createParentPath: true, 
    useTempFiles: false, 
    safeFileNames: true,
    preserveExtension: 4, 
  }),
);

app.use('/api/files', fileRoutes);

const PORT = process.env.PORT || 3000;


(async () => {
  try {
    LLMService.initialize();

    await Dataset.createTable();
    await Chat.createTables();

    console.log('Database tables and services initialized');
  } catch (error) {
    console.error('Error initializing database tables and services:', error);
  }
})();

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
