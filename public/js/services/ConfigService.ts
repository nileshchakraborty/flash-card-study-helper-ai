
export class ConfigService {
    private config: Map<string, string> = new Map();
    private loaded = false;

    async loadConfig(): Promise<void> {
        if (this.loaded) return;

        try {
            const response = await fetch('/app.properties');
            if (response.ok) {
                const text = await response.text();
                text.split('\n').forEach(line => {
                    const [key, value] = line.split('=');
                    if (key && value) {
                        this.config.set(key.trim(), value.trim());
                    }
                });
                console.log('✅ Configuration loaded:', Object.fromEntries(this.config));
            } else {
                console.warn('⚠️ Failed to load app.properties, using defaults.');
            }
        } catch (error) {
            console.warn('⚠️ Error loading app.properties:', error);
        } finally {
            this.loaded = true;
        }
    }

    get(key: string, defaultValue: string = ''): string {
        return this.config.get(key) || defaultValue;
    }

    getJobTimeout(): number {
        const val = this.config.get('job.timeout.ms');
        return val ? parseInt(val, 10) : 180000; // Default 3m if missing
    }
}

export const configService = new ConfigService();
