# Requirements Documentation Changelog

All notable changes to requirements documentation will be tracked in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Planned
- Complete recipe catalog (recipes.md)
- Migration guides for v1.1 → v1.2
- Performance benchmarks
- Disaster recovery procedures

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
| cortex-os.md | 1.2 | 2025-12-02 | ✅ Current |
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

**Last Updated**: 2025-12-02  
**Maintained By**: Cortex OS Team
