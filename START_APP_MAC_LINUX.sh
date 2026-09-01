#!/bin/bash
echo "========================================="
echo "       Mubea Technician Dashboard"
echo "========================================="
echo ""

if [ ! -d "node_modules" ]; then
    echo "[1/2] First time setup: Installing dependencies..."
    npm install
    echo ""
    echo "[2/2] Building the application for production..."
    npm run build
    echo ""
fi

echo "Starting the server..."
echo "Please open http://localhost:3000 in your browser if it doesn't open automatically."

# Try to open browser
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000 &
elif command -v open &> /dev/null; then
    open http://localhost:3000 &
fi

npm start
