#!/bin/bash
set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Levantando TestForge...${NC}"

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado o no está en el PATH.${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker no está corriendo. Ábrelo primero.${NC}"
    exit 1
fi

# Levantar PostgreSQL + pgvector
echo -e "${GREEN}🐘 Levantando PostgreSQL + pgvector...${NC}"
docker compose -f docker/docker-compose.yml up -d --wait

# Verificar Ollama
echo -e "${GREEN}🦙 Verificando Ollama...${NC}"
if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo -e "${RED}❌ Ollama no responde en http://localhost:11434.${NC}"
    echo -e "${YELLOW}   Asegúrate de tener Ollama instalado y corriendo:${NC}"
    echo -e "   ollama serve"
    exit 1
fi

# Verificar modelos necesarios usando la API de Ollama
MODELS_JSON=$(curl -s http://localhost:11434/api/tags)
OLLAMA_COMMAND="ollama pull"

# Detectar si Ollama corre en el contenedor de Docker
if docker ps --format '{{.Names}}' | grep -q "^testforge-ollama$"; then
    OLLAMA_COMMAND="docker exec testforge-ollama ollama pull"
fi

if ! echo "$MODELS_JSON" | grep -q "nomic-embed-text"; then
    echo -e "${YELLOW}⚠️  Modelo nomic-embed-text no encontrado. Instálalo con:${NC}"
    echo -e "   ${OLLAMA_COMMAND} nomic-embed-text"
    exit 1
fi
if ! echo "$MODELS_JSON" | grep -q "llama3.2"; then
    echo -e "${YELLOW}⚠️  Modelo llama3.2 no encontrado. Instálalo con:${NC}"
    echo -e "   ${OLLAMA_COMMAND} llama3.2:3b"
    exit 1
fi

echo -e "${GREEN}✅ Ollama listo con los modelos necesarios.${NC}"

# Aplicar migraciones
echo -e "${GREEN}🗄️  Aplicando migraciones...${NC}"
npx prisma migrate deploy

# Generar cliente Prisma por si acaso
echo -e "${GREEN}🔧 Generando cliente de Prisma...${NC}"
npx prisma generate

echo -e "${GREEN}✅ Todo listo. Iniciando Next.js...${NC}"
npm run dev
