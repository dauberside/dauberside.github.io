# ADR-0009: Railway n8n Deployment

**Status**: Accepted
**Date**: 2025-11-25
**Author**: dauberside

---

## Context

Recipe 4 Phase 2 requires n8n to be deployed to a publicly accessible environment to receive GitHub webhooks for automatic ADR → GitHub Issue creation.

Initial VPS deployment via Tailscale failed due to SSH connection issues. Railway was chosen as the deployment platform for its simplicity and automatic HTTPS support.

---

## Decision

Deploy n8n to Railway with the following configuration:

1. **Platform**: Railway (https://railway.app/)
2. **Image**: n8nio/n8n:1.116.2 (via Dockerfile.railway)
3. **URL**: https://n8n-production-f846.up.railway.app
4. **Authentication**: BASIC auth (admin user)
5. **Database**: SQLite (with automatic volume persistence)
6. **Timezone**: Asia/Tokyo

---

## Consequences

### Positive
- ✅ Deployment completed in minutes
- ✅ Automatic HTTPS with Let's Encrypt
- ✅ GitHub integration for auto-deploy on push
- ✅ Built-in volume persistence for data
- ✅ Free tier available for testing
- ✅ Easy environment variable management
- ✅ Seamless workflow import and execution

### Negative
- ⚠️ Railway URL is not custom (n8n-production-f846.up.railway.app)
- ⚠️ Cost scales with usage (need to monitor)

### Neutral
- Future option to add custom domain (n8n.🈴.st) if needed

---

## Implementation Notes

- Environment variables configured via Railway UI
- Encryption key generated with `openssl rand -hex 32`
- BASIC auth password generated with `openssl rand -base64 24`
- Workflow imported: `recipe-04-phase2-github-webhook.json`
- GitHub webhook URL updated to Railway endpoint
- URL expression syntax fixed for n8n v1.120 compatibility

---

## Related Documents

- [Railway Deployment Guide](../../services/n8n/README-RAILWAY.md)
- [n8n Production Deployment Plan](../operations/n8n-production-deployment.md)
- [Recipe 4 Phase 2 Test](./ADR-0008-recipe-4-phase2-test.md)
- [Phase 2 Automation Strategy](./ADR-0006-phase-2-automation-strategy.md)

---

**Railway deployment for Cortex OS automation hub** 🚀
