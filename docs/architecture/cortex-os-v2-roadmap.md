# Cortex OS v2.x Roadmap

**Current**: v1.0 (Production Ready ✅)
**Vision**: v2.4 (Full Autonomous Knowledge OS)

---

## 🎯 v2.0: Auto-Aggregation Layer

### Weekly / Monthly / Yearly Summaries

**実装方法**:
```javascript
// n8n Recipe 14: Multi-level Summary Generator
// Trigger: Weekly (Sundays), Monthly (1st), Yearly (Jan 1)

const generateSummary = (period, dailyDigests) => {
  // 1. 全ての daily digests を収集
  const digests = fetchDigests(period);
  
  // 2. AI による統合サマリー生成
  const summary = await claude.createMessage({
    model: "claude-sonnet-4.5",
    messages: [{
      role: "user",
      content: `以下の daily digests から ${period} summary を生成:
      ${digests.join('\n---\n')}`
    }]
  });
  
  // 3. cortex/weekly/ または monthly/ へ保存
  await obsidian.append({
    filepath: `cortex/${period}/${date}-summary.md`,
    content: summary
  });
};
```

**効果**:
- Daily を書くだけで自動的に上位レベルのサマリーが生成
- パターン認識と洞察が自動的に蓄積
- 長期的な成長を可視化

**実装難易度**: ⭐⭐☆☆☆ (2週間)

---

## 🕸️ v2.1: Knowledge Graph Visualization

### Long-term Memory Graph

**実装方法**:
```typescript
// scripts/kg/build-graph.ts

interface KnowledgeNode {
  id: string;
  type: 'daily' | 'weekly' | 'adr' | 'spec' | 'concept';
  content: string;
  embeddings: number[];
  connections: string[];
  created: Date;
  accessed: Date;
}

const buildKnowledgeGraph = async () => {
  // 1. KB から全ノードを読み込み
  const nodes = await loadAllNodes();
  
  // 2. Embedding 距離で関連性を計算
  const connections = computeSimilarities(nodes);
  
  // 3. D3.js / Cytoscape でグラフ生成
  const graph = {
    nodes: nodes.map(n => ({
      id: n.id,
      label: n.title,
      color: getColorByType(n.type)
    })),
    edges: connections.map(c => ({
      source: c.from,
      target: c.to,
      weight: c.similarity
    }))
  };
  
  // 4. /kg/graph.json へ出力
  await fs.writeFile('kb/graph.json', JSON.stringify(graph));
};
```

**UI実装**:
- Next.js page: `/kg` で可視化
- リアルタイムインタラクション
- クリックでノード詳細表示

**効果**:
- 知識のつながりを視覚的に把握
- 孤立した知識を発見
- 新しい洞察のきっかけ

**実装難易度**: ⭐⭐⭐☆☆ (4週間)

---

## 🎯 v2.2: AI Priority Extraction

### 自動優先度抽出エンジン

**実装方法**:
```typescript
// /api/cortex/extract-priorities

const extractPriorities = async (digests: string[]) => {
  const prompt = `
以下の daily/weekly digests から、次のアクションを優先度付きで抽出:

${digests.join('\n---\n')}

出力形式:
## P0 (緊急)
- [task]

## P1 (重要)
- [task]

## P2 (中期)
- [task]

## P3 (長期)
- [task]
`;

  const response = await claude.createMessage({
    model: "claude-sonnet-4.5",
    messages: [{ role: "user", content: prompt }]
  });
  
  return parsePriorities(response.content);
};
```

**統合**:
- `/brief` コマンドで自動実行
- TODO.md への自動追加
- Slack 通知で朝に届く

**効果**:
- 手動タスク管理不要
- AI が文脈から次のアクションを提案
- 戦略的思考に集中できる

**実装難易度**: ⭐⭐⭐☆☆ (3週間)

---

## 💻 v2.3: Cortex CLI

### コマンドライン拡張

**実装方法**:
```bash
#!/usr/bin/env node
// bin/cortex

import { Command } from 'commander';

const program = new Command();

program
  .name('cortex')
  .description('Cortex OS CLI')
  .version('2.3.0');

// cortex new daily
program
  .command('new <type>')
  .description('Create new note (daily, weekly, adr, spec)')
  .action(async (type) => {
    const template = await loadTemplate(type);
    const filled = fillTemplate(template);
    await obsidian.create(filled);
    console.log(`✅ Created ${type} note`);
  });

// cortex summarize weekly
program
  .command('summarize <period>')
  .description('Generate summary (weekly, monthly, yearly)')
  .action(async (period) => {
    const summary = await generateSummary(period);
    console.log(summary);
  });

// cortex search <query>
program
  .command('search <query>')
  .description('Search knowledge base')
  .option('-k, --top-k <n>', 'Number of results', '5')
  .action(async (query, options) => {
    const results = await kbSearch(query, options.topK);
    console.log(results);
  });

// cortex brief
program
  .command('brief')
  .description('Generate morning briefing')
  .action(async () => {
    const plan = await generateBrief();
    console.log(plan);
  });

// cortex wrap-up
program
  .command('wrap-up')
  .description('Generate evening wrap-up')
  .action(async () => {
    const summary = await generateWrapUp();
    console.log(summary);
  });

program.parse();
```

**インストール**:
```bash
pnpm link
# → cortex コマンドがグローバルで使える
```

**効果**:
- ターミナルから直接 Cortex OS を操作
- スクリプト・自動化との連携
- キーボードから手を離さない

**実装難易度**: ⭐⭐☆☆☆ (1週間)

---

## 🎬 v2.4: Action Planner

### KB 逆算型タスク生成

**実装方法**:
```typescript
// /api/cortex/plan-actions

const planActions = async (goal: string) => {
  // 1. KB から関連知識を検索
  const knowledge = await kbSearch(goal, 20);
  
  // 2. 過去の実績・パターンを分析
  const history = await analyzeHistory(goal);
  
  // 3. AI による行動計画生成
  const plan = await claude.createMessage({
    model: "claude-sonnet-4.5",
    messages: [{
      role: "user",
      content: `
Goal: ${goal}

Related Knowledge:
${knowledge.map(k => k.content).join('\n')}

Past Experience:
${history.map(h => h.summary).join('\n')}

上記を元に、具体的な行動計画を生成:
1. 短期アクション (1週間)
2. 中期マイルストーン (1ヶ月)
3. 長期ゴール (3ヶ月)

各アクションには:
- 具体的なステップ
- 必要なリソース
- 想定時間
- 成功指標
を含めてください。
`
    }]
  });
  
  return parseActionPlan(plan);
};
```

**統合**:
- `/plan <goal>` コマンド
- TODO.md への自動追加
- Projects/ ディレクトリへの保存

**効果**:
- ゴールから逆算した具体的アクション
- KB の知識を活用した実現可能な計画
- 戦略と実行の完全な統合

**実装難易度**: ⭐⭐⭐⭐☆ (6週間)

---

## 📊 実装優先順位

### Phase 1 (1-2ヶ月)
```
✅ v1.0 (完了)
🔄 v2.0 (Auto-Aggregation)
🔄 v2.3 (Cortex CLI)
```

### Phase 2 (3-4ヶ月)
```
🔄 v2.2 (AI Priority Extraction)
🔄 v2.1 (Knowledge Graph - 簡易版)
```

### Phase 3 (5-6ヶ月)
```
🔄 v2.4 (Action Planner)
🔄 v2.1 (Knowledge Graph - 完全版)
```

---

## 🎯 技術スタック（変更なし）

v2.x でも既存のスタックを活用:
- **Backend**: Next.js API routes
- **Agent**: Claude Sonnet 4.5 via OpenAI Agents SDK
- **Automation**: n8n workflows
- **Storage**: Git repo + Vercel KV
- **KB**: embeddings.json (拡張可能)
- **UI**: React + Tailwind
- **CLI**: Commander.js

---

## 🚀 ゴール

**Cortex OS v3.0 (1年後)**: 
- 完全自律型の知識OS
- 人間は「考える」「決める」だけ
- システムが「実行」「学習」「進化」を担当

**Vision**:
```
人間: "来月までに新機能をリリースしたい"
Cortex OS: "了解。以下の計画を生成しました..."
         → タスク分解
         → リソース見積もり
         → リスク分析
         → 毎日の進捗追跡
         → 自動調整
```

---

**これが、真の "Operating System for Human Intelligence" です。**

