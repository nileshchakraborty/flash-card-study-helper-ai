import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import CircuitBreaker from 'opossum';
import { LoggerService } from '../../../core/services/LoggerService.js';

const logger = new LoggerService();

interface MCPClientConfig {
    command?: string;
    timeout?: number;
    circuitBreakerOptions?: {
        timeout?: number;
        errorThresholdPercentage?: number;
        resetTimeout?: number;
    };
}

export class MCPClientWrapper {
    private client: Client | null = null;
    private transport: StdioClientTransport | null = null;
    private serverProcess: ChildProcess | null = null;
    private connected = false;
    private circuitBreaker: CircuitBreaker;
    private config: MCPClientConfig;
    private reconnecting = false;

    constructor(config: MCPClientConfig = {}) {
        this.config = {
            command: config.command || process.env.MCP_SERVER_COMMAND || 'node mcp-server/dist/index.js',
            timeout: config.timeout || parseInt(process.env.MCP_CLIENT_TIMEOUT || '5000'),
            circuitBreakerOptions: {
                timeout: config.circuitBreakerOptions?.timeout || 5000,
                errorThresholdPercentage: config.circuitBreakerOptions?.errorThresholdPercentage || 50,
                resetTimeout: config.circuitBreakerOptions?.resetTimeout || 10000,
            }
        };

        // Create circuit breaker
        this.circuitBreaker = new CircuitBreaker(this.executeCall.bind(this), {
            timeout: this.config.circuitBreakerOptions!.timeout,
            errorThresholdPercentage: this.config.circuitBreakerOptions!.errorThresholdPercentage,
            resetTimeout: this.config.circuitBreakerOptions!.resetTimeout,
            name: 'mcp-client',
        });

        // Circuit breaker event handlers
        this.circuitBreaker.on('open', () => {
            logger.warn('MCP circuit breaker opened - too many failures');
        });

        this.circuitBreaker.on('halfOpen', () => {
            logger.info('MCP circuit breaker half-open - testing connection');
        });

        this.circuitBreaker.on('close', () => {
            logger.info('MCP circuit breaker closed - connection restored');
        });

        this.circuitBreaker.fallback(() => {
            throw new Error('MCP circuit breaker open - fallback to direct adapter');
        });
    }

    async connect(): Promise<void> {
        if (this.connected) {
            return;
        }

        try {
            const [command, ...args] = this.config.command!.split(' ');

            logger.info('Starting MCP server', { command, args });

            // Spawn MCP server process
            this.serverProcess = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd(),
            });

            // Handle server process errors
            this.serverProcess.on('error', (error) => {
                logger.error('MCP server process error', { error: error.message });
                this.connected = false;
            });

            this.serverProcess.on('exit', (code) => {
                logger.warn('MCP server process exited', { code });
                this.connected = false;
                this.attemptReconnect();
            });

            // Create transport
            this.transport = new StdioClientTransport({
                command,
                args,
            });

            // Create client
            this.client = new Client(
                {
                    name: 'mindflip-ai-backend',
                    version: '1.0.0',
                },
                {
                    capabilities: {},
                }
            );

            await this.client.connect(this.transport);
            this.connected = true;

            logger.info('MCP client connected successfully');
        } catch (error: any) {
            logger.error('Failed to connect to MCP server', { error: error.message });
            this.connected = false;
            throw error;
        }
    }

    private async attemptReconnect(): Promise<void> {
        if (this.reconnecting) {
            return;
        }

        this.reconnecting = true;
        logger.info('Attempting to reconnect to MCP server');

        setTimeout(async () => {
            try {
                await this.connect();
                this.reconnecting = false;
                logger.info('MCP server reconnected successfully');
            } catch (error) {
                logger.error('MCP reconnection failed', { error });
                this.reconnecting = false;
            }
        }, 5000); // Wait 5 seconds before reconnecting
    }

    async callTool<T = any>(name: string, parameters: Record<string, any>): Promise<T> {
        return this.circuitBreaker.fire(name, parameters) as Promise<T>;
    }

    private async executeCall<T = any>(name: string, parameters: Record<string, any>): Promise<T> {
        if (!this.connected || !this.client) {
            throw new Error('MCP client not connected');
        }

        logger.debug('Calling MCP tool', { tool: name, parameters });

        try {
            const response = await this.client.callTool({
                name,
                arguments: parameters,
            });

            if (response.isError) {
                const errorText = response.content[0]?.text || 'Unknown error';
                logger.error('MCP tool returned error', { tool: name, error: errorText });
                throw new Error(`MCP tool ${name} failed: ${errorText}`);
            }

            const resultText = response.content[0]?.text || '{}';
            const result = JSON.parse(resultText);

            logger.debug('MCP tool succeeded', { tool: name });
            return result as T;
        } catch (error: any) {
            logger.error('MCP tool execution failed', { tool: name, error: error.message });
            throw error;
        }
    }

    async listTools(): Promise<any[]> {
        if (!this.connected || !this.client) {
            throw new Error('MCP client not connected');
        }

        const response = await this.client.listTools();
        return response.tools;
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.listTools();
            return true;
        } catch (error) {
            logger.error('MCP health check failed', { error });
            return false;
        }
    }

    getCircuitState(): string {
        return this.circuitBreaker.opened ? 'open' :
            this.circuitBreaker.halfOpen ? 'half-open' : 'closed';
    }

    isConnected(): boolean {
        return this.connected;
    }

    async disconnect(): Promise<void> {
        if (this.client && this.transport) {
            await this.client.close();
            this.connected = false;
            logger.info('MCP client disconnected');
        }

        if (this.serverProcess) {
            this.serverProcess.kill();
            this.serverProcess = null;
        }
    }
}
