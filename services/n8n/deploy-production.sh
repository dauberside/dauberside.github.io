#!/bin/bash
# n8n Production Deployment Script
# Usage: ./deploy-production.sh
# Last Updated: 2025-11-25

set -e

echo "🚀 n8n Production Deployment"
echo "================================"

# Configuration
VPS_HOST="${VPS_HOST:-thx1138.tail90d80e.ts.net}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/n8n}"

echo "📋 Configuration:"
echo "  VPS: $VPS_USER@$VPS_HOST"
echo "  Deploy Directory: $DEPLOY_DIR"
echo ""

# Check SSH connection
echo "🔐 Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 "$VPS_USER@$VPS_HOST" "echo 'SSH connection successful'"; then
    echo "❌ SSH connection failed. Please check:"
    echo "   1. VPS Host: $VPS_HOST"
    echo "   2. SSH user: $VPS_USER"
    echo "   3. SSH key authentication"
    echo "   4. Tailscale connection"
    exit 1
fi

# Check Docker
echo "🐳 Checking Docker installation..."
ssh "$VPS_USER@$VPS_HOST" "docker --version && docker compose version" || {
    echo "❌ Docker not found. Installing Docker..."
    ssh "$VPS_USER@$VPS_HOST" "curl -fsSL https://get.docker.com | sh"
}

# Create deployment directory
echo "📁 Creating deployment directory..."
ssh "$VPS_USER@$VPS_HOST" "mkdir -p $DEPLOY_DIR"

# Copy files
echo "📦 Copying files to VPS..."
scp docker-compose.production.yml "$VPS_USER@$VPS_HOST:$DEPLOY_DIR/docker-compose.yml"
scp .env.production "$VPS_USER@$VPS_HOST:$DEPLOY_DIR/.env"
scp Caddyfile "$VPS_USER@$VPS_HOST:$DEPLOY_DIR/"

# Deploy n8n
echo "🚀 Starting n8n..."
ssh "$VPS_USER@$VPS_HOST" "cd $DEPLOY_DIR && docker compose up -d n8n"

# Wait for n8n to start
echo "⏳ Waiting for n8n to start..."
sleep 10

# Check status
echo "✅ Checking n8n status..."
ssh "$VPS_USER@$VPS_HOST" "cd $DEPLOY_DIR && docker compose ps"
ssh "$VPS_USER@$VPS_HOST" "cd $DEPLOY_DIR && docker compose logs n8n --tail 20"

echo ""
echo "================================"
echo "✅ Deployment complete!"
echo ""
echo "🌐 n8n URL: https://n8n.xn--rn8h03a.st"
echo ""
echo "📝 Next steps:"
echo "   1. Configure reverse proxy (Caddy/Nginx) for HTTPS"
echo "   2. Test n8n UI access"
echo "   3. Import Recipe 4 Phase 2 workflow"
echo ""
