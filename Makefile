# Makefile for dauberside.github.io
# Common development tasks and utilities

.PHONY: help dev build test lint typecheck ci claude reload-mcp dashboard

.DEFAULT_GOAL := help

# Colors for output
CYAN := \033[36m
RESET := \033[0m

help: ## Show this help message
	@echo "$(CYAN)Available targets:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-15s$(RESET) %s\n", $$1, $$2}'

# Development
dev: ## Start development server (port 3001 recommended)
	pnpm dev -p 3001

dev-kb: ## Rebuild KB index and start dev server
	pnpm dev:kb

dev-mcp: ## Show MCP setup guide and start dev server
	pnpm dev:mcp

# Quality Gates
lint: ## Run ESLint
	pnpm lint

typecheck: ## Run TypeScript type checking
	pnpm typecheck

test: ## Run all tests
	pnpm test

test-watch: ## Run tests in watch mode
	pnpm test:watch

build: ## Full build with agent generation
	pnpm build

ci: ## Run all quality checks (lint + typecheck + test + build)
	pnpm ci

# MCP & Claude Code
claude: ## Start Claude Code with MCP environment loaded
	@echo "$(CYAN)Starting Claude Code with MCP environment...$(RESET)"
	@./bin/claude-dev

reload-mcp: ## Reload MCP environment variables
	@echo "$(CYAN)Reloading MCP environment variables...$(RESET)"
	@bash -c 'source ./bin/reload-mcp && env | grep "^MCP_"'

check-mcp: ## Check MCP environment variables status
	@echo "$(CYAN)MCP Environment Variables:$(RESET)"
	@env | grep "^MCP_" | sed 's/=.*/=***/' | sort || echo "  No MCP variables found"

# Agent Builder
agent-validate: ## Validate agent configuration
	pnpm agent:builder:validate

agent-generate: ## Generate agent code from configs
	pnpm agent:builder:generate

agent-smoke: ## Run agent smoke test
	pnpm agent:builder:smoke

# Knowledge Base
kb-build: ## Build KB embeddings index
	pnpm kb:build

kb-smoke: ## Test KB API
	pnpm kb:smoke:api

# Operations
ops-allowlist: ## List IP allowlist
	pnpm ops:allowlist:list

# PM2
pm2-start: ## Start all PM2 services
	npx pm2 start services/ecosystem.config.cjs

pm2-restart: ## Restart main app
	npx pm2 restart next-app

pm2-reload: ## Reload app with env updates
	npx pm2 reload next-app --update-env

pm2-logs: ## View PM2 logs
	npx pm2 logs next-app --lines 200

pm2-status: ## Check PM2 process status
	npx pm2 status

# Utilities
clean: ## Clean build artifacts
	rm -rf .next out dist

install: ## Install dependencies
	pnpm install

update: ## Update dependencies
	pnpm update

# Git helpers
git-status: ## Show git status with useful info
	@echo "$(CYAN)Git Status:$(RESET)"
	@git status -sb
	@echo ""
	@echo "$(CYAN)Recent commits:$(RESET)"
	@git log --oneline -5

# Documentation
docs: ## Open documentation map
	@echo "$(CYAN)Documentation Map:$(RESET)"
	@echo "  Requirements:      docs/requirements/README.md"
	@echo "  Operations:        docs/operations/"
	@echo "  Decisions (ADRs):  docs/decisions/"
	@echo "  MCP Troubleshoot:  docs/operations/mcp-troubleshooting.md"
	@echo "  CLAUDE.md:         CLAUDE.md"


# Analytics
dashboard: ## Generate Markdown category analytics dashboard (writes cortex/state/category-dashboard.md)
	node cortex/scripts/generate-daily-digest.mjs --dashboard