#!/bin/bash
# Run Electron in development mode for debugging

echo "Starting SwarmUI Electron in Development Mode..."

# Kill any existing processes
pkill -f "rails server" || true
pkill -f electron || true
sleep 1

# Run migrations for development
echo "Running migrations..."
bundle exec rails db:migrate

# Start Electron with development Rails
export RAILS_ENV=development
export ACTION_CABLE_ADAPTER=async
export ELECTRON_APP=true

echo "Starting Electron..."
npx electron electron-dev.js