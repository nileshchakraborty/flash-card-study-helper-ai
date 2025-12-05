# MindFlip AI Backend - Wiki Documentation

Welcome to the MindFlip AI Backend documentation wiki. This wiki provides comprehensive guides for integrating and using the MindFlip AI backend API.

## 📚 Documentation Index

### Getting Started
- [Quick Start Guide](Getting-Started.md)
- [Installation & Setup](Installation.md)
- [Configuration Guide](Configuration.md)

### API Documentation
- [Complete API Reference](API-Reference.md)
- [Authentication Guide](Authentication.md)
- [WebLLM Integration](WebLLM-Integration.md)
- [WebSocket API](WebSocket-API.md)

### Integration Guides
- [Frontend Integration](Frontend-Integration.md)
- [Mobile App Integration](Mobile-Integration.md)
- [Third-Party Integration](Third-Party-Integration.md)

### Architecture
- [System Architecture](Architecture.md)
- [Clean Architecture Principles](Clean-Architecture.md)
- [Service Layer Design](Service-Layer.md)

### Advanced Topics
- [Caching Strategy](Caching.md)
- [Queue Management](Queue-Management.md)
- [Error Handling](Error-Handling.md)
- [Performance Optimization](Performance.md)

### Deployment
- [Production Deployment](Deployment.md)
- [Docker Setup](Docker.md)
- [Environment Variables](Environment-Variables.md)

### Troubleshooting
- [Common Issues](Troubleshooting.md)
- [Debugging Guide](Debugging.md)
- [FAQ](FAQ.md)

## 🚀 Quick Links

- **API Base URL**: `http://localhost:3000/api`
- **Swagger UI**: `http://localhost:3000/api-docs`
- **Health Check**: `http://localhost:3000/api/health`
- **Backend README**: [BACKEND_README.md](../../BACKEND_README.md)
- **API Documentation**: [API_DOCUMENTATION.md](../API_DOCUMENTATION.md)

## 📖 Key Features

- ✅ RESTful API with OpenAPI/Swagger documentation
- ✅ WebSocket support for WebLLM
- ✅ OAuth 2.0 authentication (Google)
- ✅ Background job queue (BullMQ)
- ✅ In-memory caching
- ✅ Circuit breakers for resilience
- ✅ Rate limiting
- ✅ File upload (PDF, images with OCR)
- ✅ Quiz generation
- ✅ Comprehensive error handling

## 🔗 External Resources

- [GitHub Repository](https://github.com/your-repo/mindflip-ai)
- [Issue Tracker](https://github.com/your-repo/mindflip-ai/issues)
- [Changelog](https://github.com/your-repo/mindflip-ai/blob/main/CHANGELOG.md)



**Latest updates:** Runtime preference (Ollama/WebLLM) with automatic fallback and flashcard output validation/repair to guarantee correct JSON and requested counts.

**Latest:** Runtime preference (Ollama/WebLLM) with automatic fallback; flashcard validation/repair ensures correct JSON and requested counts; client-side generation will fall back to backend if underfilled.