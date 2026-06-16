#!/usr/bin/env bash
set -e

echo "Descargando modelos locales por defecto para TestForge..."

ollama pull nomic-embed-text
ollama pull llama3.2:3b

echo "Listo. Modelos disponibles:"
ollama list
