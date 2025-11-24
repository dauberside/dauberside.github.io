# MCP Security & Operations Guide

**Last Updated**: 2025-11-21
**Audience**: Developers, DevOps, Security Team
**Related Docs**: [MCP Recipes](./mcp-recipes.md), [Requirements](../requirements/README.md)

---

## Table of Contents

1. [Security Principles](#security-principles)
2. [Environment Variable Management](#environment-variable-management)
3. [Token Rotation Policy](#token-rotation-policy)
4. [Context Optimization](#context-optimization)
5. [Docker Considerations](#docker-considerations)
6. [Troubleshooting](#troubleshooting)
7. [Incident Response](#incident-response)

---

## Security Principles

### 🔐 Rule #1: No Hardcoded Secrets

**NEVER** commit API keys, tokens, or credentials to git.

```json
// ❌ BAD - Hardcoded secret
"env": {
  "OBSIDIAN_API_KEY": "270cc55355f7e4747e643100df3f121cf1360d8c..."
}

// ✅ GOOD - Environment variable reference
"env": {
  "OBSIDIAN_API_KEY": "${MCP_OBSIDIAN_API_KEY}"
}
```

### 🔐 Rule #2: Least Privilege

Use minimal required scopes for each token:

| Service | Required Scopes | Avoid |
|---------|----------------|-------|
| **GitHub** | `repo`, `workflow` | `admin:org`, `delete_repo` |
| **Obsidian** | API key (read/write) | N/A |
| **n8n** | Workflow execution | Admin API access |
| **Slack** | `chat:write`, `channels:read` | `admin`, `files:write` |

### 🔐 Rule #3: Git Hygiene

**.gitignore** MUST exclude:
- `.mcp.json` (actual config with env var references)
- `.env.mcp` (actual secrets)
- `.mcp.local.json` (developer overrides)

**Committed to git**:
- `.mcp.json.example` (template with placeholders)
- `.env.mcp.example` (template with documentation)

### 🔐 Rule #4: Regular Rotation

Rotate all tokens **every 90 days** (see [Token Rotation Policy](#token-rotation-policy)).

---

## Environment Variable Management

### Setup (First Time)

1. **Copy templates**:
   ```bash
   cp .mcp.json.example .mcp.json
   cp .env.mcp.example .env.mcp
   ```

2. **Fill in actual values** in `.env.mcp`:
   ```bash
   # Get Obsidian API key
   # Obsidian → Settings → Community Plugins → Local REST API
   MCP_OBSIDIAN_API_KEY=270cc55355f7e4747e643100df3f121cf1360d8c...

   # Get GitHub PAT
   # https://github.com/settings/tokens/new
   # Scopes: repo, workflow
   MCP_GITHUB_TOKEN=ghp_your_github_token_here

   # Get n8n API key
   # n8n → Settings → API → Create API Key
   MCP_N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Load environment variables**:
   ```bash
   # Option 1: direnv (automatic)
   echo 'dotenv .env.mcp' > .envrc
   direnv allow

   # Option 2: Manual source
   source .env.mcp

   # Option 3: Shell startup script
   # Add to ~/.bashrc or ~/.zshrc:
   # source /path/to/project/.env.mcp
   ```

4. **Verify loading**:
   ```bash
   echo $MCP_OBSIDIAN_API_KEY
   # Should output: 270cc55355f7e4747e643100df3f121cf1360d8c...
   ```

### Advanced: 1Password CLI Integration

For team environments, use 1Password CLI to fetch secrets:

```bash
# .env.mcp
MCP_OBSIDIAN_API_KEY=$(op read "op://Vault/Obsidian/api_key")
MCP_GITHUB_TOKEN=$(op read "op://Vault/GitHub/personal_access_token")
MCP_N8N_API_KEY=$(op read "op://Vault/n8n/jwt_token")
```

### Advanced: Docker Secrets

For production deployments with Docker:

```yaml
# docker-compose.yml
version: '3.8'
services:
  mcp-proxy:
    image: node:22-alpine
    secrets:
      - mcp_obsidian_key
      - mcp_github_token
      - mcp_n8n_jwt
    environment:
      MCP_OBSIDIAN_API_KEY_FILE: /run/secrets/mcp_obsidian_key
      MCP_GITHUB_TOKEN_FILE: /run/secrets/mcp_github_token
      MCP_N8N_API_KEY_FILE: /run/secrets/mcp_n8n_jwt

secrets:
  mcp_obsidian_key:
    file: ./vault/secrets/mcp/obsidian.key
  mcp_github_token:
    file: ./vault/secrets/mcp/github.token
  mcp_n8n_jwt:
    file: ./vault/secrets/mcp/n8n.jwt
```

---

## Token Rotation Policy

### Rotation Schedule

| Token | Lifespan | Rotation Frequency | Automation |
|-------|----------|-------------------|------------|
| **GitHub PAT** | 90 days | Every 90 days | Manual |
| **n8n JWT** | 90 days (default) | Every 90 days | Manual |
| **Obsidian API Key** | No expiry | Every 180 days | Manual |
| **Slack Bot Token** | No expiry | Every 180 days | Manual |

### Rotation Procedure

1. **Create new token** (don't revoke old one yet):
   - GitHub: https://github.com/settings/tokens/new
   - n8n: Settings → API → Create new API key
   - Obsidian: Settings → Community Plugins → Local REST API → Regenerate

2. **Update `.env.mcp`**:
   ```bash
   # Backup old token (temporary)
   MCP_GITHUB_TOKEN_OLD=ghp_old_token_here
   MCP_GITHUB_TOKEN=ghp_new_token_here
   ```

3. **Reload environment**:
   ```bash
   # If using direnv
   direnv reload

   # If manual source
   source .env.mcp

   # Verify new token works
   curl -H "Authorization: Bearer $MCP_GITHUB_TOKEN" \
     https://api.github.com/user
   ```

4. **Test MCP servers**:
   ```bash
   # Restart Claude Code / Cursor
   # Run a test command to verify MCP connectivity
   # Example: List GitHub repos, search Obsidian vault
   ```

5. **Revoke old token** (after 24-48h grace period):
   - GitHub: Settings → Tokens → Revoke
   - n8n: Settings → API → Delete old key
   - Obsidian: No action needed (old key auto-invalidated)

6. **Update tracking** in `.env.mcp`:
   ```bash
   MCP_TOKEN_EXPIRES_GITHUB=2026-02-20
   MCP_TOKEN_EXPIRES_N8N=2025-12-15
   ```

### Automated Expiry Reminders

Create a cron job to check token expiry:

```bash
# scripts/check-token-expiry.sh
#!/bin/bash
source .env.mcp

current_date=$(date +%s)
github_expiry=$(date -j -f "%Y-%m-%d" "$MCP_TOKEN_EXPIRES_GITHUB" +%s)
days_until_expiry=$(( (github_expiry - current_date) / 86400 ))

if [ $days_until_expiry -lt 7 ]; then
  echo "⚠️  WARNING: GitHub token expires in $days_until_expiry days"
  # Send notification (Slack, email, etc.)
fi
```

```bash
# Crontab (run daily at 9am)
0 9 * * * /path/to/scripts/check-token-expiry.sh
```

---

## Context Optimization

### Current State (Before Optimization)

```
Total MCP tools: 56.1k tokens (28% of 200k context)
  - n8n-mcp: ~25k tokens (40+ tools)
  - github: ~20k tokens (30+ tools)
  - obsidian: ~11k tokens (15 tools)
Free space: 3k tokens (CRITICAL)
```

### Optimized State (After Configuration)

```
Total MCP tools: ~10-13k tokens (5-7% of context)
  - obsidian: ~5k tokens (5 tools, autoStart: true)
  - github: ~5k tokens (5 tools, autoStart: true)
  - n8n-mcp: ~3k tokens (5 tools, autoStart: false) → 0k when not loaded
Free space: 60k+ tokens (HEALTHY)
```

### Optimization Strategies

#### 1. Use `allowedTools` to Limit Loaded Tools

```json
// .mcp.json
"obsidian": {
  "allowedTools": [
    "obsidian_get_file_contents",      // Essential
    "obsidian_simple_search",          // Essential
    "obsidian_list_files_in_vault",    // Essential
    "obsidian_append_content",         // Common
    "obsidian_get_periodic_note"       // Common
    // Excluded: complex_search, patch_content, delete_file, etc.
  ]
}
```

**Impact**: 11k → 5k tokens (55% reduction)

#### 2. Use `autoStart: false` for Low-Priority Servers

```json
"n8n-mcp": {
  "metadata": {
    "autoStart": false,  // Only load when explicitly needed
    "lazyLoad": true
  }
}
```

**Impact**: 25k → 0k tokens (100% reduction when not loaded)

#### 3. Disable Unused Servers

```json
"slack": {
  "metadata": {
    "disabled": true  // Completely disabled, never loads
  }
}
```

#### 4. Monitor Context Usage

```bash
# In Claude Code / Cursor
/context

# Look for:
# - MCP tools token usage
# - Free space remaining
# - Autocompact buffer size
```

**Target**: Keep MCP tools <20k tokens (10% of total context)

---

## Docker Considerations

### URL Configuration

MCP servers running in Docker containers need special URL handling:

| Scenario | URL Format | Example |
|----------|-----------|---------|
| **Claude Code → Host service** | `localhost` | `http://localhost:5678` |
| **Docker container → Host service** | `host.docker.internal` | `http://host.docker.internal:5678` |
| **Docker container → Container** | Service name | `http://n8n:5678` |

### Example: n8n MCP Configuration

```json
// .mcp.json
"n8n-mcp": {
  "env": {
    // Default: Docker-to-host communication
    "N8N_API_URL": "${MCP_N8N_API_URL:-http://host.docker.internal:5678}"
  }
}
```

```bash
# .env.mcp

# For local development (Cursor running natively, n8n on host):
MCP_N8N_API_URL=http://localhost:5678

# For Docker development (Cursor in Docker, n8n on host):
MCP_N8N_API_URL=http://host.docker.internal:5678

# For full Docker stack (Cursor in Docker, n8n in docker-compose):
MCP_N8N_API_URL=http://n8n:5678
```

### Slack MCP (Docker-based)

```json
"slack": {
  "command": "docker",
  "args": [
    "run", "-i", "--rm",
    "-e", "SLACK_TEAM_ID",
    "-e", "SLACK_BOT_TOKEN",
    "mcp/slack"
  ]
}
```

**Build Docker image**:
```bash
# Dockerfile
FROM node:22-alpine
RUN npm install -g @modelcontextprotocol/server-slack
ENTRYPOINT ["mcp-slack"]

# Build
docker build -t mcp/slack .
```

---

## Troubleshooting

### Issue: MCP Server Not Loading

**Symptoms**:
- Server doesn't appear in Claude Code /mcp list
- Tools from server unavailable

**Diagnosis**:
```bash
# Check environment variables loaded
echo $MCP_OBSIDIAN_API_KEY
echo $MCP_GITHUB_TOKEN

# Check MCP server logs (in Claude Code)
# Look for authentication errors, network issues
```

**Fixes**:
1. **Verify env vars**: `source .env.mcp`
2. **Check URL reachability**: `curl $MCP_N8N_API_URL/healthz`
3. **Restart Claude Code** after env var changes
4. **Check `.mcp.json` syntax**: `jq . .mcp.json`

### Issue: Token Authentication Failed

**Symptoms**:
- "401 Unauthorized" errors
- "Invalid API key" messages

**Diagnosis**:
```bash
# Test GitHub token
curl -H "Authorization: Bearer $MCP_GITHUB_TOKEN" \
  https://api.github.com/user

# Test n8n API
curl -H "X-N8N-API-KEY: $MCP_N8N_API_KEY" \
  $MCP_N8N_API_URL/api/v1/workflows

# Test Obsidian API
curl -H "Authorization: Bearer $MCP_OBSIDIAN_API_KEY" \
  http://$MCP_OBSIDIAN_HOST:$MCP_OBSIDIAN_PORT/vault/
```

**Fixes**:
1. **Check token expiry** (especially n8n JWT)
2. **Verify token scopes** (GitHub PAT needs `repo`, `workflow`)
3. **Regenerate token** and update `.env.mcp`

### Issue: High Context Usage

**Symptoms**:
- `/context` shows >150k/200k tokens used
- MCP tools consuming >30k tokens

**Diagnosis**:
```bash
# In Claude Code
/context

# Look for:
# - Which MCP servers are loaded
# - How many tools per server
# - autoStart settings
```

**Fixes**:
1. **Add `allowedTools`** to limit tools per server (5-10 max)
2. **Set `autoStart: false`** for low-priority servers
3. **Disable unused servers** with `metadata.disabled: true`
4. **Restart Claude Code** to reload configuration

### Issue: Docker Connection Failed

**Symptoms**:
- "Connection refused" to `localhost:5678`
- MCP server can't reach host services

**Diagnosis**:
```bash
# From host
curl http://localhost:5678/healthz

# From Docker container
docker run --rm alpine/curl -k http://host.docker.internal:5678/healthz
```

**Fixes**:
1. **Change URL** to `host.docker.internal` in `.env.mcp`
2. **Check firewall** allows Docker → host connections
3. **Verify service running** on host: `lsof -i :5678`

---

## Incident Response

### Leaked Token in Git History

**If you accidentally commit a token to git:**

1. **Immediately revoke** the exposed token:
   - GitHub: https://github.com/settings/tokens
   - n8n: Settings → API → Delete key
   - Obsidian: Regenerate API key

2. **Remove from git history** (destructive operation):
   ```bash
   # Remove .mcp.json from all commits
   FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --force \
     --index-filter "git rm --cached --ignore-unmatch .mcp.json" \
     --prune-empty --tag-name-filter cat -- --all

   # Force push (coordinate with team first!)
   git push origin --force --all
   git push origin --force --tags
   ```

3. **Verify removal**:
   ```bash
   # Search entire history for token patterns
   git log -p -S 'ghp_' --all
   git log -p -S 'eyJhbGci' --all
   ```

4. **Create new tokens** and update `.env.mcp`

5. **Add to `.gitignore`** if not already present:
   ```bash
   echo ".mcp.json" >> .gitignore
   echo ".env.mcp" >> .gitignore
   git add .gitignore
   git commit -m "chore: ensure MCP secrets never committed"
   ```

### Unauthorized Access Detected

**If you detect unauthorized API usage:**

1. **Revoke all tokens immediately**
2. **Review access logs**:
   - GitHub: Settings → Security log
   - n8n: Executions → Filter by API key
   - Obsidian: Check plugin logs

3. **Rotate all credentials** (GitHub, n8n, Obsidian, Slack)
4. **Audit `.mcp.json`** for accidental public exposure
5. **Enable 2FA** on all services if not already active

---

## Best Practices Summary

✅ **Security**:
- Never commit `.mcp.json` or `.env.mcp` to git
- Use environment variables for all credentials
- Rotate tokens every 90 days
- Use least privilege scopes

✅ **Context Optimization**:
- Limit each server to 5-10 tools via `allowedTools`
- Set `autoStart: false` for low-priority servers
- Target <20k tokens for all MCP tools
- Monitor usage with `/context`

✅ **Operations**:
- Document token expiry dates in `.env.mcp`
- Test MCP connectivity after token rotation
- Use `host.docker.internal` for Docker-to-host communication
- Keep `.mcp.json.example` and `.env.mcp.example` up-to-date

✅ **Monitoring**:
- Check `/context` regularly for token usage
- Set up expiry reminders (cron job or calendar)
- Review MCP server logs for auth failures
- Test all servers after configuration changes

---

## Related Documentation

- [MCP Recipes](./mcp-recipes.md) - Common workflow patterns
- [Requirements](../requirements/README.md) - System requirements and invariants
- [Deployment Guide](./deploy-and-smoke.md) - Production deployment procedures
- [Security Keys Rotation](../../SECURITY-KEYS-ROTATION.md) - General key rotation guide

---

**Last Updated**: 2025-11-21
**Maintainer**: DevOps Team
**Review Frequency**: Quarterly (or after security incidents)
