-- ========================================
-- DentalFlow Database Schema
-- ========================================
-- Version: 1.0
-- Purpose: Create tables for tooth conditions, treatments, and scheduling

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- Master Data (Read-only)
-- ========================================

-- Condition Master (病名マスター)
CREATE TABLE conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  color TEXT NOT NULL,
  disease_code TEXT,
  disease_name TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE conditions IS '病名マスターテーブル';
COMMENT ON COLUMN conditions.code IS 'アプリケーション内病名コード (例: C1, C2, pul)';
COMMENT ON COLUMN conditions.disease_code IS '厚生労働省傷病名マスターコード';

-- Treatment Template Master (治療法マスター)
CREATE TABLE treatment_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condition_code TEXT REFERENCES conditions(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration INT NOT NULL DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE treatment_templates IS '治療法テンプレートマスター';
COMMENT ON COLUMN treatment_templates.duration IS '必要なステップ数';

-- Step Template Master (ステップマスター)
CREATE TABLE step_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  treatment_template_id UUID REFERENCES treatment_templates(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  name TEXT NOT NULL,
  step_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE step_templates IS '治療ステップテンプレートマスター';
COMMENT ON COLUMN step_templates.step_id IS 'レガシー互換用ステップID';

-- Exclusive Rules (排他ルール)
CREATE TABLE exclusive_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_group INT NOT NULL,
  condition_code TEXT REFERENCES conditions(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE exclusive_rules IS '排他的病名ルール (例: C1とC2は同時設定不可)';

-- ========================================
-- User Data (患者ごとのデータ)
-- ========================================

-- Patients (患者)
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE patients IS '患者マスター';

-- Tooth Conditions (歯の状態)
CREATE TABLE tooth_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  tooth_number TEXT NOT NULL,
  condition_code TEXT REFERENCES conditions(code),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, tooth_number, condition_code)
);

COMMENT ON TABLE tooth_conditions IS '歯ごとの病名設定';
COMMENT ON COLUMN tooth_conditions.tooth_number IS '歯番号 (例: 11, 12, 21...)';

-- Treatment Nodes (治療ノード)
CREATE TABLE treatment_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  group_id UUID NOT NULL,
  condition_code TEXT NOT NULL,
  actual_condition_code TEXT,
  treatment_name TEXT NOT NULL,
  step_name TEXT NOT NULL,
  teeth TEXT[] NOT NULL,
  card_number INT NOT NULL,
  total_cards INT NOT NULL,
  is_sequential BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE treatment_nodes IS 'ワークフローノード（治療ステップ）';
COMMENT ON COLUMN treatment_nodes.group_id IS '連続治療のグループID';
COMMENT ON COLUMN treatment_nodes.condition_code IS '表示用病名 (例: C2→C3)';
COMMENT ON COLUMN treatment_nodes.actual_condition_code IS '実際の病名コード (例: C3)';
COMMENT ON COLUMN treatment_nodes.teeth IS '対象歯番号の配列';

-- Treatment Schedule (スケジュール)
CREATE TABLE treatment_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  node_id UUID REFERENCES treatment_nodes(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, scheduled_date, node_id)
);

COMMENT ON TABLE treatment_schedule IS '治療スケジュール（日付とノードの紐付け）';

-- User Settings (ユーザー設定)
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, key)
);

COMMENT ON TABLE user_settings IS 'ユーザー設定 (スケジューリングルール等)';

-- ========================================
-- Indexes
-- ========================================

CREATE INDEX idx_tooth_conditions_patient ON tooth_conditions(patient_id);
CREATE INDEX idx_tooth_conditions_tooth ON tooth_conditions(tooth_number);
CREATE INDEX idx_treatment_nodes_patient ON treatment_nodes(patient_id);
CREATE INDEX idx_treatment_nodes_group ON treatment_nodes(group_id);
CREATE INDEX idx_treatment_schedule_patient_date ON treatment_schedule(patient_id, scheduled_date);
CREATE INDEX idx_treatment_schedule_node ON treatment_schedule(node_id);
CREATE INDEX idx_user_settings_patient_key ON user_settings(patient_id, key);

-- ========================================
-- Triggers
-- ========================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_treatment_nodes_updated_at BEFORE UPDATE ON treatment_nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
