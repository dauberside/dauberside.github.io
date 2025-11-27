/**
 * exportConcepts.cs.js
 *
 * Codescript Toolkit script for Obsidian
 *
 * Purpose: Extract concept candidates from vault and export to concepts.json
 *
 * Architecture:
 * - Obsidian (this script): Extract concepts from tags, links, frontmatter, headings
 * - Node pipeline: Read concepts.json → embeddings → clustering → graph export
 *
 * Usage: Run from Obsidian command palette
 */

/**
 * Main entry point
 * @param {Object} app - Obsidian app instance
 */
async function exportConcepts(app) {
  console.log('Starting concept extraction...');

  const concepts = new Map();

  // Get all markdown files in vault
  const files = app.vault.getMarkdownFiles();
  console.log(`Processing ${files.length} files...`);

  for (const file of files) {
    try {
      // Read file content
      const content = await app.vault.read(file);

      // Get metadata cache (tags, links, frontmatter, headings)
      const cache = app.metadataCache.getFileCache(file);

      // Extract concepts from this note
      await extractConceptsFromNote({
        file,
        content,
        cache,
        concepts,
      });
    } catch (error) {
      console.error(`Error processing ${file.path}:`, error);
    }
  }

  console.log(`Extracted ${concepts.size} unique concepts`);

  // Serialize concepts (deterministic format)
  const data = serializeConcepts(concepts);

  // Write to cortex/graph/concepts.json
  const outputPath = 'cortex/graph/concepts.json';
  await app.vault.adapter.write(
    outputPath,
    JSON.stringify(data, null, 2)
  );

  console.log(`✅ Concepts exported to ${outputPath}`);

  // Show notification
  new Notice(`Exported ${concepts.size} concepts to ${outputPath}`);
}

/**
 * Extract concepts from a single note
 * @param {Object} params - Parameters
 * @param {TFile} params.file - Obsidian file
 * @param {string} params.content - File content
 * @param {CachedMetadata} params.cache - Metadata cache
 * @param {Map} params.concepts - Concepts map (mutated)
 */
async function extractConceptsFromNote({ file, content, cache, concepts }) {
  // 1. Extract from tags
  if (cache?.tags) {
    for (const tag of cache.tags) {
      const conceptId = normalizeConceptId(tag.tag);
      addConcept(concepts, conceptId, {
        type: 'tag',
        source: file.path,
        label: tag.tag.replace('#', ''),
      });
    }
  }

  // 2. Extract from links
  if (cache?.links) {
    for (const link of cache.links) {
      const conceptId = normalizeConceptId(link.link);
      addConcept(concepts, conceptId, {
        type: 'link',
        source: file.path,
        label: link.displayText || link.link,
      });
    }
  }

  // 3. Extract from frontmatter
  if (cache?.frontmatter) {
    const fm = cache.frontmatter;

    // Extract tags from frontmatter
    if (fm.tags) {
      const tags = Array.isArray(fm.tags) ? fm.tags : [fm.tags];
      for (const tag of tags) {
        const conceptId = normalizeConceptId(tag);
        addConcept(concepts, conceptId, {
          type: 'frontmatter-tag',
          source: file.path,
          label: tag,
        });
      }
    }

    // Extract other relevant frontmatter (e.g., category, type)
    for (const key of ['category', 'type', 'topic']) {
      if (fm[key]) {
        const conceptId = normalizeConceptId(fm[key]);
        addConcept(concepts, conceptId, {
          type: 'frontmatter',
          source: file.path,
          label: fm[key],
        });
      }
    }
  }

  // 4. Extract from headings (H1, H2 only for now)
  if (cache?.headings) {
    for (const heading of cache.headings) {
      if (heading.level <= 2) {
        const conceptId = normalizeConceptId(heading.heading);
        addConcept(concepts, conceptId, {
          type: 'heading',
          source: file.path,
          label: heading.heading,
        });
      }
    }
  }
}

/**
 * Normalize concept ID (deterministic, Unicode-aware)
 * @param {string} raw - Raw concept string
 * @returns {string} Normalized concept ID
 */
function normalizeConceptId(raw) {
  // Remove leading #
  let normalized = raw.replace(/^#/, '');

  // Remove file extensions (.md, .ts, .js, etc.)
  normalized = normalized.replace(/\.(md|ts|js|json|yml|yaml|txt)$/i, '');

  // Remove leading slashes and dots (from paths like /.claude/commands/...)
  normalized = normalized.replace(/^[\/\.]+/, '');

  // For non-ASCII (e.g., Japanese), create a hash-based ID
  // Check if contains non-ASCII characters
  if (/[^\x00-\x7F]/.test(normalized)) {
    // Create a deterministic ID from the original text
    // Use a simple hash or just use the original with minimal processing
    // Keep Japanese characters, remove only problematic chars
    normalized = normalized
      .replace(/[\s\n\r\t]+/g, '-') // Replace whitespace with -
      .replace(/[^\p{L}\p{N}\-]/gu, '-') // Keep letters, numbers, - (Unicode-aware, remove /)
      .replace(/-+/g, '-') // Collapse multiple -
      .replace(/^-|-$/g, ''); // Trim leading/trailing -

    // If still empty or very short, use a hash
    if (normalized.length < 2) {
      // Simple hash function (deterministic)
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
      }
      return `concept-${Math.abs(hash).toString(36)}`;
    }

    return normalized;
  }

  // For ASCII text, use standard processing
  return normalized
    .toLowerCase()
    .replace(/\//g, '-') // Replace / with -
    .replace(/[^\w\-]/g, '-') // Replace non-word chars with -
    .replace(/-+/g, '-') // Collapse multiple -
    .replace(/^-|-$/g, ''); // Trim leading/trailing -
}

/**
 * Add concept to map
 * @param {Map} concepts - Concepts map
 * @param {string} conceptId - Concept ID
 * @param {Object} occurrence - Occurrence metadata
 */
function addConcept(concepts, conceptId, occurrence) {
  if (!concepts.has(conceptId)) {
    concepts.set(conceptId, {
      id: conceptId,
      label: occurrence.label,
      sourceNotes: new Set(),
      types: new Set(),
      frequency: 0,
    });
  }

  const concept = concepts.get(conceptId);
  concept.sourceNotes.add(occurrence.source);
  concept.types.add(occurrence.type);
  concept.frequency++;
}

/**
 * Serialize concepts to JSON-friendly format (deterministic)
 * @param {Map} concepts - Concepts map
 * @returns {Object} Serializable data
 */
function serializeConcepts(concepts) {
  const MIN_FREQUENCY = 2; // Only keep concepts that appear in 2+ notes

  const sorted = Array.from(concepts.values())
    .filter(c => c.frequency >= MIN_FREQUENCY) // Filter by frequency
    .map(c => ({
      id: c.id,
      label: c.label,
      sourceNotes: Array.from(c.sourceNotes).sort(), // Deterministic sort
      types: Array.from(c.types).sort(),
      frequency: c.frequency,
    }))
    .sort((a, b) => {
      // Sort by frequency (descending), then by ID
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      return a.id.localeCompare(b.id);
    });

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    totalConcepts: sorted.length,
    minFrequency: MIN_FREQUENCY,
    concepts: sorted,
  };
}

// Export for Codescript Toolkit
// The plugin expects an invoke() function
module.exports.invoke = async (app) => {
  return await exportConcepts(app);
};
