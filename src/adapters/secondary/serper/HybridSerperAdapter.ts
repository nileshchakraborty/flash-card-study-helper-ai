import type { SearchServicePort } from '../../../core/ports/interfaces.js';
import { SerperAdapter } from '../serper/index.js';
import { MCPClientWrapper } from '../mcp/MCPClientWrapper.js';
import type { SearchResponse } from '../mcp/types.js';
import { LoggerService } from '../../../core/services/LoggerService.js';

const logger = new LoggerService();

/**
 * Hybrid Serper Adapter
 * - Uses MCP when enabled and healthy
 * - Falls back to direct Serper calls on MCP failure
 */
export class HybridSerperAdapter implements SearchServicePort {
    constructor(
        private mcpClient: MCPClientWrapper | null,
        private directAdapter: SerperAdapter,
        private useMCP: boolean
    ) { }

    async search(query: string, limit: number = 5): Promise<any[]> {
        if (!this.useMCP || !this.mcpClient) {
            return this.directAdapter.search(query);
        }

        try {
            logger.debug('Attempting MCP web search', { query, limit });

            const result = await this.mcpClient.callTool<SearchResponse>(
                'search_web_serper',
                { query, limit }
            );

            logger.info('MCP web search succeeded', { query, limit });
            return result.results;
        } catch (error: any) {
            logger.warn('MCP search failed, falling back to direct Serper', {
                query,
                error: error.message
            });
            return this.directAdapter.search(query);
        }
    }
}
