# ========================================================================
# Dockerfile: Google Cloud Run Deployment for ANTRI Code Platform
# Powered by Google Gemini 3.7 & Google GenAI SDK (@google/genai)
# ========================================================================

FROM node:20-slim

WORKDIR /app

# Install system utilities (git, python3, curl) for autonomous agent tooling
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications
COPY package*.json ./

# Install dependencies cleanly
RUN npm ci || npm install

# Copy source code and configuration
COPY tsconfig.json ./
COPY bin/ ./bin/
COPY src/ ./src/

# Compile TypeScript and bundle frontend assets
RUN npm run build

# Cloud Run sets PORT environment variable (default 8080)
ENV PORT=8080
ENV NODE_ENV=production
ENV ANTRI_PROVIDER=gemini
ENV ANTRI_MODEL=gemini-3.7-flash

EXPOSE 8080

# Health check for container runtimes
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Launch ANTRI Cloud Run Backend API
CMD ["node", "dist/index.js", "backend"]
