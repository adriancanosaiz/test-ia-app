#!/bin/bash
set -e

echo "🛑 Parando servicios de TestForge..."
docker compose -f docker/docker-compose.yml down
echo "✅ Servicios parados. Ollama sigue corriendo si lo tenías abierto."
