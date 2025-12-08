#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ollamaTool } from './tools/ollama.tool.js';
import { serperTool } from './tools/serper.tool.js';
import { flashcardsOllamaTool } from './tools/flashcards-ollama.tool.js';
import { searchWebTool } from './tools/search-web.tool.js';

const server = new Server(
    {
        name: 'mindflip-ai-mcp-server',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Register tools
const tools = [
    ollamaTool,
    serperTool,
    flashcardsOllamaTool,
    searchWebTool,
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
        })),
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find(t => t.name === request.params.name);

    if (!tool) {
        throw new Error(`Unknown tool: ${request.params.name}`);
    }

    try {
        const result = await tool.execute(request.params.arguments || {});
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    } catch (error: any) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ error: error.message }, null, 2),
                },
            ],
            isError: true,
        };
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Server running on stdio');
}

main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
