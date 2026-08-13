#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Keep the merge hook deterministic and safe when stdin is closed.
npm install --no-audit --no-fund --ignore-scripts
npm run lint