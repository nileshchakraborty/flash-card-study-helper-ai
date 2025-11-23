import dotenv from 'dotenv';
import { OllamaAdapter } from '../src/adapters/secondary/ollama/index.js';
import { SerperAdapter } from '../src/adapters/secondary/serper/index.js';
import { FileSystemAdapter } from '../src/adapters/secondary/fs/index.js';
import { StudyService } from '../src/core/services/StudyService.js';
import { ExpressServer } from '../src/adapters/primary/express/server.js';

dotenv.config();

// Initialize Adapters
const ollamaAdapter = new OllamaAdapter();
const serperAdapter = new SerperAdapter();
const fsAdapter = new FileSystemAdapter();

// Initialize Core Service with Adapters
const studyService = new StudyService(ollamaAdapter, serperAdapter, fsAdapter);

// Initialize Primary Adapter (Server) with Core Service
const expressServer = new ExpressServer(studyService);

// Export the Express app for Vercel
export default expressServer.getApp();
