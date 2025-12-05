
import { AuthService } from '../src/core/services/AuthService.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function verifyBackendGeneration() {
    try {
        console.log('🔐 Generating test auth token...');
        const authService = AuthService.getInstance();
        const token = await authService.encryptToken({
            id: 'test-verifier',
            email: 'verifier@example.com',
            name: 'Verifier'
        });

        const PORT = 3002;
        const API_URL = `http://localhost:${PORT}/api/generate`;
        const COUNT = 2;

        console.log(`🚀 Testing API at ${API_URL} with count=${COUNT}...`);

        const response = await axios.post(
            API_URL,
            {
                topic: 'The Moon',
                count: COUNT,
                mode: 'standard',
                knowledgeSource: 'ai-web', // Force backend generation
                runtime: 'ollama'
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status === 202) {
            console.log('✅ Request accepted (202). Job ID:', response.data.jobId);
            console.log('⏳ Waiting for job completion...');

            // Poll for job status
            const jobId = response.data.jobId;
            let jobStatus = 'active';
            let result = null;

            for (let i = 0; i < 20; i++) { // Wait up to 20 seconds
                await new Promise(r => setTimeout(r, 1000));
                const statusRes = await axios.get(`http://localhost:${PORT}/api/jobs/${jobId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                jobStatus = statusRes.data.status;
                if (jobStatus === 'completed') {
                    result = statusRes.data.result;
                    break;
                } else if (jobStatus === 'failed') {
                    throw new Error(`Job failed: ${statusRes.data.failedReason}`);
                }
                process.stdout.write('.');
            }
            console.log('\n');

            if (result && result.cards) {
                console.log(`📦 Generated ${result.cards.length} cards.`);
                if (result.cards.length === COUNT) {
                    console.log('✅ SUCCESS: Card count matches requested count!');
                    console.log('Cards:', result.cards.map((c: any) => c.front));
                } else {
                    console.error(`❌ FAILURE: Expected ${COUNT} cards, got ${result.cards.length}`);
                }
            } else {
                console.error('❌ Failed to get results or timeout.');
            }

        } else {
            console.log('Response:', response.status, response.data);
        }

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

verifyBackendGeneration();
