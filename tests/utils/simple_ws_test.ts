import WebSocket from 'ws';

// Simple WebSocket test without graphql-ws protocol
const ws = new WebSocket('ws://localhost:3000/subscriptions');

ws.on('open', () => {
    console.log('✅ WebSocket connected!');
    console.log('Protocol:', ws.protocol);
    ws.close();
    process.exit(0);
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
});

ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: ${code} - ${reason.toString()}`);
});

setTimeout(() => {
    console.log('❌ Timeout waiting for connection');
    ws.close();
    process.exit(1);
}, 5000);
