import type { SearchResult, SearchServicePort } from '../../../core/ports/interfaces.js';
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

    async search(query: string, limit: number = 5): Promise<SearchResult[]> {
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
            return (result.results || []).map(item => ({
                title: item.title ?? '',
                link: item.link ?? '',
                snippet: item.snippet ?? item.description ?? ''
            }));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.warn('MCP search failed, falling back to direct Serper', {
                query,
                error: message
            });
            return this.directAdapter.search(query);
        }
    }
}
