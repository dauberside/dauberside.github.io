# Minimal Dockerfile for MCP skeleton (HTTP adapter)
FROM node:22-alpine

WORKDIR /app/services/mcp

COPY server.mjs ./server.mjs

EXPOSE 5050

CMD ["node", "server.mjs"]
