#!/bin/bash
# Test script for Electron app

echo "Testing Electron setup..."

# Check if database exists
if [ ! -f "storage/production.sqlite3" ]; then
  echo "Database does not exist. Running migrations..."
  RAILS_ENV=production SECRET_KEY_BASE=test-key ACTION_CABLE_ADAPTER=async ELECTRON_APP=true bundle exec rails db:prepare
fi

echo "Starting Electron app..."
pnpm run electron