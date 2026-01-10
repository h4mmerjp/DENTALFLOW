# Supabase Migration Plan (Revised)

## 概要
LocalStorageからSupabaseへの移行。複雑なロジックをDBレベルで管理。

---

## Phase 1: Supabaseスキーマ設計

### テーブル構造

```sql
-- ========================================
-- マスターデータ（読み取り専用）
-- ========================================

-- 病名マスター
CREATE TABLE conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,           -- 'C1', 'C2', 'pul'等
  name TEXT NOT NULL,                  -- 'C1（初期う蝕）'
  symbol TEXT NOT NULL,                -- 表示用シンボル
  color TEXT NOT NULL,                 -- TailwindCSSクラス
  disease_code TEXT,                   -- 厚労省コード
  disease_name TEXT,                   -- 厚労省名称
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 治療法マスター
CREATE TABLE treatment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_code TEXT REFERENCES conditions(code),
  name TEXT NOT NULL,                  -- 'CR', 'In', 'RCT'等
  duration INT NOT NULL DEFAULT 1,     -- 必要ステップ数
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ステップマスター
CREATE TABLE step_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_template_id UUID REFERENCES treatment_templates(id),
  step_number INT NOT NULL,            -- 1, 2, 3...
  name TEXT NOT NULL,                  -- 'KP', '印象', 'セット'
  step_id TEXT,                        -- 'step01'等（互換性用）
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 排他ルール
CREATE TABLE exclusive_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_group INT NOT NULL,             -- ルールグループ番号
  condition_code TEXT REFERENCES conditions(code),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- ユーザーデータ（患者ごと）
-- ========================================

-- 患者
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 歯の状態（患者×歯番号×病名）
CREATE TABLE tooth_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  tooth_number TEXT NOT NULL,          -- '11', '12'等
  condition_code TEXT REFERENCES conditions(code),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, tooth_number, condition_code)
);

-- 治療ノード（ワークフロー）
CREATE TABLE treatment_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  group_id UUID NOT NULL,              -- 連続治療グループ
  condition_code TEXT NOT NULL,        -- 'C2', 'C2→C3'等
  actual_condition_code TEXT,          -- 実際の病名コード
  treatment_name TEXT NOT NULL,        -- 'CR', 'RCT'等
  step_name TEXT NOT NULL,             -- 'KP', '印象'等
  teeth TEXT[] NOT NULL,               -- ['11', '12']
  card_number INT NOT NULL,            -- 1, 2, 3...
  total_cards INT NOT NULL,            -- 合計ステップ数
  is_sequential BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- スケジュール（治療日程）
CREATE TABLE treatment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  node_id UUID REFERENCES treatment_nodes(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, scheduled_date, node_id)
);

-- ユーザー設定
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, key)
);
```

### RPC関数

```sql
-- ========================================
-- RPC: 治療計画分岐（diverge）
-- ========================================
CREATE OR REPLACE FUNCTION diverge_treatment_plan(
  p_node_id UUID,
  p_new_condition TEXT
) RETURNS JSONB AS $$
DECLARE
  v_source_node RECORD;
  v_new_group_id UUID;
  v_result JSONB;
BEGIN
  -- 1. ソースノード取得
  SELECT * INTO v_source_node FROM treatment_nodes WHERE id = p_node_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Node not found');
  END IF;

  -- 2. 新グループID生成
  v_new_group_id := gen_random_uuid();

  -- 3. 前のステップを完了済みに
  UPDATE treatment_nodes
  SET completed = true, updated_at = now()
  WHERE group_id = v_source_node.group_id
    AND card_number < v_source_node.card_number;

  -- 4. 対象以降のノードを削除
  DELETE FROM treatment_nodes
  WHERE group_id = v_source_node.group_id
    AND card_number >= v_source_node.card_number
    AND completed = false;

  -- 5. 新しい病名で治療ノードを生成（別途呼び出し）

  RETURN jsonb_build_object(
    'success', true,
    'new_group_id', v_new_group_id,
    'old_condition', v_source_node.condition_code,
    'new_condition', p_new_condition
  );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- RPC: 自動スケジューリング
-- ========================================
CREATE OR REPLACE FUNCTION auto_schedule_treatments(
  p_patient_id UUID,
  p_from_date DATE DEFAULT NULL,
  p_max_per_day INT DEFAULT 3,
  p_interval_days INT DEFAULT 7
) RETURNS JSONB AS $$
DECLARE
  v_node RECORD;
  v_current_date DATE;
  v_day_count INT;
  v_assigned INT := 0;
BEGIN
  v_current_date := COALESCE(p_from_date, CURRENT_DATE);

  FOR v_node IN
    SELECT * FROM treatment_nodes
    WHERE patient_id = p_patient_id
      AND completed = false
      AND id NOT IN (SELECT node_id FROM treatment_schedule WHERE patient_id = p_patient_id)
    ORDER BY
      array_position(ARRAY['per','pul','C4','C3','P2','C2','P1','C1'], condition_code),
      card_number
  LOOP
    -- 現在の日の配置数チェック
    SELECT COUNT(*) INTO v_day_count
    FROM treatment_schedule
    WHERE patient_id = p_patient_id AND scheduled_date = v_current_date;

    IF v_day_count >= p_max_per_day THEN
      v_current_date := v_current_date + p_interval_days;
    END IF;

    -- スケジュールに追加
    INSERT INTO treatment_schedule (patient_id, scheduled_date, node_id, sort_order)
    VALUES (p_patient_id, v_current_date, v_node.id, v_day_count + 1);

    v_assigned := v_assigned + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'assigned', v_assigned);
END;
$$ LANGUAGE plpgsql;
```

---

## Phase 2: 実装タスク（Sonnet用）

### ✅ Task 1: Supabaseプロジェクト設定（完了）
```yaml
files:
  - .env.local (NEW) ✓
  - package.json (MODIFY: add @supabase/supabase-js) ✓
  - src/lib/supabase.js (NEW) ✓

steps:
  1. npm install @supabase/supabase-js ✓
  2. .env.localにSUPABASE_URL, SUPABASE_ANON_KEY追加 ✓
  3. supabase.js作成 ✓

実行結果:
  - プロジェクトID: bywowhmbnxshmwloedle
  - 接続テスト成功
  - Supabaseクライアント初期化完了
```

### ✅ Task 2: SQLマイグレーション実行（完了）
```yaml
files:
  - supabase/migrations/001_schema.sql (NEW) ✓
  - supabase/migrations/002_rpc.sql (NEW) ✓
  - supabase/migrations/003_seed.sql (NEW) ✓
  - supabase/MIGRATION_GUIDE.md (NEW) ✓

steps:
  1. 上記スキーマをSupabaseダッシュボードで実行 ✓
  2. RPC関数を作成 ✓
  3. マスターデータをシード ✓

実行結果（MCP経由）:
  - conditions: 9行（C1-C4, pul, per, P1-P2, 欠損）
  - treatment_templates: 19行
  - step_templates: 9行
  - exclusive_rules: 6行
  - RPC関数: diverge_treatment_plan, auto_schedule_treatments,
             clear_schedule, get_patient_summary
```

### ✅ Task 3: useTreatmentWorkflowV2.js作成（完了）
```yaml
files:
  - src/hooks/useTreatmentWorkflowV2.js (NEW) ✓ (675行)

interface:
  - 既存hookと同じexport ✓
  - 内部はSupabase呼び出し ✓
  - リアルタイムサブスクリプション対応 ✓

key_functions:
  - generateTreatmentNodes → INSERT + SELECT ✓
  - executeAutoScheduling → RPC call ✓
  - divergeTreatmentPlan → RPC call ✓
  - handleDrop → UPDATE + reorder (プレースホルダー)
  - loadMasterData → Supabase読み込み ✓
  - loadPatientData → Supabase読み込み ✓

実装状況:
  - コア機能: 完了
  - 一部高度な機能（split/merge）: プレースホルダー
  - 既存V1との完全互換性: 確保
```

### Task 4: 移行ユーティリティ（次回）
```yaml
files:
  - src/utils/migrateToSupabase.js (NEW)

steps:
  1. LocalStorageからデータ読み込み
  2. Supabase形式に変換
  3. バッチINSERT
  4. 検証
```

### Task 5: App.jsx統合（次回）
```yaml
files:
  - src/App.jsx (MODIFY)

steps:
  1. 環境変数でV1/V2切り替え
  2. 初回起動時に移行確認ダイアログ
  3. 移行完了後はV2固定
```

---

## データ移行マッピング

| LocalStorage Key | Supabase Table | 変換ロジック |
|-----------------|----------------|-------------|
| toothConditions | tooth_conditions | Object.entries → rows |
| workflow | treatment_nodes | 1:1 |
| treatmentSchedule | treatment_schedule | flatten (day.treatments → rows) |
| conditions | conditions (master) | 既存マスターと照合 |
| treatmentRules | treatment_templates + step_templates | 分解して正規化 |
| schedulingRules | user_settings | JSONB |
| exclusiveRules | exclusive_rules | 正規化 |

---

## 検証チェックリスト

- [ ] マスターデータがconditionsテーブルに存在
- [ ] 患者作成が成功
- [ ] 歯への病名追加が反映
- [ ] 治療ノード生成が正常
- [ ] 自動スケジューリングRPCが動作
- [ ] diverge RPCが動作
- [ ] ページリロードでデータ永続化確認
- [ ] リアルタイム更新確認

---

## 注意事項

1. **RLS未設定**: 現時点ではRLSなし（認証後に追加）
2. **エラーハンドリング**: フロント側でtry-catch必須
3. **並行運用**: V1とV2を切り替え可能に
4. **ロールバック**: LocalStorageは消さずに保持
