// cortex/scripts/obsidian/generateLlmsInput.cs.js
// llms-input.json を生成する Codescript 骨格
//
// 想定パス:
//  - clusters-v1.md      : cortex/graph/clusters-v1.md
//  - TODO.md             : TODO.md
//  - tomorrow.json       : cortex/state/tomorrow.json
//  - 出力 llms-input.json: cortex/tmp/llms-input.json

/**
 * エントリポイント
 * - Codescript から app を渡して呼ぶ想定
 *   例: generateLlmsInput(app)
 */
async function generateLlmsInput(app) {
  const vault = app.vault;
  const adapter = vault.adapter;

  // 1. 必要ファイルを読み込む
  const clustersPath = "cortex/graph/clusters-v1.md";
  const todoPath = "TODO.md";
  const tomorrowPath = "cortex/state/tomorrow.json";
  const outputPath = "cortex/tmp/llms-input.json";

  const [clustersMd, todoMd, tomorrowJson] = await Promise.all([
    readIfExists(vault, clustersPath),
    readIfExists(vault, todoPath),
    readIfExists(vault, tomorrowPath).then(text => safeJsonParse(text, {}))
  ]);

  // 2. clusters-v1.md をパースして Cluster Summaries を作る
  const clusterSummaries = parseClustersMarkdown(clustersMd);

  // 3. TODO / tomorrow.json からハイライト情報を作る
  const highlights = await buildHighlights(app, {
    clusters: clusterSummaries,
    todoMd,
    tomorrowJson
  });

  // 4. vault 全体から recentlyUpdatedNotes を拾う（mtime 降順）
  const recentlyUpdatedNotes = await listRecentlyUpdatedNotes(vault, {
    limit: 10
  });

  // 5. Meta 情報を構築
  const meta = buildMetaFromClusters(clusterSummaries);

  // 6. llms-input.json オブジェクトを組み立て（決定的ソート込み）
  const llmsInput = buildLlmsInputJson({
    meta,
    clusters: clusterSummaries,
    highlights: {
      recentHighImpactNotes: highlights.recentHighImpactNotes,
      recentlyUpdatedNotes,
      todoContext: highlights.todoContext
    }
  });

  // 7. JSON として書き出し
  await ensureFolder(adapter, "cortex/tmp");
  await adapter.write(outputPath, JSON.stringify(llmsInput, null, 2));

  console.log(`✅ llms-input.json generated at ${outputPath}`);
  return llmsInput;
}

/**
 * ファイルがあれば内容を返し、なければ空文字列。
 */
async function readIfExists(vault, path) {
  const file = vault.getAbstractFileByPath(path);
  if (!file) return "";
  return await vault.read(file);
}

/**
 * JSON.parse の安全版。失敗したら fallback を返す。
 */
function safeJsonParse(text, fallback) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn("⚠ JSON parse failed. Returning fallback.", e);
    return fallback;
  }
}

/**
 * clusters-v1.md をパースして、llms-input-schema の clusters[] に
 * 近い形の配列を返す。
 *
 * 期待フォーマット（ざっくりイメージ）:
 *
 * ## Cluster 1: .mcp.json
 *
 * **ID**: `cluster-0`
 * **Size**: 136 concepts
 * **Total Frequency**: 488
 *
 * **説明**:
 * このクラスターは主に MCP の実装・設計・接続周り。
 * 今の自分の専門性のコア領域。仕様・実装ログ・試行錯誤が集約されている。
 *
 * **目的**: 技術システムの中核を構成する層。MCP アーキテクチャの理解と実装を深める。
 * **出力物**: MCP 設定ファイル、統合コード、技術ドキュメント、トラブルシューティングガイド
 *
 * **Core Concepts**:
 * - **.mcp.json** (21×) - frontmatter-tag, link, tag
 * - **🔌 MCP stdio Bridge Setup Guide** (14×) - link
 *
 * **Representative Notes**:
 * - [[docs/operations/mcp-troubleshooting.md]]
 * - [[📕 「第2章：MCPの仕組み」/🎲 Section 2-6 サンプリング（プリミティブ④）.md]]
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

  let section = null; // "description", "coreConcepts", "representativeNotes"
  let descriptionLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // クラスタ見出し
    const mCluster = line.match(CLUSTER_HEADING);
    if (mCluster) {
      // ひとつ前のクラスタを確定
      if (current) {
        if (descriptionLines.length > 0) {
          current.description = descriptionLines.join(" ").trim();
        }
        finalizeCurrentCluster(current);
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
        description: "",
        purpose: "",
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
      section = "description";
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
      section = "coreConcepts";
      if (descriptionLines.length > 0) {
        current.description = descriptionLines.join(" ").trim();
        descriptionLines = [];
      }
      continue;
    }

    // Representative Notes セクション
    if (REP_NOTES_HEADING.test(line)) {
      section = "representativeNotes";
      continue;
    }

    // 説明の複数行対応
    if (section === "description") {
      if (line && !line.startsWith("**")) {
        descriptionLines.push(line);
      }
      continue;
    }

    // Core Concepts の行（例: "- **.mcp.json** (21×) - frontmatter-tag, link, tag"）
    if (section === "coreConcepts") {
      if (!line.startsWith("-")) continue;
      const text = line.replace(/^-+/, "").trim();
      if (!text) continue;

      // "**label** (freq×)" 形式から抽出
      const match = text.match(/^\*\*(.+?)\*\*\s*\((\d+)×\)/);
      if (match) {
        const label = match[1];
        const freq = Number(match[2]);
        current.coreConcepts.push({ label, frequency: freq });
      }
      continue;
    }

    // Representative Notes の行（例: "- [[path/to/note]]"）
    if (section === "representativeNotes") {
      if (!line.startsWith("-")) continue;
      const text = line.replace(/^-+/, "").trim();
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
      current.description = descriptionLines.join(" ").trim();
    }
    finalizeCurrentCluster(current);
    clusters.push(current);
  }

  // 決定的ソート: id 順
  clusters.sort((a, b) => a.id.localeCompare(b.id));

  // coreConcepts を frequency 降順 + label アルファベット順でソート
  for (const c of clusters) {
    c.coreConcepts.sort((a, b) => {
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      return a.label.localeCompare(b.label);
    });
    // 上位 10 件に制限
    c.coreConcepts = c.coreConcepts.slice(0, 10);
  }

  return clusters;
}

/**
 * クラスタ確定時に必要なら後処理。
 */
function finalizeCurrentCluster(cluster) {
  // size / frequencySum は clusters-v1.md から取得済み
  // 必要なら追加処理をここに書く
}

/**
 * TODO / tomorrow.json / 最近更新ノートなどから highlights を構築。
 *
 * Plan A+: Cluster 5 (Highlights) から recentHighImpactNotes を動的に抽出
 */
async function buildHighlights(app, { clusters, todoMd, tomorrowJson }) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  // tomorrow.json から topItems を取得
  let topItems = [];
  if (tomorrowJson && tomorrowJson.tomorrow_candidates) {
    topItems = tomorrowJson.tomorrow_candidates.slice(0, 5);
  }

  // Cluster 5 (Highlights) を探す
  const highlightsCluster = clusters.find(
    (c) => c.id === "cluster-4" || /highlights|🎉/i.test(c.name ?? "")
  ) ?? null;

  let recentHighImpactNotes = [];
  if (highlightsCluster && highlightsCluster.representativeNotes) {
    // representativeNotes をコピー
    recentHighImpactNotes = [...highlightsCluster.representativeNotes];

    // 優先順位付きソート: weekly > releases > other
    recentHighImpactNotes.sort((a, b) => {
      const aIsWeekly = /weekly|W\d{2}/i.test(a);
      const bIsWeekly = /weekly|W\d{2}/i.test(b);
      const aIsRelease = /release/i.test(a);
      const bIsRelease = /release/i.test(b);

      if (aIsWeekly && !bIsWeekly) return -1;
      if (!aIsWeekly && bIsWeekly) return 1;
      if (aIsRelease && !bIsRelease) return -1;
      if (!aIsRelease && bIsRelease) return 1;
      return a.localeCompare(b);
    });

    // 上位5件に制限
    recentHighImpactNotes = recentHighImpactNotes.slice(0, 5);
  } else {
    // フォールバック: 固定値
    console.warn("⚠ Highlights cluster not found. Using fallback.");
    recentHighImpactNotes = [
      "cortex/weekly/2025-W48-summary.md",
      "docs/releases/v1.0.md"
    ];
  }

  return {
    recentHighImpactNotes,
    todoContext: {
      today: todayStr,
      topItems
    }
  };
}

/**
 * 最近更新されたノートを mtime 降順で返す。
 * 形式は llms-input-schema.md の想定に合わせて、パスの配列にしておく。
 */
async function listRecentlyUpdatedNotes(vault, { limit = 10 } = {}) {
  const files = vault.getMarkdownFiles();
  // Obsidian の file.stat.mtime を使う
  const sorted = [...files].sort((a, b) => {
    const ma = a.stat?.mtime ?? 0;
    const mb = b.stat?.mtime ?? 0;
    if (mb !== ma) return mb - ma;
    return a.path.localeCompare(b.path);
  });

  return sorted.slice(0, limit).map((f) => f.path);
}

/**
 * clusters 情報から knowledgeGraph メタ情報を構築
 *
 * TODO: 明日の作業ポイント
 * - totalConcepts を graph-v1.json から動的に取得（任意）
 */
function buildMetaFromClusters(clusters) {
  const totalConcepts = clusters.reduce((sum, c) => sum + c.size, 0);
  return {
    totalConcepts,
    totalClusters: clusters.length,
    method: "connected-components",
    similarityThreshold: 0.7
  };
}

/**
 * llms-input.json 最終オブジェクトを組み立てる。
 */
function buildLlmsInputJson({ meta, clusters, highlights }) {
  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    project: "Cortex OS",
    knowledgeGraph: meta,
    clusters,
    highlights
  };
}

/**
 * フォルダが存在しなければ作成
 */
async function ensureFolder(adapter, folderPath) {
  const exists = await adapter.exists(folderPath);
  if (!exists) {
    await adapter.mkdir(folderPath);
  }
}

// Codescript から呼びやすいように export しておく
// Codescript は invoke() 関数を期待する
async function invoke(app) {
  return await generateLlmsInput(app);
}

module.exports = {
  generateLlmsInput,
  invoke
};
