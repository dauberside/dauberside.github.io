/**
 * types.ts
 *
 * Type definitions for Cortex OS v2.0 Knowledge Graph
 *
 * IMPORTANT DESIGN PRINCIPLE:
 * - GraphNode represents a "Concept", NOT a "Note"
 * - Notes are too diverse in form; Concepts are stable for graph structure
 * - Use Note → Concept mapping via `sourceNotes` field
 */

/**
 * Concept Node - represents a semantic concept in the knowledge graph
 *
 * Example:
 * Note: "B-Tree の最適化"
 * Concepts: ["DB/Indexing/B-Tree", "Optimization", "Disk IO", "Algorithm Complexity"]
 */
export interface ConceptNode {
  id: string; // e.g., "concept-db-indexing-btree"
  label: string; // Human-readable concept name (e.g., "B-Tree")
  related: string[]; // Related concept IDs
  sourceNotes: string[]; // Note IDs that reference this concept
  embedding?: number[]; // Aggregated embedding from source notes
  frequency: number; // How many notes reference this concept
}

/**
 * Graph Node - represents a knowledge chunk (legacy structure, maintained for compatibility)
 *
 * In Phase 2, this will be migrated to ConceptNode-based architecture
 */
export interface GraphNode {
  id: string; // e.g., "docs/architecture/cortex-os-overview.md#chunk-1"
  file: string; // e.g., "docs/architecture/cortex-os-overview.md"
  title?: string; // H1 heading or filename
  snippet: string; // First N chars or summary
  tags: string[]; // Inferred from path or extracted from content
  embedding: number[]; // Vector representation
  chunkIndex?: number; // Original chunk index in KB
  wordCount?: number; // Word count for this chunk

  // Concept mapping (Phase 2 addition)
  concepts?: string[]; // Extracted concept IDs from this chunk
  sourceNotes?: string[]; // If this is a concept node, list of source note IDs
}

/**
 * Graph Edge - represents semantic similarity between nodes
 */
export interface GraphEdge {
  source: string; // node.id
  target: string; // node.id
  weight: number; // Cosine similarity score (0-1)
}

/**
 * Graph Cluster - represents a thematic group of related nodes
 * (Phase 2: Connected Components)
 */
export interface GraphCluster {
  id: string; // e.g., "cluster-001"
  label: string; // Human-readable theme name
  nodeIds: string[]; // IDs of nodes in this cluster
  topKeywords: string[]; // Most frequent meaningful words
  size: number; // Number of nodes
  summary?: string; // AI-generated summary (optional)
  representative?: string; // Most central node ID (optional)
  communityId?: string; // Louvain community ID (Phase 2.5)
}

/**
 * Community - represents a fine-grained thematic community
 * (Phase 2.5: Louvain method for community detection)
 *
 * Communities are more granular than clusters and auto-detected
 * using graph modularity optimization
 */
export interface Community {
  id: string; // e.g., "community-001"
  label: string; // Auto-generated or human-edited label
  nodeIds: string[]; // Member node IDs
  coreConcepts: string[]; // Most central concept IDs in this community
  size: number; // Number of nodes
  modularity: number; // Community modularity score (0-1)
  representative?: string; // Most central node ID
}

/**
 * Complete Knowledge Graph
 */
export interface KnowledgeGraph {
  metadata: {
    version: string; // e.g., "v1", "v2" (with communities)
    generatedAt: string; // ISO timestamp
    totalNodes: number;
    totalEdges: number;
    totalClusters: number;
    totalCommunities?: number; // Phase 2.5
    source: string; // e.g., "kb/index/embeddings.json"
    conceptBased?: boolean; // true if using ConceptNode architecture
  };
  nodes: GraphNode[]; // Or ConceptNode[] in Phase 2
  edges: GraphEdge[];
  clusters: GraphCluster[];
  communities?: Community[]; // Phase 2.5: Louvain communities
}

/**
 * Graph building options
 */
export interface GraphBuildOptions {
  // Architecture
  useConcepts?: boolean; // Use Concept-based nodes instead of chunk-based (default: false)

  // Edge building
  topK?: number; // Max edges per node (default: 5)
  similarityThreshold?: number; // Min similarity for edge (default: 0.7)

  // Clustering (Phase 2)
  clusteringMethod?: "connected-components" | "kmeans"; // Default: connected-components
  minClusterSize?: number; // Minimum nodes per cluster (default: 2)

  // Community Detection (Phase 2.5)
  enableCommunities?: boolean; // Run Louvain community detection (default: false)
  communityResolution?: number; // Louvain resolution parameter (default: 1.0)

  // Output
  includeEmbeddings?: boolean; // Include embeddings in output (default: false)
  generateMarkdown?: boolean; // Generate human-readable "brain map" (default: true)
  markdownFormat?: "clusters" | "communities" | "both"; // What to include in markdown
}

/**
 * KB Index format (from existing KB system)
 */
export interface KBIndex {
  chunks: Array<{
    id: string;
    path: string;
    content: string;
    embedding: number[];
    metadata?: {
      title?: string;
      wordCount?: number;
    };
  }>;
  metadata?: {
    totalChunks: number;
    lastUpdated: string;
  };
}
