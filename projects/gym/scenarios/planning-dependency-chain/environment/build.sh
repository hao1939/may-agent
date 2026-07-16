#!/bin/bash
# Build script
PORT=8080
echo "Building app on port $PORT..."
tar -czf ./dist/app.tar.gz src/
echo "Done. Listening on $PORT"
