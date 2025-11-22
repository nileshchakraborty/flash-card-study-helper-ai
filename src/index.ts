import dotenv from 'dotenv';
import { OllamaAdapter } from './adapters/secondary/ollama/index.js';
import { SerperAdapter } from './adapters/secondary/serper/index.js';
import { FileSystemAdapter } from './adapters/secondary/fs/index.js';
import { StudyService } from './core/services/StudyService.js';
import { ExpressServer } from './adapters/primary/express/server.js';

dotenv.config();

// 1. Initialize Adapters
const ollamaAdapter = new OllamaAdapter();
const serperAdapter = new SerperAdapter();
const fsAdapter = new FileSystemAdapter();

// 2. Initialize Core Service with Adapters
const studyService = new StudyService(ollamaAdapter, serperAdapter, fsAdapter);

// 3. Initialize Primary Adapter (Server) with Core Service
const server = new ExpressServer(studyService);

// 4. Start Application
const PORT = parseInt(process.env.PORT || '3000');
server.start(PORT);
