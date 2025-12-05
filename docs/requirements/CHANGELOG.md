# Requirements Documentation Changelog

All notable changes to requirements documentation will be tracked in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### In Progress (v1.2 "Autonomy" - 95% Complete) 🎉
- n8n production deployment (Railway/Render)
- Recipe 統合 Phase 2 (task-entry.json integration)
- 1週間安定稼働確認 (3/7日完了)

### Planned
- Complete recipe catalog (recipes.md)
- Migration guides for v1.1 → v1.2
- Performance benchmarks
- Disaster recovery procedures
- `/reflect` command implementation
- `/plan` command implementation

---

## [1.4.0] - 2025-12-05

### Added
- **Cortex OS v1.1+**: 5 MCP Servers fully operational
  - **filesystem** (critical) - File read/write operations
  - **terminal** (critical) - Task execution
  - **text-editor** (critical) - Text editing with 11 tools
  - **search** (critical) - Knowledge Graph search with 10 tools
  - **time** (high) - Time operations with 10 tools
- **llms.txt Generation Pipeline** (v1.0.0)
  - `scripts/generate-llms-txt.mjs` - Node.js implementation
  - `cortex/scripts/obsidian/generateLlmsTxt.cs.js` - Obsidian Codescript version
  - `docs/operations/llms-txt-generation.md` - Complete documentation
  - `LLMS-TXT-SUMMARY.md` - Implementation summary
  - 7 sections: Header, Project Context, MCP Layer, Knowledge Graph, Task Context, Recent Updates, Resources
  - Output: 6 KB, 200 lines, optimized for LLM context windows
- **llms-input.json Pipeline** enhancements
  - MCP Layer information integration
  - Flexible data format handling (string/object)
  - Enhanced error handling
- **Package Scripts** (3 new scripts)
  - `cortex:llms:input` - Generate llms-input.json
  - `cortex:llms:txt` - Generate llms.txt
  - `cortex:llms:all` - Generate both (recommended)
- **Phase 2.5**: MCP Community Detection
  - 136 concepts → 5 clusters via connected-components algorithm
  - Cluster annotations with purpose, outputs, and core concepts
- **Text Editor MCP** (11 tools)
  - write_file, append_to_file, insert_at_line, replace_lines, search_replace
  - delete_lines, get_line_count, read_lines, create_directory, list_directory, file_exists
  - 11 tests all passing
- **Search MCP** (10 tools)
  - search_concepts, search_notes, search_by_cluster, list_clusters, get_concept, find_similar
  - get_cluster_summary, search_by_frequency, get_all_concepts, search_by_tag
  - 10 tests all passing
- **Time MCP** (10 tools)
  - get_current_time, add_time, format_date, parse_date, get_week_range, get_month_range
  - date_diff, is_weekend, get_day_of_week, to_utc
  - 10 tests all passing
  - Essential for Cortex OS automation
- **/ask Command** (Slash Command)
  - `.claude/commands/ask.md` specification (321 lines, 7.8KB)
  - 4 question types: today's status, weekly status, project status, system status
  - Selective external memory loading (Daily Digest, TODO.md, Weekly Summary)
  - Fact-based responses with source attribution
  - Security: No API keys in responses, server-side only
  - Performance: Parallel file reads, selective loading
  - 3 complete usage examples with realistic Q&A

- **task-entry.json Schema** (v1.0)
  - `data/schemas/task-entry.json` - JSON Schema definition
  - Unified task format for v1.2+ analytics foundation
  - Required fields: date, tasks[], metadata
  - Optional fields: category, priority, tags, duration, dependencies
  - Compatible with extract-tasks.py and analyze-workload.py

### Changed
- **v1.2 Progress**: 45% → 95% (+50%) 🎉
  - ① 完全自律化: 100% (complete)
  - ② 情報モデル統一: 70% → 100% (+30%)
  - ③ AI Interface 強化: 55% → 100% (+45%)
- **README.md**: Updated with v1.1+ status and MCP Layer info
- **/ask Command**: Already implemented (`.claude/commands/ask.md` 321 lines)
- **TODO.md**: Added 11 completed tasks from 2025-12-05
- cortex-os.md: Version 1.2 → 1.3 (2025-12-02 → 2025-12-03)
- llms-input-schema.md: Added mcpLayer specification

### Fixed
- **Text Editor MCP**: Regex special characters escaping in `search_replace`
  - When `all=true`, patterns are now properly escaped before RegExp construction
  - Prevents unintended matches (e.g., "file.txt" matching "fileXtxt")
- **Documentation**: 4 bugs fixed across weekly summaries and cortex-os.md
  - Undefined challenges string → proper content
  - Version mismatch in headers
  - Input source ambiguity (digest vs Today's Focus)
  - Traceability score calculation (70% vs 60%)

### Tested
- Text Editor MCP: 11 tests ✅
- Search MCP: 10 tests ✅
- Time MCP: 10 tests ✅
- llms.txt generation: Output validation ✅
- Total: 51 tests all passing

### Performance
- llms.txt generation: <100ms
- llms-input.json generation: ~2 seconds
- Combined pipeline: ~2.1 seconds

### Milestones Achieved (2025-12-05)
1. 🎉 Cortex OS v1.1+ complete (5 MCP Servers operational)
2. 🎉 llms-input.json pipeline complete
3. 🎉 llms.txt generation pipeline complete
4. 🎉 Information Model Unification 100% achieved
5. 🎉 task-entry.json schema complete (Phase 1)
6. 🎉 `/ask` command complete (AI Interface enhancement to 70%)

---

## [1.3.0] - 2025-12-03

### Added
- **New Document**: `CROSS-REFERENCE-MATRIX.md` - Feature traceability matrix
- **Recipe 09**: Daily Digest Distribution specification (cortex-os.md lines 469-522)
  - Multi-format task extraction (checkbox `- [ ]` + plain bullet `-` + subsections `###`)
  - Reflection extraction with subsection support (`### 学び`, `### 課題`, `### 気づき`)
  - Section name fallbacks (`Today's Focus`, `Tasks`, `High Priority`)
  - 8 validation points (file existence, extraction counts, Slack delivery, format support)
  - Error handling specifications (graceful degradation on empty/missing sections)
- Recipe 09 to Core Features Matrix (CROSS-REFERENCE-MATRIX.md)
- Recipe 09 to Workflow Audit Matrix (schedule: 08:00 JST daily)
- Recipe 09 to Test Coverage Matrix (Daily Digest Gen/Dist separation)
- Recipe 09 dependencies documentation (Obsidian REST API, Slack Webhook, env vars)
- Recent Fixes section in CROSS-REFERENCE-MATRIX.md (2025-12-03 updates)

### Changed
- cortex-os.md: Updated Change Summary (v1.1 → v1.2) with Recipe 09
- CROSS-REFERENCE-MATRIX.md: Traceability score 60% → 70% (7/10 features)
- CROSS-REFERENCE-MATRIX.md: Added Recent Updates section with 4 items
- CROSS-REFERENCE-MATRIX.md: Updated Documentation Links (cortex-os.md: 2025-12-03)
- CROSS-REFERENCE-MATRIX.md: Added self-reference link
- Workflow Audit Matrix: Recipe 14 renamed to "Digest Gen" (clarification)
- Test Coverage Matrix: Daily Digest split into Gen/Dist (Recipe 14/09)

### Fixed
- **Recipe 09**: Multi-format task extraction
  - Now handles checkbox format (`- [ ]`, `- [x]`)
  - Now handles plain bullet format (`-` without checkbox)
  - Now extracts from subsections (`### High Priority`, `### Regular Tasks`)
  - Excludes subsection headers from task list
- **Recipe 09**: Reflection extraction with proper regex boundaries
  - Fixed non-greedy match issue (was capturing only 3 chars)
  - Now stops at `\n##`, `\n---`, or EOF
  - Preserves multi-paragraph content and nested subsections
- **Recipe 09**: Removed `process.env.WORKSPACE_ROOT` usage
  - Replaced with hardcoded path `/workspace/dauberside.github.io-1/notifications/`
  - Fixes "process is not defined" error in n8n sandbox
- **Recipe 09**: Added section name fallback logic
  - Tries `Today's Focus` → `Tasks` → `High Priority`
  - Handles format variations across daily digests

### Tested
- Recipe 09 with 2025-12-01 data: ✅ 4 tasks + full Reflection extracted
- Recipe 09 with 2025-12-02 data: ✅ Graceful handling of empty sections

---

## [1.2.0] - 2025-12-02

### Added
- **New Document**: `cortex-os.md` - Complete v1.2 "Autonomy" specification
- **New Document**: `REQUIREMENTS-AUDIT-2025-12-02.md` - Comprehensive audit report
- **New Document**: `CHANGELOG.md` - This file
- Autonomous loop specifications (daily/weekly cycles)
- Recipe 02 (KB Rebuild) full specification
- Recipe 10 (TODO Auto-sync) full specification
- Recipe 14 (Daily Digest Generator) full specification
- Recipe 13 (Nightly Wrap-up) specification
- Recipe 11 (Weekly Summary) specification
- Hash-based embedding algorithm (FNV-1a, 256-dim)
- TODO format v2.0 specification (`## Today — YYYY-MM-DD`)
- 5-tag system (#urgent, #deepwork, #blocked, #waiting, #review)
- KB Index format v1.0 specification
- Daily Digest template v1.0 specification
- Authentication requirements (KB_API_TOKEN)
- Performance SLAs (latency, throughput, reliability)
- Monitoring & alerting specifications
- Upgrade path (v1.1 → v1.2)

### Changed
- README.md: Updated last modified date (2025-11-09 → 2025-12-02)
- README.md: Added version concept to requirements
- Task format: Inline tags → HTML comments
- TODO section format: `## Today` → `## Today — YYYY-MM-DD`

### Deprecated
- TODO format v1.0 (old section headers)
- Inline tag format in tasks

### Fixed
- External consistency gaps (implementation vs documentation)
- Missing n8n service documentation
- Outdated version numbers

---

## [1.1.0] - 2025-11-09

### Added
- Initial requirements structure
- KB requirements (kb.md)
- n8n requirements (n8n.md) - partial
- Obsidian integration (obsidian.md)
- Services documentation (services.md)
- Development environment (dev-environment.md)
- Basic authentication (basic-auth.md)
- Task management basics (tasks.md)
- Hot-path optimization (hot-path-optimization.md)

### Changed
- Unified "no-index" policy across site
- Consolidated authentication approach
- Standardized Docker Compose services

---

## [1.0.0] - 2025-10-XX (Estimated)

### Added
- Initial project requirements
- Basic architecture decisions
- Service specifications

---

## Change Categories

### Added
New requirements, features, or documentation sections.

### Changed
Updates to existing requirements that don't break compatibility.

### Deprecated
Requirements marked for future removal.

### Removed
Deleted requirements or obsolete documentation.

### Fixed
Corrections to errors or inconsistencies.

### Security
Security-related changes.

---

## Version Numbering

**Format**: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (e.g., API redesign, format changes)
- **MINOR**: New features (e.g., new recipes, new services)
- **PATCH**: Bug fixes, clarifications, typos

**Examples**:
- `2.0.0`: Breaking change (new TODO format incompatible with v1.x parsers)
- `1.3.0`: New feature (Recipe 15 added)
- `1.2.1`: Typo fixed in cortex-os.md

---

## Migration Guides

### v1.1 → v1.2

**Impact**: Medium (format changes, new workflows)

**Steps**:
1. **Backup**: Save current `TODO.md`
2. **Update n8n**: Import Recipe 02, 10, 14 JSON files
3. **Update TODO format**: Run migration script or manual edit
   ```bash
   # Find old format
   grep "^## Today$" TODO.md
   
   # Replace with new format (manual)
   ## Today → ## Today — 2025-12-02
   ```
4. **Test**: Trigger Recipe 10 manually, verify output
5. **Monitor**: Check Slack notifications for 24 hours
6. **Rollback** (if needed): Restore `TODO.md` backup, revert n8n workflows

**Estimated Time**: 30 minutes

**Risk**: Low (data backed up, rollback available)

---

## Document Status

| Document | Version | Last Updated | Status |
|----------|---------|--------------|--------|
| cortex-os.md | 1.4 | 2025-12-05 | ✅ Current |
| CROSS-REFERENCE-MATRIX.md | 1.0 | 2025-12-03 | ✅ Current |
| CHANGELOG.md | 1.3 | 2025-12-03 | ✅ Current |
| README.md | 1.2 | 2025-12-02 | ✅ Current |
| kb.md | 1.1 | 2025-11-09 | ⚠️ Needs Update |
| n8n.md | 1.0 | 2025-11-09 | ⚠️ Incomplete |
| tasks.md | 1.0 | 2025-11-09 | ⚠️ Needs Update |
| obsidian.md | 1.0 | 2025-11-09 | ✅ OK |
| services.md | 1.0 | 2025-11-09 | ⚠️ Needs Update |
| dev-environment.md | 1.0 | 2025-11-09 | ⚠️ Needs Update |

**Legend**:
- ✅ Current: Up-to-date with implementation
- ⚠️ Needs Update: Missing recent features
- ❌ Outdated: Significantly behind

---

## Review Schedule

**Frequency**: Every 2 weeks  
**Next Review**: 2025-12-16

**Review Checklist**:
- [ ] External consistency check (code vs docs)
- [ ] Version numbers updated
- [ ] New features documented
- [ ] Deprecated features marked
- [ ] Migration guides written
- [ ] Examples tested
- [ ] Cross-references validated

---

## Contributing

When updating requirements:

1. **Version Bump**: Increment version in document header
2. **Changelog Entry**: Add to this file under [Unreleased]
3. **Cross-Reference**: Update related documents
4. **Examples**: Provide code/config examples
5. **Migration**: Write upgrade guide if breaking

**Example Commit**:
```
docs(requirements): add Recipe 15 specification

- Add Recipe 15: Monthly Report Generator
- Update cortex-os.md with new schedule
- Bump version to 1.3.0

Closes #123
```

---

## Links

- [Requirements Index](./README.md)
- [Cortex OS Specification](./cortex-os.md)
- [Audit Report 2025-12-02](./REQUIREMENTS-AUDIT-2025-12-02.md)
- [GitHub Issues](https://github.com/dauberside/dauberside.github.io/issues)

---

**Last Updated**: 2025-12-03
**Maintained By**: Cortex OS Team
