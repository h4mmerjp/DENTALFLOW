# DENTALFLOW データベースリレーション移行計画

## 目次
1. [現状分析](#1-現状分析)
2. [問題点の詳細](#2-問題点の詳細)
3. [新アーキテクチャ設計](#3-新アーキテクチャ設計)
4. [データベーススキーマ](#4-データベーススキーマ)
5. [PostgreSQL関数（RPC）](#5-postgresql関数rpc)
6. [Row Level Security（RLS）](#6-row-level-securityrls)
7. [フロントエンド変更計画](#7-フロントエンド変更計画)
8. [マイグレーション戦略](#8-マイグレーション戦略)
9. [実装フェーズ](#9-実装フェーズ)

---

## 1. 現状分析

### 1.1 現在のデータフロー
```
┌─────────────────────────────────────────────────────────────┐
│                  localStorage (ブラウザ)                      │
├─────────────────────────────────────────────────────────────┤
│ toothConditions      → { "11": ["C2"], "12": ["C3"] }       │
│ workflow             → [ {id, groupId, teeth[], ...} ]      │
│ treatmentSchedule    → [ {date, treatments[]} ]             │
│ selectedTreatmentOptions → { "C2-11": 0 }                   │
│ conditions           → [ {code, name, color} ]              │
│ treatmentRules       → { "C2": [{name, duration, stepIds}] }│
│ stepMaster           → [ {id, name, conditionCodes} ]       │
│ schedulingRules      → { priorityOrder, maxPerDay, ... }    │
│ exclusiveRules       → [ [['C1'], ['C2']], ... ]            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 主要な状態変数（useTreatmentWorkflow.js: 1,203行）

| 状態変数 | 用途 | 行数 |
|---------|------|------|
| `toothConditions` | 歯番号→病名のマッピング | - |
| `workflow` | 未配置の治療ノード配列 | - |
| `treatmentSchedule` | 日付別の配置済みノード | - |
| `selectedTreatmentOptions` | 治療法選択状態 | - |

### 1.3 複雑なロジック（DB移行対象）

| 関数名 | 行数 | 複雑度 | 問題点 |
|--------|------|--------|--------|
| `generateTreatmentNodes` | ~165行 | 高 | workflow/schedule二重管理 |
| `executeAutoScheduling` | ~125行 | 高 | 優先順位・制約の手動管理 |
| `splitToothFromNode` | ~135行 | 高 | groupId同期、重複防止 |
| `mergeToothToNode` | ~155行 | 高 | 複数場所からのノード検索 |
| `mergeNodeToNode` | ~130行 | 高 | 同上 |

---

## 2. 問題点の詳細

### 2.1 二重データ管理
```javascript
// 現状: 同じノードが2箇所に存在しうる
workflow = [node1, node2, ...]           // 未配置
treatmentSchedule = [{date, treatments: [node1, ...]}]  // 配置済み

// 問題: node1がどちらにあるか不明確
// → 検索時に両方をチェックする必要がある（コード重複）
```

### 2.2 groupId同期問題
```javascript
// 現状: 同じgroupIdを持つノードを手動で同期
const sameGroupNodes = workflow.filter(n => n.groupId === sourceNode.groupId);
// さらにスケジュール内も検索...
treatmentSchedule.forEach(day => {
  day.treatments.forEach(t => {
    if (t.groupId === sourceNode.groupId) { ... }
  });
});
```

### 2.3 setTimeout ハック
```javascript
// divergeTreatmentPlan内: 状態更新の競合回避
setTimeout(() => {
  generateTreatmentNodes();
}, 10);
// → Reactの状態更新順序に依存した不安定なコード
```

### 2.4 データ整合性リスク
- ノードIDの重複防止がMap/Set頼み
- 歯番号の重複チェックが文字列比較
- completed状態がworkflowとschedule両方で管理

---

## 3. 新アーキテクチャ設計

### 3.1 設計原則
1. **Single Source of Truth**: DBが唯一のデータソース
2. **リレーション活用**: JOINで関連データを自動取得
3. **ロジックのDB移行**: 複雑な操作はPostgreSQL関数へ
4. **フロントエンドの責務**: 表示とユーザー操作のみ

### 3.2 新データフロー
```
┌─────────────────────────────────────────────────────────────┐
│                   Supabase PostgreSQL                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  patients ←─┐                                                │
│             │                                                │
│  tooth_conditions ─┬─→ treatment_nodes ─→ (scheduled_date)  │
│        ↑           │                                         │
│        │           └─→ treatment_groups (groupId管理)        │
│        │                                                     │
│  conditions (マスタ) ─→ treatment_rules ─→ treatment_steps  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              React Frontend (シンプル化)                     │
├─────────────────────────────────────────────────────────────┤
│  • useQuery でデータフェッチ                                  │
│  • useMutation でCRUD操作                                    │
│  • 複雑なロジックはRPC呼び出しのみ                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. データベーススキーマ

### 4.1 ER図
```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   patients   │     │  tooth_conditions│     │ treatment_groups │
├──────────────┤     ├──────────────────┤     ├──────────────────┤
│ id (PK)      │←───┤│ patient_id (FK)  │     │ id (PK)          │
│ name         │     │ tooth_number     │     │ patient_id (FK)  │
│ created_at   │     │ condition_code   │────→│ condition_code   │
└──────────────┘     │ id (PK)          │     │ treatment_name   │
                     └──────────────────┘     │ total_cards      │
                              │               │ created_at       │
                              ↓               └────────┬─────────┘
┌──────────────────────────────────────────────────────┘
│
↓
┌─────────────────────────────────────────────────────────────┐
│                      treatment_nodes                         │
├─────────────────────────────────────────────────────────────┤
│ id (PK)                                                      │
│ group_id (FK) → treatment_groups.id                          │
│ tooth_condition_id (FK) → tooth_conditions.id                │
│ step_id (FK) → steps.id                                      │
│ card_number (1, 2, 3...)                                     │
│ scheduled_date (NULL = 未配置)                                │
│ sort_order (同一日内の順序)                                   │
│ completed (boolean)                                          │
│ created_at                                                   │
└─────────────────────────────────────────────────────────────┘

【マスタテーブル】

┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  conditions  │     │  treatment_rules │     │    steps     │
├──────────────┤     ├──────────────────┤     ├──────────────┤
│ id (PK)      │←───┤│ condition_id(FK) │     │ id (PK)      │
│ code         │     │ name             │────→│ name         │
│ name         │     │ duration         │     │ description  │
│ symbol       │     │ priority         │     └──────────────┘
│ color        │     │ id (PK)          │
│ is_default   │     └──────────────────┘
└──────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│                   treatment_rule_steps                       │
├─────────────────────────────────────────────────────────────┤
│ id (PK)                                                      │
│ treatment_rule_id (FK) → treatment_rules.id                  │
│ step_id (FK) → steps.id                                      │
│ step_order (1, 2, 3...)                                      │
└─────────────────────────────────────────────────────────────┘

【設定テーブル】

┌─────────────────────────────────────────────────────────────┐
│                    scheduling_rules                          │
├─────────────────────────────────────────────────────────────┤
│ id (PK)                                                      │
│ patient_id (FK) - NULL = グローバル設定                        │
│ priority_order (text[]) - ['per', 'pul', 'C4', ...]          │
│ max_treatments_per_day (int)                                 │
│ acute_care_conditions (text[])                               │
│ acute_care_max_per_day (int)                                 │
│ schedule_interval_days (int)                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    exclusive_rules                           │
├─────────────────────────────────────────────────────────────┤
│ id (PK)                                                      │
│ rule_groups (jsonb) - [[['C1'], ['C2'], ['C3']], ...]        │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 SQLスキーマ定義

```sql
-- =====================================================
-- マスタテーブル
-- =====================================================

-- 病名マスタ
CREATE TABLE conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  color TEXT NOT NULL,  -- Tailwind CSSクラス
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ステップマスタ
CREATE TABLE steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,  -- 'step001', 'step002'
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 治療ルールマスタ
CREATE TABLE treatment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_id UUID NOT NULL REFERENCES conditions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration INT NOT NULL,
  priority INT DEFAULT 0,  -- 同一病名内での優先順位
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(condition_id, name)
);

-- 治療ルール→ステップ紐付け
CREATE TABLE treatment_rule_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_rule_id UUID NOT NULL REFERENCES treatment_rules(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  UNIQUE(treatment_rule_id, step_order)
);

-- ステップ→病名の紐付け（どの病名でどのステップが使えるか）
CREATE TABLE step_condition_mappings (
  step_id UUID NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  condition_id UUID NOT NULL REFERENCES conditions(id) ON DELETE CASCADE,
  PRIMARY KEY (step_id, condition_id)
);

-- =====================================================
-- 患者・治療データ
-- =====================================================

-- 患者
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 歯の状態（病名設定）
CREATE TABLE tooth_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  tooth_number TEXT NOT NULL,  -- "11", "12", "bulk-C1-xxx"
  condition_id UUID NOT NULL REFERENCES conditions(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, tooth_number, condition_id)
);

-- 治療グループ（同一治療の複数ノードをグループ化）
CREATE TABLE treatment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_rule_id UUID NOT NULL REFERENCES treatment_rules(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 治療グループ→歯の紐付け（どの歯がこのグループに含まれるか）
CREATE TABLE treatment_group_teeth (
  group_id UUID NOT NULL REFERENCES treatment_groups(id) ON DELETE CASCADE,
  tooth_condition_id UUID NOT NULL REFERENCES tooth_conditions(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, tooth_condition_id)
);

-- 治療ノード（スケジュールに配置されるカード）
CREATE TABLE treatment_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES treatment_groups(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES steps(id) ON DELETE RESTRICT,
  card_number INT NOT NULL,  -- 1, 2, 3...
  scheduled_date DATE,  -- NULL = 未配置
  sort_order INT DEFAULT 0,  -- 同一日内の順序
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, card_number)
);

-- =====================================================
-- 設定テーブル
-- =====================================================

-- スケジューリングルール
CREATE TABLE scheduling_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,  -- NULL = グローバル
  priority_order TEXT[] DEFAULT ARRAY['per', 'pul', 'C4', 'C3', 'C2', 'P2', 'P1', 'C1'],
  max_treatments_per_day INT DEFAULT 3,
  acute_care_conditions TEXT[] DEFAULT ARRAY['per', 'pul', 'C4'],
  acute_care_max_per_day INT DEFAULT 1,
  schedule_interval_days INT DEFAULT 7,
  UNIQUE(patient_id)
);

-- 排他ルール
CREATE TABLE exclusive_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_groups JSONB NOT NULL,  -- [[["C1"], ["C2"], ["C3"], ["C4"]], [["P1"], ["P2"]]]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- インデックス
-- =====================================================

CREATE INDEX idx_tooth_conditions_patient ON tooth_conditions(patient_id);
CREATE INDEX idx_tooth_conditions_tooth ON tooth_conditions(patient_id, tooth_number);
CREATE INDEX idx_treatment_nodes_group ON treatment_nodes(group_id);
CREATE INDEX idx_treatment_nodes_date ON treatment_nodes(scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX idx_treatment_nodes_unscheduled ON treatment_nodes(group_id) WHERE scheduled_date IS NULL;
CREATE INDEX idx_treatment_groups_patient ON treatment_groups(patient_id);
```

### 4.3 ビュー定義

```sql
-- 治療ノードの詳細ビュー（フロントエンド表示用）
CREATE VIEW treatment_nodes_view AS
SELECT
  tn.id,
  tn.group_id,
  tn.card_number,
  tn.scheduled_date,
  tn.sort_order,
  tn.completed,
  tg.patient_id,
  s.name AS step_name,
  s.code AS step_code,
  c.code AS condition_code,
  c.name AS condition_name,
  c.color AS condition_color,
  tr.name AS treatment_name,
  tr.duration AS total_cards,
  (
    SELECT array_agg(tc.tooth_number ORDER BY tc.tooth_number)
    FROM treatment_group_teeth tgt
    JOIN tooth_conditions tc ON tc.id = tgt.tooth_condition_id
    WHERE tgt.group_id = tn.group_id
  ) AS teeth
FROM treatment_nodes tn
JOIN treatment_groups tg ON tg.id = tn.group_id
JOIN treatment_rules tr ON tr.id = tg.treatment_rule_id
JOIN conditions c ON c.id = tr.condition_id
JOIN steps s ON s.id = tn.step_id;

-- 日別スケジュールビュー
CREATE VIEW daily_schedule_view AS
SELECT
  tn.scheduled_date,
  tn.patient_id,
  json_agg(
    json_build_object(
      'id', tn.id,
      'group_id', tn.group_id,
      'card_number', tn.card_number,
      'step_name', tn.step_name,
      'condition_code', tn.condition_code,
      'condition_name', tn.condition_name,
      'condition_color', tn.condition_color,
      'treatment_name', tn.treatment_name,
      'total_cards', tn.total_cards,
      'teeth', tn.teeth,
      'completed', tn.completed,
      'sort_order', tn.sort_order
    ) ORDER BY tn.sort_order
  ) AS treatments
FROM treatment_nodes_view tn
WHERE tn.scheduled_date IS NOT NULL
GROUP BY tn.scheduled_date, tn.patient_id
ORDER BY tn.scheduled_date;
```

---

## 5. PostgreSQL関数（RPC）

### 5.1 治療ノード生成

```sql
-- 歯の病名設定から治療ノードを生成
CREATE OR REPLACE FUNCTION generate_treatment_nodes(
  p_patient_id UUID,
  p_grouping_mode TEXT DEFAULT 'individual'  -- 'individual' or 'grouped'
)
RETURNS TABLE (
  group_id UUID,
  nodes_created INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_condition RECORD;
  v_teeth TEXT[];
  v_treatment_rule RECORD;
  v_new_group_id UUID;
  v_step RECORD;
  v_card_number INT;
  v_total_created INT := 0;
BEGIN
  -- 既存の未完了・未スケジュールノードを削除
  DELETE FROM treatment_nodes
  WHERE group_id IN (
    SELECT id FROM treatment_groups WHERE patient_id = p_patient_id
  )
  AND completed = false
  AND scheduled_date IS NULL;

  -- 病名ごとに処理
  FOR v_condition IN
    SELECT DISTINCT c.id, c.code
    FROM tooth_conditions tc
    JOIN conditions c ON c.id = tc.condition_id
    WHERE tc.patient_id = p_patient_id
    ORDER BY array_position(
      (SELECT priority_order FROM scheduling_rules WHERE patient_id IS NULL LIMIT 1),
      c.code
    )
  LOOP
    -- この病名に該当する歯を取得
    SELECT array_agg(tc.tooth_number ORDER BY tc.tooth_number)
    INTO v_teeth
    FROM tooth_conditions tc
    WHERE tc.patient_id = p_patient_id
      AND tc.condition_id = v_condition.id;

    IF v_teeth IS NOT NULL AND array_length(v_teeth, 1) > 0 THEN
      -- デフォルトの治療ルールを取得
      SELECT * INTO v_treatment_rule
      FROM treatment_rules
      WHERE condition_id = v_condition.id
      ORDER BY priority
      LIMIT 1;

      IF v_treatment_rule IS NOT NULL THEN
        IF p_grouping_mode = 'individual' THEN
          -- 個別モード: 歯ごとにグループ作成
          FOR i IN 1..array_length(v_teeth, 1) LOOP
            v_new_group_id := gen_random_uuid();

            INSERT INTO treatment_groups (id, patient_id, treatment_rule_id)
            VALUES (v_new_group_id, p_patient_id, v_treatment_rule.id);

            -- 歯を紐付け
            INSERT INTO treatment_group_teeth (group_id, tooth_condition_id)
            SELECT v_new_group_id, tc.id
            FROM tooth_conditions tc
            WHERE tc.patient_id = p_patient_id
              AND tc.tooth_number = v_teeth[i]
              AND tc.condition_id = v_condition.id;

            -- ステップごとにノード作成
            v_card_number := 1;
            FOR v_step IN
              SELECT s.id
              FROM treatment_rule_steps trs
              JOIN steps s ON s.id = trs.step_id
              WHERE trs.treatment_rule_id = v_treatment_rule.id
              ORDER BY trs.step_order
            LOOP
              INSERT INTO treatment_nodes (group_id, step_id, card_number)
              VALUES (v_new_group_id, v_step.id, v_card_number);
              v_card_number := v_card_number + 1;
              v_total_created := v_total_created + 1;
            END LOOP;

            group_id := v_new_group_id;
            nodes_created := v_treatment_rule.duration;
            RETURN NEXT;
          END LOOP;
        ELSE
          -- グループモード: 同じ病名の歯をまとめる
          v_new_group_id := gen_random_uuid();

          INSERT INTO treatment_groups (id, patient_id, treatment_rule_id)
          VALUES (v_new_group_id, p_patient_id, v_treatment_rule.id);

          -- すべての歯を紐付け
          INSERT INTO treatment_group_teeth (group_id, tooth_condition_id)
          SELECT v_new_group_id, tc.id
          FROM tooth_conditions tc
          WHERE tc.patient_id = p_patient_id
            AND tc.condition_id = v_condition.id;

          -- ステップごとにノード作成
          v_card_number := 1;
          FOR v_step IN
            SELECT s.id
            FROM treatment_rule_steps trs
            JOIN steps s ON s.id = trs.step_id
            WHERE trs.treatment_rule_id = v_treatment_rule.id
            ORDER BY trs.step_order
          LOOP
            INSERT INTO treatment_nodes (group_id, step_id, card_number)
            VALUES (v_new_group_id, v_step.id, v_card_number);
            v_card_number := v_card_number + 1;
            v_total_created := v_total_created + 1;
          END LOOP;

          group_id := v_new_group_id;
          nodes_created := v_treatment_rule.duration;
          RETURN NEXT;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN;
END;
$$;
```

### 5.2 自動スケジューリング

```sql
-- 自動スケジューリング実行
CREATE OR REPLACE FUNCTION execute_auto_scheduling(
  p_patient_id UUID,
  p_from_date DATE DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  total_assigned INT,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rules scheduling_rules;
  v_node RECORD;
  v_current_date DATE;
  v_treatments_on_date INT;
  v_acute_on_date INT;
  v_is_acute BOOLEAN;
  v_prev_card_date DATE;
  v_assigned INT := 0;
  v_start_date DATE;
BEGIN
  -- スケジューリングルールを取得
  SELECT * INTO v_rules
  FROM scheduling_rules
  WHERE patient_id = p_patient_id OR patient_id IS NULL
  ORDER BY patient_id NULLS LAST
  LIMIT 1;

  IF v_rules IS NULL THEN
    v_rules := ROW(
      NULL, NULL,
      ARRAY['per', 'pul', 'C4', 'C3', 'C2', 'P2', 'P1', 'C1'],
      3, ARRAY['per', 'pul', 'C4'], 1, 7
    )::scheduling_rules;
  END IF;

  -- 開始日の決定
  v_start_date := COALESCE(p_from_date, CURRENT_DATE);
  v_current_date := v_start_date;

  -- 未配置ノードを優先順位でソートして処理
  FOR v_node IN
    SELECT
      tn.id,
      tn.group_id,
      tn.card_number,
      c.code AS condition_code,
      tr.duration AS total_cards
    FROM treatment_nodes tn
    JOIN treatment_groups tg ON tg.id = tn.group_id
    JOIN treatment_rules tr ON tr.id = tg.treatment_rule_id
    JOIN conditions c ON c.id = tr.condition_id
    WHERE tg.patient_id = p_patient_id
      AND tn.scheduled_date IS NULL
      AND tn.completed = false
    ORDER BY
      array_position(v_rules.priority_order, c.code),
      tn.group_id,
      tn.card_number
  LOOP
    v_is_acute := v_node.condition_code = ANY(v_rules.acute_care_conditions);

    -- 配置可能な日を探す
    LOOP
      -- 当日の治療数を確認
      SELECT COUNT(*) INTO v_treatments_on_date
      FROM treatment_nodes tn
      JOIN treatment_groups tg ON tg.id = tn.group_id
      WHERE tg.patient_id = p_patient_id
        AND tn.scheduled_date = v_current_date;

      -- 急性症状の数を確認
      SELECT COUNT(*) INTO v_acute_on_date
      FROM treatment_nodes tn
      JOIN treatment_groups tg ON tg.id = tn.group_id
      JOIN treatment_rules tr ON tr.id = tg.treatment_rule_id
      JOIN conditions c ON c.id = tr.condition_id
      WHERE tg.patient_id = p_patient_id
        AND tn.scheduled_date = v_current_date
        AND c.code = ANY(v_rules.acute_care_conditions);

      -- 配置可能かチェック
      IF v_treatments_on_date < v_rules.max_treatments_per_day
         AND (NOT v_is_acute OR v_acute_on_date < v_rules.acute_care_max_per_day)
      THEN
        -- 連続治療の場合、前のカードの日付をチェック
        IF v_node.card_number > 1 THEN
          SELECT tn.scheduled_date INTO v_prev_card_date
          FROM treatment_nodes tn
          WHERE tn.group_id = v_node.group_id
            AND tn.card_number = v_node.card_number - 1;

          IF v_prev_card_date IS NULL OR v_prev_card_date >= v_current_date THEN
            v_current_date := v_current_date + v_rules.schedule_interval_days;
            CONTINUE;
          END IF;
        END IF;

        -- 配置実行
        UPDATE treatment_nodes
        SET scheduled_date = v_current_date,
            sort_order = v_treatments_on_date + 1
        WHERE id = v_node.id;

        v_assigned := v_assigned + 1;
        EXIT;
      END IF;

      v_current_date := v_current_date + v_rules.schedule_interval_days;

      -- 無限ループ防止
      IF v_current_date > v_start_date + INTERVAL '1 year' THEN
        EXIT;
      END IF;
    END LOOP;

    -- 次のノード用に日付をリセット
    v_current_date := v_start_date;
  END LOOP;

  success := true;
  total_assigned := v_assigned;
  message := format('%s件の治療を自動配置しました。', v_assigned);
  RETURN NEXT;
END;
$$;
```

### 5.3 歯の分離

```sql
-- 歯を別グループに分離
CREATE OR REPLACE FUNCTION split_tooth_from_node(
  p_node_id UUID,
  p_teeth_to_split TEXT[],
  p_target_date DATE DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  new_group_id UUID,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_node treatment_nodes;
  v_source_group treatment_groups;
  v_new_group_id UUID;
  v_remaining_teeth INT;
  v_tooth_condition_ids UUID[];
BEGIN
  -- ソースノードを取得
  SELECT * INTO v_source_node FROM treatment_nodes WHERE id = p_node_id;
  IF v_source_node IS NULL THEN
    success := false;
    message := 'ノードが見つかりません。';
    RETURN NEXT;
    RETURN;
  END IF;

  -- グループ情報を取得
  SELECT * INTO v_source_group FROM treatment_groups WHERE id = v_source_node.group_id;

  -- 分離する歯のtooth_condition_idを取得
  SELECT array_agg(tgt.tooth_condition_id) INTO v_tooth_condition_ids
  FROM treatment_group_teeth tgt
  JOIN tooth_conditions tc ON tc.id = tgt.tooth_condition_id
  WHERE tgt.group_id = v_source_node.group_id
    AND tc.tooth_number = ANY(p_teeth_to_split);

  -- 残る歯の数を確認
  SELECT COUNT(*) INTO v_remaining_teeth
  FROM treatment_group_teeth tgt
  JOIN tooth_conditions tc ON tc.id = tgt.tooth_condition_id
  WHERE tgt.group_id = v_source_node.group_id
    AND tc.tooth_number != ALL(p_teeth_to_split);

  IF v_remaining_teeth = 0 THEN
    success := false;
    message := '少なくとも1本の歯を残す必要があります。';
    RETURN NEXT;
    RETURN;
  END IF;

  -- 新しいグループを作成
  v_new_group_id := gen_random_uuid();
  INSERT INTO treatment_groups (id, patient_id, treatment_rule_id)
  VALUES (v_new_group_id, v_source_group.patient_id, v_source_group.treatment_rule_id);

  -- 歯を新グループに移動
  UPDATE treatment_group_teeth
  SET group_id = v_new_group_id
  WHERE tooth_condition_id = ANY(v_tooth_condition_ids)
    AND group_id = v_source_node.group_id;

  -- 新グループ用のノードを作成（元のグループの全ノードをコピー）
  INSERT INTO treatment_nodes (group_id, step_id, card_number, scheduled_date, sort_order, completed)
  SELECT
    v_new_group_id,
    step_id,
    card_number,
    CASE
      WHEN card_number = v_source_node.card_number THEN p_target_date
      ELSE scheduled_date
    END,
    sort_order,
    completed
  FROM treatment_nodes
  WHERE group_id = v_source_node.group_id;

  success := true;
  new_group_id := v_new_group_id;
  message := format('歯式 %s を分離しました。', array_to_string(p_teeth_to_split, ', '));
  RETURN NEXT;
END;
$$;
```

### 5.4 ノードの合体

```sql
-- ノードを別のノードに合体
CREATE OR REPLACE FUNCTION merge_nodes(
  p_source_group_id UUID,
  p_target_group_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_group treatment_groups;
  v_target_group treatment_groups;
  v_source_teeth TEXT[];
  v_target_teeth TEXT[];
  v_duplicate_teeth TEXT[];
BEGIN
  -- グループ情報を取得
  SELECT * INTO v_source_group FROM treatment_groups WHERE id = p_source_group_id;
  SELECT * INTO v_target_group FROM treatment_groups WHERE id = p_target_group_id;

  IF v_source_group IS NULL OR v_target_group IS NULL THEN
    success := false;
    message := 'グループが見つかりません。';
    RETURN NEXT;
    RETURN;
  END IF;

  -- 同じ治療ルールか確認
  IF v_source_group.treatment_rule_id != v_target_group.treatment_rule_id THEN
    success := false;
    message := '同じ治療法のノードにのみ合体できます。';
    RETURN NEXT;
    RETURN;
  END IF;

  -- 重複する歯がないか確認
  SELECT array_agg(tc.tooth_number) INTO v_source_teeth
  FROM treatment_group_teeth tgt
  JOIN tooth_conditions tc ON tc.id = tgt.tooth_condition_id
  WHERE tgt.group_id = p_source_group_id;

  SELECT array_agg(tc.tooth_number) INTO v_target_teeth
  FROM treatment_group_teeth tgt
  JOIN tooth_conditions tc ON tc.id = tgt.tooth_condition_id
  WHERE tgt.group_id = p_target_group_id;

  SELECT array_agg(t) INTO v_duplicate_teeth
  FROM unnest(v_source_teeth) t
  WHERE t = ANY(v_target_teeth);

  IF v_duplicate_teeth IS NOT NULL AND array_length(v_duplicate_teeth, 1) > 0 THEN
    success := false;
    message := format('歯式 %s は既にターゲットノードに含まれています。', array_to_string(v_duplicate_teeth, ', '));
    RETURN NEXT;
    RETURN;
  END IF;

  -- 歯をターゲットグループに移動
  UPDATE treatment_group_teeth
  SET group_id = p_target_group_id
  WHERE group_id = p_source_group_id;

  -- ソースグループのノードを削除
  DELETE FROM treatment_nodes WHERE group_id = p_source_group_id;

  -- ソースグループを削除
  DELETE FROM treatment_groups WHERE id = p_source_group_id;

  success := true;
  message := format('ノードを合体しました（歯式: %s）', array_to_string(v_source_teeth, ', '));
  RETURN NEXT;
END;
$$;
```

### 5.5 排他ルールチェック

```sql
-- 排他ルールをチェック
CREATE OR REPLACE FUNCTION check_exclusive_rules(
  p_condition_code TEXT,
  p_current_conditions TEXT[]
)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule JSONB;
  v_group JSONB;
  v_target_group_idx INT;
  v_conflicting TEXT[] := ARRAY[]::TEXT[];
  v_code TEXT;
BEGIN
  FOR v_rule IN
    SELECT jsonb_array_elements(rule_groups) FROM exclusive_rules
  LOOP
    v_target_group_idx := -1;

    -- 追加しようとしている病名がどのグループに属するか探す
    FOR i IN 0..jsonb_array_length(v_rule) - 1 LOOP
      IF v_rule->i ? p_condition_code THEN
        v_target_group_idx := i;
        EXIT;
      END IF;
    END LOOP;

    -- 対象の病名がこのルールに含まれている場合
    IF v_target_group_idx >= 0 THEN
      -- 他のグループの病名をチェック
      FOR i IN 0..jsonb_array_length(v_rule) - 1 LOOP
        IF i != v_target_group_idx THEN
          FOR v_group IN SELECT jsonb_array_elements(v_rule->i) LOOP
            v_code := v_group #>> '{}';
            IF v_code = ANY(p_current_conditions) THEN
              v_conflicting := array_append(v_conflicting, v_code);
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN v_conflicting;
END;
$$;
```

---

## 6. Row Level Security（RLS）

```sql
-- RLSを有効化
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tooth_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_group_teeth ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_nodes ENABLE ROW LEVEL SECURITY;

-- 認証ユーザー用ポリシー（将来のマルチユーザー対応）
-- 現時点では anon キーでの全アクセスを許可

CREATE POLICY "Allow all access for authenticated users" ON patients
  FOR ALL USING (true);

CREATE POLICY "Allow all access for authenticated users" ON tooth_conditions
  FOR ALL USING (true);

CREATE POLICY "Allow all access for authenticated users" ON treatment_groups
  FOR ALL USING (true);

CREATE POLICY "Allow all access for authenticated users" ON treatment_group_teeth
  FOR ALL USING (true);

CREATE POLICY "Allow all access for authenticated users" ON treatment_nodes
  FOR ALL USING (true);

-- マスタテーブルは読み取り専用（一般ユーザー）
CREATE POLICY "Read-only for all users" ON conditions
  FOR SELECT USING (true);

CREATE POLICY "Read-only for all users" ON steps
  FOR SELECT USING (true);

CREATE POLICY "Read-only for all users" ON treatment_rules
  FOR SELECT USING (true);

CREATE POLICY "Read-only for all users" ON treatment_rule_steps
  FOR SELECT USING (true);
```

---

## 7. フロントエンド変更計画

### 7.1 新しいファイル構成

```
src/
├── lib/
│   └── supabase.js              # Supabaseクライアント初期化
├── hooks/
│   ├── useTreatmentWorkflow.js  # 簡素化版（~300行）
│   ├── usePatient.js            # 患者データ管理
│   ├── useConditions.js         # 病名マスタ
│   ├── useTreatmentNodes.js     # 治療ノード操作
│   └── useSchedule.js           # スケジュール操作
├── services/
│   └── treatmentService.js      # RPC呼び出しラッパー
└── components/
    └── (既存コンポーネント)
```

### 7.2 Supabaseクライアント設定

```javascript
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 7.3 簡素化された useTreatmentWorkflow.js

```javascript
// src/hooks/useTreatmentWorkflow.js（簡素化版）
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useTreatmentWorkflow(patientId) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // データ状態
  const [toothConditions, setToothConditions] = useState([]);
  const [treatmentNodes, setTreatmentNodes] = useState([]);
  const [schedule, setSchedule] = useState([]);

  // データフェッチ
  const fetchData = async () => {
    setLoading(true);
    try {
      const [conditionsRes, nodesRes] = await Promise.all([
        supabase
          .from('tooth_conditions')
          .select('*, condition:conditions(*)')
          .eq('patient_id', patientId),
        supabase
          .from('treatment_nodes_view')
          .select('*')
          .eq('patient_id', patientId)
      ]);

      if (conditionsRes.error) throw conditionsRes.error;
      if (nodesRes.error) throw nodesRes.error;

      setToothConditions(conditionsRes.data);

      // スケジュール済みと未スケジュールに分離
      const scheduled = nodesRes.data.filter(n => n.scheduled_date);
      const unscheduled = nodesRes.data.filter(n => !n.scheduled_date);

      // 日付でグループ化
      const scheduleMap = new Map();
      scheduled.forEach(node => {
        if (!scheduleMap.has(node.scheduled_date)) {
          scheduleMap.set(node.scheduled_date, []);
        }
        scheduleMap.get(node.scheduled_date).push(node);
      });

      setSchedule(
        Array.from(scheduleMap.entries())
          .map(([date, treatments]) => ({ date, treatments }))
          .sort((a, b) => a.date.localeCompare(b.date))
      );
      setTreatmentNodes(unscheduled);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) fetchData();
  }, [patientId]);

  // ===== RPC呼び出しラッパー =====

  const generateNodes = async (groupingMode = 'individual') => {
    const { error } = await supabase.rpc('generate_treatment_nodes', {
      p_patient_id: patientId,
      p_grouping_mode: groupingMode
    });
    if (error) throw error;
    await fetchData();
  };

  const autoSchedule = async (fromDate = null) => {
    const { data, error } = await supabase.rpc('execute_auto_scheduling', {
      p_patient_id: patientId,
      p_from_date: fromDate
    });
    if (error) throw error;
    await fetchData();
    return data[0];
  };

  const splitTooth = async (nodeId, teethToSplit, targetDate = null) => {
    const { data, error } = await supabase.rpc('split_tooth_from_node', {
      p_node_id: nodeId,
      p_teeth_to_split: teethToSplit,
      p_target_date: targetDate
    });
    if (error) throw error;
    await fetchData();
    return data[0];
  };

  const mergeNodes = async (sourceGroupId, targetGroupId) => {
    const { data, error } = await supabase.rpc('merge_nodes', {
      p_source_group_id: sourceGroupId,
      p_target_group_id: targetGroupId
    });
    if (error) throw error;
    await fetchData();
    return data[0];
  };

  // ===== 単純なCRUD操作 =====

  const addToothCondition = async (toothNumber, conditionId) => {
    const { error } = await supabase
      .from('tooth_conditions')
      .insert({ patient_id: patientId, tooth_number: toothNumber, condition_id: conditionId });
    if (error) throw error;
    await fetchData();
  };

  const removeToothCondition = async (id) => {
    const { error } = await supabase
      .from('tooth_conditions')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const moveNodeToDate = async (nodeId, targetDate, sortOrder = 0) => {
    const { error } = await supabase
      .from('treatment_nodes')
      .update({ scheduled_date: targetDate, sort_order: sortOrder })
      .eq('id', nodeId);
    if (error) throw error;
    await fetchData();
  };

  const toggleCompletion = async (nodeId) => {
    const node = treatmentNodes.find(n => n.id === nodeId)
      || schedule.flatMap(d => d.treatments).find(n => n.id === nodeId);

    const { error } = await supabase
      .from('treatment_nodes')
      .update({
        completed: !node.completed,
        completed_at: !node.completed ? new Date().toISOString() : null
      })
      .eq('id', nodeId);
    if (error) throw error;
    await fetchData();
  };

  return {
    loading,
    error,
    toothConditions,
    treatmentNodes,  // 未スケジュールノード（旧workflow）
    schedule,        // スケジュール済み（旧treatmentSchedule）

    // RPC操作
    generateNodes,
    autoSchedule,
    splitTooth,
    mergeNodes,

    // CRUD操作
    addToothCondition,
    removeToothCondition,
    moveNodeToDate,
    toggleCompletion,

    // リフレッシュ
    refresh: fetchData
  };
}
```

### 7.4 コンポーネント変更ポイント

| コンポーネント | 変更内容 |
|--------------|---------|
| `App.jsx` | `useTreatmentWorkflow(patientId)` に変更、患者選択UIを追加 |
| `WorkflowBoard.jsx` | `workflow` → `treatmentNodes` にプロップ名変更 |
| `ScheduleCalendar.jsx` | `treatmentSchedule` → `schedule` にプロップ名変更 |
| `DraggableCard.jsx` | ドラッグ完了時に `moveNodeToDate()` を呼び出し |
| `SettingsModal.jsx` | マスタ編集をDB操作に変更（別フェーズ） |

---

## 8. マイグレーション戦略

### 8.1 localStorageデータのインポート

```javascript
// src/utils/migrateToSupabase.js
import { supabase } from '../lib/supabase';

export async function migrateFromLocalStorage() {
  // 1. localStorageからデータを取得
  const toothConditions = JSON.parse(localStorage.getItem('toothConditions') || '{}');
  const workflow = JSON.parse(localStorage.getItem('workflow') || '[]');
  const treatmentSchedule = JSON.parse(localStorage.getItem('treatmentSchedule') || '[]');
  const conditions = JSON.parse(localStorage.getItem('conditions') || '[]');
  const treatmentRules = JSON.parse(localStorage.getItem('treatmentRules') || '{}');
  const stepMaster = JSON.parse(localStorage.getItem('stepMaster') || '[]');

  // 2. 患者を作成
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .insert({ name: 'インポート患者' })
    .select()
    .single();

  if (patientError) throw patientError;

  // 3. マスタデータをインポート（条件、ステップ、治療ルール）
  // ... (詳細な実装)

  // 4. toothConditionsをインポート
  for (const [tooth, conditionCodes] of Object.entries(toothConditions)) {
    for (const code of conditionCodes) {
      const { data: condition } = await supabase
        .from('conditions')
        .select('id')
        .eq('code', code)
        .single();

      if (condition) {
        await supabase.from('tooth_conditions').insert({
          patient_id: patient.id,
          tooth_number: tooth,
          condition_id: condition.id
        });
      }
    }
  }

  // 5. 治療ノードを生成
  await supabase.rpc('generate_treatment_nodes', {
    p_patient_id: patient.id,
    p_grouping_mode: 'individual'
  });

  // 6. スケジュールを復元
  // ... (workflowとtreatmentScheduleからスケジュール配置を復元)

  return { success: true, patientId: patient.id };
}
```

### 8.2 段階的移行計画

```
Phase 1: DB並行運用
├── localStorageとDBの両方に書き込み
├── 読み取りはlocalStorageを優先
└── 差分検出・同期機能

Phase 2: DB優先運用
├── 読み取りはDBを優先
├── localStorageはバックアップとして維持
└── オフライン対応

Phase 3: DB完全移行
├── localStorageを削除
├── Supabase Realtime対応
└── マルチデバイス同期
```

---

## 9. 実装フェーズ

### Phase 1: 基盤構築（1-2日）

#### タスク
- [ ] Supabaseプロジェクト作成
- [ ] 環境変数設定（`.env.local`）
- [ ] マイグレーションファイル作成
  - [ ] マスタテーブル
  - [ ] 患者・治療データテーブル
  - [ ] ビュー
  - [ ] RPC関数
- [ ] シードデータ投入（デフォルト病名・ステップ）

#### 成果物
- `supabase/migrations/001_initial_schema.sql`
- `supabase/seed.sql`
- `.env.local`

### Phase 2: コアロジック移行（2-3日）

#### タスク
- [ ] `generate_treatment_nodes` RPC実装・テスト
- [ ] `execute_auto_scheduling` RPC実装・テスト
- [ ] `split_tooth_from_node` RPC実装・テスト
- [ ] `merge_nodes` RPC実装・テスト
- [ ] `check_exclusive_rules` RPC実装・テスト

#### 成果物
- `supabase/migrations/002_rpc_functions.sql`
- RPCテストスクリプト

### Phase 3: フロントエンド統合（2-3日）

#### タスク
- [ ] `src/lib/supabase.js` 作成
- [ ] 新しい `useTreatmentWorkflow.js` 実装
- [ ] `App.jsx` 患者選択UI追加
- [ ] 各コンポーネントのプロップ名変更
- [ ] ドラッグ&ドロップのDB連携

#### 成果物
- 新フック群
- 更新されたコンポーネント

### Phase 4: マイグレーション・テスト（1-2日）

#### タスク
- [ ] localStorageインポート機能
- [ ] E2Eテスト
- [ ] パフォーマンステスト
- [ ] エッジケーステスト

#### 成果物
- マイグレーションスクリプト
- テストレポート

### Phase 5: 本番デプロイ（1日）

#### タスク
- [ ] 本番Supabaseプロジェクト設定
- [ ] RLSポリシー確認
- [ ] デプロイ
- [ ] 監視設定

---

## 付録: 削減される複雑性の比較

### Before（現状）
```javascript
// 1,203行のuseTreatmentWorkflow.js

// 例: splitToothFromNode
const splitToothFromNode = (sourceNodeId, teethToSplit, targetDate) => {
  // 1. ソースノードを検索（workflow or スケジュール）
  let sourceNode = workflow.find(node => node.id === sourceNodeId);
  let isInSchedule = false;
  if (!sourceNode) {
    for (const day of treatmentSchedule) {
      const found = day.treatments.find(t => t.id === sourceNodeId);
      if (found) { sourceNode = found; isInSchedule = true; break; }
    }
  }

  // 2. 同じgroupIdのノードを収集（両方から）
  let sameGroupNodes = workflow.filter(node => node.groupId === sourceNode.groupId);
  if (isInSchedule || sameGroupNodes.length === 0) {
    treatmentSchedule.forEach(day => {
      day.treatments.forEach(t => {
        if (t.groupId === sourceNode.groupId && !sameGroupNodes.find(n => n.id === t.id)) {
          sameGroupNodes.push(t);
        }
      });
    });
  }

  // 3. 新しいノードセット作成（重複防止）
  const workflowMap = new Map();
  // ... 50行以上の複雑なロジック

  // 4. スケジュール更新（条件分岐多数）
  // ... さらに50行以上
};
```

### After（DB化後）
```javascript
// ~300行の簡素化されたuseTreatmentWorkflow.js

const splitTooth = async (nodeId, teethToSplit, targetDate = null) => {
  const { data, error } = await supabase.rpc('split_tooth_from_node', {
    p_node_id: nodeId,
    p_teeth_to_split: teethToSplit,
    p_target_date: targetDate
  });
  if (error) throw error;
  await fetchData();  // 状態を再フェッチするだけ
  return data[0];
};
```

### 複雑性削減の定量評価

| 指標 | Before | After | 削減率 |
|------|--------|-------|--------|
| useTreatmentWorkflow.js 行数 | 1,203行 | ~300行 | 75% |
| 状態変数 | 10個 | 3個 | 70% |
| 複雑なロジック関数 | 5個 | 0個 (DB側) | 100% |
| 二重管理箇所 | 3箇所 | 0箇所 | 100% |
| setTimeoutハック | 1箇所 | 0箇所 | 100% |

---

## 次のステップ

このプランを承認後、以下の順序で実装を進めます：

1. **Supabaseプロジェクト設定**: ダッシュボードでプロジェクト作成
2. **マイグレーション実行**: SQLスキーマを適用
3. **RPC関数テスト**: SQL Editorで各関数を検証
4. **フロントエンド統合**: 段階的にコンポーネントを更新
5. **データ移行**: 既存localStorageデータをインポート

何か質問や調整が必要な箇所はありますか？
