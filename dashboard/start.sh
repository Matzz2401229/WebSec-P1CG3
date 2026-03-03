#!/bin/bash
python -u /app/log_parser.py &
exec uvicorn api:app --host 0.0.0.0 --port 3000 --reload
