#!/bin/bash

# Exit on error
set -e

echo "=========================================================="
echo "🎾 Tennis Reservation Watcher - Local Deployer"
echo "=========================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "Please download and install Node.js from https://nodejs.org/ to run this app."
    exit 1
fi

echo "✅ Node.js detected: $(node -v)"

# Ensure we are in the project root directory
cd "$(dirname "$0")"

# Start the application
echo "🚀 Starting application..."
npm start
