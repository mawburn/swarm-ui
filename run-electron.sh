#!/bin/bash
# Script to run SwarmUI in Electron

echo "Starting SwarmUI Electron App..."

# Kill any existing processes
pkill -f "rails server" || true
pkill -f electron || true

# Export environment variables
export RAILS_ENV=production
export ACTION_CABLE_ADAPTER=async
export ELECTRON_APP=true
export RAILS_SERVE_STATIC_FILES=true
export SECRET_KEY_BASE=${SECRET_KEY_BASE:-development-secret-key-base-for-electron-app}

# Ensure database exists and is migrated
echo "Setting up database..."
bundle exec rails db:prepare

# Precompile assets if needed
if [ ! -d "public/assets" ] || [ ! -f "public/assets/.manifest.json" ]; then
  echo "Precompiling assets..."
  bundle exec rails assets:precompile
fi

# Run Electron
echo "Starting Electron..."
pnpm run electron
