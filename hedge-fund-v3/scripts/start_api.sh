#!/bin/bash
set -e

echo "Starting Hedge Fund V3 API..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
