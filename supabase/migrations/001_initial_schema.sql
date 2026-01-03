-- =====================================================
-- Initial Schema Migration for DENTALFLOW
-- =====================================================

-- =====================================================
-- マスタテーブル
-- =====================================================

-- 病名マスタ
CREATE TABLE IF NOT EXISTS conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  color TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ステップマスタ
CREATE TABLE IF NOT EXISTS steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 治療ルールマスタ
CREATE TABLE IF NOT EXISTS treatment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_id UUID NOT NULL REFERENCES conditions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration INT NOT NULL,
  priority INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(condition_id, name)
);

-- 治療ルール→ステップ紐付け
CREATE TABLE IF NOT EXISTS treatment_rule_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_rule_id UUID NOT NULL REFERENCES treatment_rules(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  UNIQUE(treatment_rule_id, step_order)
);

-- ステップ→病名の紐付け
CREATE TABLE IF NOT EXISTS step_condition_mappings (
  step_id UUID NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  condition_id UUID NOT NULL REFERENCES conditions(id) ON DELETE CASCADE,
  PRIMARY KEY (step_id, condition_id)
);

-- =====================================================
-- 患者・治療データ
-- =====================================================

-- 患者
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 歯の状態（病名設定）
CREATE TABLE IF NOT EXISTS tooth_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  tooth_number TEXT NOT NULL,
  condition_id UUID NOT NULL REFERENCES conditions(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, tooth_number, condition_id)
);

-- 治療グループ（同一治療の複数ノードをグループ化）
CREATE TABLE IF NOT EXISTS treatment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_rule_id UUID NOT NULL REFERENCES treatment_rules(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 治療グループ→歯の紐付け
CREATE TABLE IF NOT EXISTS treatment_group_teeth (
  group_id UUID NOT NULL REFERENCES treatment_groups(id) ON DELETE CASCADE,
  tooth_condition_id UUID NOT NULL REFERENCES tooth_conditions(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, tooth_condition_id)
);

-- 治療ノード（スケジュールに配置されるカード）
CREATE TABLE IF NOT EXISTS treatment_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES treatment_groups(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES steps(id) ON DELETE RESTRICT,
  card_number INT NOT NULL,
  scheduled_date DATE,
  sort_order INT DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, card_number)
);

-- =====================================================
-- 設定テーブル
-- =====================================================

-- スケジューリングルール
CREATE TABLE IF NOT EXISTS scheduling_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  priority_order TEXT[] DEFAULT ARRAY['per', 'pul', 'C4', 'C3', 'C2', 'P2', 'P1', 'C1'],
  max_treatments_per_day INT DEFAULT 3,
  acute_care_conditions TEXT[] DEFAULT ARRAY['per', 'pul', 'C4'],
  acute_care_max_per_day INT DEFAULT 1,
  schedule_interval_days INT DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 排他ルール
CREATE TABLE IF NOT EXISTS exclusive_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_groups JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- インデックス
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_tooth_conditions_patient ON tooth_conditions(patient_id);
CREATE INDEX IF NOT EXISTS idx_tooth_conditions_tooth ON tooth_conditions(patient_id, tooth_number);
CREATE INDEX IF NOT EXISTS idx_treatment_nodes_group ON treatment_nodes(group_id);
CREATE INDEX IF NOT EXISTS idx_treatment_nodes_date ON treatment_nodes(scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_treatment_nodes_unscheduled ON treatment_nodes(group_id) WHERE scheduled_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_treatment_groups_patient ON treatment_groups(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_groups_rule ON treatment_groups(treatment_rule_id);
CREATE INDEX IF NOT EXISTS idx_treatment_rules_condition ON treatment_rules(condition_id);

-- =====================================================
-- ビュー
-- =====================================================

-- 治療ノードの詳細ビュー
DROP VIEW IF EXISTS treatment_nodes_view CASCADE;
CREATE VIEW treatment_nodes_view AS
SELECT
  tn.id,
  tn.group_id,
  tn.card_number,
  tn.scheduled_date,
  tn.sort_order,
  tn.completed,
  tn.completed_at,
  tg.patient_id,
  s.name AS step_name,
  s.code AS step_code,
  c.code AS condition_code,
  c.name AS condition_name,
  c.symbol AS condition_symbol,
  c.color AS condition_color,
  tr.name AS treatment_name,
  tr.duration AS total_cards,
  COALESCE(
    (
      SELECT array_agg(tc.tooth_number ORDER BY tc.tooth_number)
      FROM treatment_group_teeth tgt
      JOIN tooth_conditions tc ON tc.id = tgt.tooth_condition_id
      WHERE tgt.group_id = tn.group_id
    ),
    ARRAY[]::TEXT[]
  ) AS teeth
FROM treatment_nodes tn
JOIN treatment_groups tg ON tg.id = tn.group_id
JOIN treatment_rules tr ON tr.id = tg.treatment_rule_id
JOIN conditions c ON c.id = tr.condition_id
JOIN steps s ON s.id = tn.step_id;

-- 日別スケジュールビュー
DROP VIEW IF EXISTS daily_schedule_view CASCADE;
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

-- =====================================================
-- Row Level Security
-- =====================================================

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tooth_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_group_teeth ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_rules ENABLE ROW LEVEL SECURITY;

-- Allow all access (将来のマルチユーザー対応時に制限)
CREATE POLICY "Allow all access" ON patients FOR ALL USING (true);
CREATE POLICY "Allow all access" ON tooth_conditions FOR ALL USING (true);
CREATE POLICY "Allow all access" ON treatment_groups FOR ALL USING (true);
CREATE POLICY "Allow all access" ON treatment_group_teeth FOR ALL USING (true);
CREATE POLICY "Allow all access" ON treatment_nodes FOR ALL USING (true);
CREATE POLICY "Allow all access" ON scheduling_rules FOR ALL USING (true);

-- マスタテーブルは読み取り専用
ALTER TABLE conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_rule_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read-only" ON conditions FOR SELECT USING (true);
CREATE POLICY "Read-only" ON steps FOR SELECT USING (true);
CREATE POLICY "Read-only" ON treatment_rules FOR SELECT USING (true);
CREATE POLICY "Read-only" ON treatment_rule_steps FOR SELECT USING (true);
