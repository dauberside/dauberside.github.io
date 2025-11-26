/**
 * types.ts
 *
 * Type definitions for Cortex OS v2.0 Knowledge Graph
 */

/**
 * Graph Node - represents a chunk of knowledge
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
 */
export interface GraphCluster {
  id: string; // e.g., "cluster-001"
  label: string; // Human-readable theme name
  nodeIds: string[]; // IDs of nodes in this cluster
  topKeywords: string[]; // Most frequent meaningful words
  size: number; // Number of nodes
  summary?: string; // AI-generated summary (optional)
  representative?: string; // Most central node ID (optional)
}

/**
 * Complete Knowledge Graph
 */
export interface KnowledgeGraph {
  metadata: {
    version: string; // e.g., "v1"
    generatedAt: string; // ISO timestamp
    totalNodes: number;
    totalEdges: number;
    totalClusters: number;
    source: string; // e.g., "kb/index/embeddings.json"
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
}

/**
 * Graph building options
 */
export interface GraphBuildOptions {
  // Edge building
  topK?: number; // Max edges per node (default: 5)
  similarityThreshold?: number; // Min similarity for edge (default: 0.7)

  // Clustering
  clusteringMethod?: 'connected-components' | 'kmeans'; // Default: connected-components
  minClusterSize?: number; // Minimum nodes per cluster (default: 2)

  // Output
  includeEmbeddings?: boolean; // Include embeddings in output (default: false)
  generateMarkdown?: boolean; // Generate human-readable report (default: true)
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
