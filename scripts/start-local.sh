#!/bin/bash

# Configuration
REDIS_CONF="/opt/homebrew/etc/redis.conf"
REDIS_PORT=6379

echo "🚀 Setting up local development environment..."

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping application and background services..."
    
    # Kill the app (child process of this script)
    if [ -n "$APP_PID" ]; then
        kill $APP_PID 2>/dev/null
    fi

    # Stop Redis
    if [ -n "$REDIS_PID" ]; then
        echo "   Stopping Redis (PID: $REDIS_PID)..."
        kill $REDIS_PID 2>/dev/null
    fi
    
    echo "✅ Cleanup complete."
    exit
}

# Trap interrupt signals
trap cleanup SIGINT SIGTERM

# 1. Start Redis
if [ -f "$REDIS_CONF" ]; then
    echo "📦 Starting Redis server..."
    redis-server "$REDIS_CONF" &
    REDIS_PID=$!
    
    # Wait for Redis to be ready
    echo "   Waiting for Redis to accept connections..."
    while ! nc -z localhost $REDIS_PORT; do   
      sleep 0.1
    done
    echo "   ✅ Redis is up."
    
    # 2. Reset Redis Data
    echo "🧹 Resetting Redis data..."
    redis-cli -p $REDIS_PORT FLUSHALL
    echo "   ✅ Redis data flushed."

else
    echo "⚠️  Redis config not found at $REDIS_CONF. Skipping Redis start."
    echo "   Ensure Redis is running manually if needed."
fi

# 3. Start the Application
echo "💿 Starting MindFlip AI Backend..."

# Determine if we should use local queue based on Redis availability
# If Redis started successfully, we default to using it (USE_LOCAL_QUEUE=false)
# But we respect the user's override if they passed it in env
if [ -z "$USE_LOCAL_QUEUE" ]; then
    if [ -n "$REDIS_PID" ]; then
        export USE_LOCAL_QUEUE=false
        echo "   Using Redis for Queues (Redis is active)."
    else
        export USE_LOCAL_QUEUE=true
        echo "   Using In-Memory Queues (Redis skipped)."
    fi
else
    echo "   Using configured Queue mode: USE_LOCAL_QUEUE=$USE_LOCAL_QUEUE"
fi

# Set other local defaults
export USE_LOCAL_DB=true
export USE_LOCAL_VECTOR=true

# Run build and start
npm run clean && npm run build:all && tsx src/index.ts &
APP_PID=$!

# Wait for the app to exit
wait $APP_PID
