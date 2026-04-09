#!/bin/bash
set -e

echo "Starting Hedge Fund V3 Celery Worker..."
celery -A app.celery_app:celery_app worker --loglevel=info --concurrency=4
