#!/bin/bash
set -e

echo "Building Shader3D packages..."

cd packages/core && npm install --silent && npx tsc && cd ../..
echo "  @shader3d/core"

cd packages/runtime && npm install --silent && npx tsc && cd ../..
echo "  @shader3d/runtime"

cd packages/ladder && npm install --silent && npx tsc && cd ../..
echo "  @shader3d/ladder"

cd packages/vite-plugin && npm install --silent && npx tsc && cd ../..
echo "  @shader3d/vite-plugin"

echo "Done."
