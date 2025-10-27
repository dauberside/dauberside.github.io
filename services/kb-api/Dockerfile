# Minimal Dockerfile for KB API
FROM node:22-alpine

# Create app directory structure matching repo layout for relative paths
WORKDIR /app/services/kb-api

# Copy server only (no external deps)
COPY server.mjs ./server.mjs

# Expose default port
EXPOSE 4040

# Run
CMD ["node", "server.mjs"]
