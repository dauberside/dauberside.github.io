#!/usr/bin/env node
// cortex/scripts/generate-llms-input.mjs
// Node.js 版: llms-input.json を生成するスタンドアロンスクリプト

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

/**
 * エントリポイント
 */
async function generateLlmsInput() {
  console.log('🚀 Starting llms-input.json generation...\n');

  // 1. 必要ファイルを読み込む
  const clustersPath = path.join(rootDir, 'cortex/graph/clusters-v1.md');
  const todoPath = path.join(rootDir, 'TODO.md');
  const tomorrowPath = path.join(rootDir, 'cortex/state/tomorrow.json');
  const outputPath = path.join(rootDir, 'cortex/tmp/llms-input.json');

  const [clustersMd, todoMd, tomorrowJson] = await Promise.all([
    readIfExists(clustersPath),
    readIfExists(todoPath),
    readIfExists(tomorrowPath).then(text => safeJsonParse(text, {}))
  ]);

  console.log('✅ Files loaded');
  console.log(`   - clusters-v1.md: ${clustersMd ? 'OK' : 'NOT FOUND'}`);
  console.log(`   - TODO.md: ${todoMd ? 'OK' : 'NOT FOUND'}`);
  console.log(`   - tomorrow.json: ${tomorrowJson ? 'OK' : 'NOT FOUND'}\n`);

  // 2. clusters-v1.md をパースして Cluster Summaries を作る
  const clusterSummaries = parseClustersMarkdown(clustersMd);
  console.log(`✅ Parsed ${clusterSummaries.length} clusters\n`);

  // 3. TODO / tomorrow.json からハイライト情報を作る
  const highlights = buildHighlights({ todoMd, tomorrowJson });
  console.log('✅ Built highlights\n');

  // 4. Meta 情報を構築
  const meta = buildMetaFromClusters(clusterSummaries);

  // 5. llms-input.json オブジェクトを組み立て（決定的ソート込み）
  const llmsInput = buildLlmsInputJson({
    meta,
    clusters: clusterSummaries,
    highlights
  });

  // 6. JSON として書き出し
  await ensureFolder(path.dirname(outputPath));
  await fs.writeFile(outputPath, JSON.stringify(llmsInput, null, 2), 'utf-8');

  console.log(`✅ llms-input.json generated at ${outputPath}\n`);
  console.log('📊 Summary:');
  console.log(`   - Total Concepts: ${meta.totalConcepts}`);
  console.log(`   - Total Clusters: ${meta.totalClusters}`);
  console.log(`   - Today: ${highlights.todoContext.today}`);
  console.log(`   - Top Tasks: ${highlights.todoContext.topItems.length}`);
}

/**
 * ファイルがあれば内容を返し、なければ空文字列。
 */
async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (e) {
    return '';
  }
}

/**
 * JSON.parse の安全版。失敗したら fallback を返す。
 */
function safeJsonParse(text, fallback) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn('⚠ JSON parse failed. Returning fallback.', e);
    return fallback;
  }
}

/**
 * clusters-v1.md をパースして、llms-input-schema の clusters[] に近い形の配列を返す。
 */
function parseClustersMarkdown(markdown) {
  if (!markdown) return [];

  const lines = markdown.split(/\r?\n/);
  const clusters = [];
  let current = null;

  const CLUSTER_HEADING = /^##\s+Cluster\s+(\d+):\s*(.+)$/;
  const ID_LINE = /^\*\*ID\*\*:\s*`([^`]+)`/;
  const SIZE_LINE = /^\*\*Size\*\*:\s*(\d+)/;
  const FREQ_LINE = /^\*\*Total Frequency\*\*:\s*(\d+)/;
  const DESC_HEADING = /^\*\*説明\*\*:/;
  const PURPOSE_LINE = /^\*\*目的\*\*:\s*(.+)$/;
  const OUTPUTS_LINE = /^\*\*出力物\*\*:\s*(.+)$/;
  const CORE_CONCEPTS_HEADING = /^\*\*Core Concepts\*\*:/;
  const REP_NOTES_HEADING = /^\*\*Representative Notes\*\*:/;

  let section = null;
  let descriptionLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // クラスタ見出し
    const mCluster = line.match(CLUSTER_HEADING);
    if (mCluster) {
      // ひとつ前のクラスタを確定
      if (current) {
        if (descriptionLines.length > 0) {
          current.description = descriptionLines.join(' ').trim();
        }
        clusters.push(current);
      }

      const clusterNum = mCluster[1];
      const name = `Cluster ${clusterNum}: ${mCluster[2]}`;

      current = {
        id: `cluster-${clusterNum}`,
        name,
        shortName: mCluster[2],
        size: 0,
        frequencySum: 0,
        description: '',
        purpose: '',
        outputs: [],
        coreConcepts: [],
        representativeNotes: []
      };
      section = null;
      descriptionLines = [];
      continue;
    }

    if (!current) continue;

    // ID / Size / Frequency の抽出
    const mId = line.match(ID_LINE);
    if (mId) {
      current.id = mId[1];
      continue;
    }
    const mSize = line.match(SIZE_LINE);
    if (mSize) {
      current.size = Number(mSize[1]);
      continue;
    }
    const mFreq = line.match(FREQ_LINE);
    if (mFreq) {
      current.frequencySum = Number(mFreq[1]);
      continue;
    }

    // 説明セクション開始
    if (DESC_HEADING.test(line)) {
      section = 'description';
      continue;
    }

    // 目的
    const mPurpose = line.match(PURPOSE_LINE);
    if (mPurpose) {
      current.purpose = mPurpose[1].trim();
      section = null;
      continue;
    }

    // 出力物
    const mOutputs = line.match(OUTPUTS_LINE);
    if (mOutputs) {
      const rest = mOutputs[1].trim();
      current.outputs = rest
        .split(/[、,]/)
        .map(s => s.trim())
        .filter(Boolean);
      section = null;
      continue;
    }

    // Core Concepts セクション
    if (CORE_CONCEPTS_HEADING.test(line)) {
      section = 'coreConcepts';
      if (descriptionLines.length > 0) {
        current.description = descriptionLines.join(' ').trim();
        descriptionLines = [];
      }
      continue;
    }

    // Representative Notes セクション
    if (REP_NOTES_HEADING.test(line)) {
      section = 'representativeNotes';
      continue;
    }

    // 説明の複数行対応
    if (section === 'description') {
      if (line && !line.startsWith('**')) {
        descriptionLines.push(line);
      }
      continue;
    }

    // Core Concepts の行
    if (section === 'coreConcepts') {
      if (!line.startsWith('-')) continue;
      const text = line.replace(/^-+/, '').trim();
      if (!text) continue;

      const match = text.match(/^\*\*(.+?)\*\*\s*\((\d+)×\)/);
      if (match) {
        const label = match[1];
        const freq = Number(match[2]);
        current.coreConcepts.push({ label, frequency: freq });
      }
      continue;
    }

    // Representative Notes の行
    if (section === 'representativeNotes') {
      if (!line.startsWith('-')) continue;
      const text = line.replace(/^-+/, '').trim();
      const mLink = text.match(/\[\[([^\]]+)\]\]/);
      if (mLink) {
        current.representativeNotes.push(mLink[1]);
      }
      continue;
    }
  }

  // 最後のクラスタを確定
  if (current) {
    if (descriptionLines.length > 0) {
      current.description = descriptionLines.join(' ').trim();
    }
    clusters.push(current);
  }

  // 決定的ソート
  clusters.sort((a, b) => a.id.localeCompare(b.id));

  for (const c of clusters) {
    c.coreConcepts.sort((a, b) => {
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      return a.label.localeCompare(b.label);
    });
    c.coreConcepts = c.coreConcepts.slice(0, 10);
  }

  return clusters;
}

/**
 * TODO / tomorrow.json からハイライト情報を構築
 */
function buildHighlights({ tomorrowJson }) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  let topItems = [];
  if (tomorrowJson && tomorrowJson.tomorrow_candidates) {
    topItems = tomorrowJson.tomorrow_candidates.slice(0, 5);
  }

  const recentHighImpactNotes = [
    'cortex/weekly/2025-W48-summary.md',
    'docs/releases/v1.0.md'
  ];

  return {
    recentHighImpactNotes,
    recentlyUpdatedNotes: [
      'cortex/graph/clusters-v1.md',
      'cortex/graph/llms-input-schema.md',
      'TODO.md',
      'cortex/state/tomorrow.json'
    ],
    todoContext: {
      today: todayStr,
      topItems
    }
  };
}

/**
 * clusters 情報から knowledgeGraph メタ情報を構築
 */
function buildMetaFromClusters(clusters) {
  const totalConcepts = clusters.reduce((sum, c) => sum + c.size, 0);
  return {
    totalConcepts,
    totalClusters: clusters.length,
    method: 'connected-components',
    similarityThreshold: 0.7
  };
}

/**
 * MCP Layer 情報を構築
 */
function buildMcpLayer() {
  return {
    enabled: true,
    version: 'v1.1+',
    completionDate: '2025-12-05',
    servers: [
      {
        name: 'filesystem',
        status: 'active',
        priority: 'critical',
        tools: ['read_file', 'list_files']
      },
      {
        name: 'terminal',
        status: 'active',
        priority: 'critical',
        tools: ['run_task', 'list_tasks']
      },
      {
        name: 'text-editor',
        status: 'active',
        priority: 'critical',
        tools: ['write_file', 'append_to_file', 'insert_at_line', 'replace_lines', 'search_replace']
      },
      {
        name: 'search',
        status: 'active',
        priority: 'critical',
        tools: ['search_concepts', 'search_notes', 'search_by_cluster', 'list_clusters', 'get_concept', 'find_similar']
      },
      {
        name: 'time',
        status: 'active',
        priority: 'high',
        tools: ['get_current_time', 'add_time', 'format_date', 'get_week_range', 'get_month_range', 'date_diff']
      }
    ]
  };
}

/**
 * llms-input.json 最終オブジェクトを組み立てる
 */
function buildLlmsInputJson({ meta, clusters, highlights }) {
  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    project: 'Cortex OS',
    knowledgeGraph: meta,
    clusters,
    highlights,
    mcpLayer: buildMcpLayer()
  };
}

/**
 * フォルダが存在しなければ作成
 */
async function ensureFolder(folderPath) {
  try {
    await fs.mkdir(folderPath, { recursive: true });
  } catch (e) {
    // already exists
  }
}

// 実行
generateLlmsInput().catch(console.error);
