-- ========================================
-- Add User Authentication
-- ========================================
-- Purpose: Add Google OAuth authentication and Row Level Security

-- 1. patients テーブルに user_id カラム追加
ALTER TABLE patients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. インデックス作成
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);

-- 3. 既存データがある場合の対処（最初のユーザーに割り当て）
-- 注: 本番環境では既存データの適切な移行計画が必要
-- UPDATE patients SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;

-- 4. NOT NULL 制約を追加（既存データがない場合のみ）
-- ALTER TABLE patients ALTER COLUMN user_id SET NOT NULL;

-- 5. RLS (Row Level Security) 有効化
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tooth_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 6. 既存のRLSポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Users can view own patients" ON patients;
DROP POLICY IF EXISTS "Users can insert own patients" ON patients;
DROP POLICY IF EXISTS "Users can update own patients" ON patients;
DROP POLICY IF EXISTS "Users can delete own patients" ON patients;
DROP POLICY IF EXISTS "Users can access own tooth_conditions" ON tooth_conditions;
DROP POLICY IF EXISTS "Users can access own treatment_nodes" ON treatment_nodes;
DROP POLICY IF EXISTS "Users can access own treatment_schedule" ON treatment_schedule;
DROP POLICY IF EXISTS "Users can access own user_settings" ON user_settings;

-- 7. RLS ポリシー作成
-- patients: ユーザーは自分のデータのみアクセス可能
CREATE POLICY "Users can view own patients" ON patients
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patients" ON patients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patients" ON patients
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own patients" ON patients
  FOR DELETE USING (auth.uid() = user_id);

-- tooth_conditions: patients経由でアクセス制御
CREATE POLICY "Users can access own tooth_conditions" ON tooth_conditions
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- treatment_nodes: patient_id経由でアクセス制御
CREATE POLICY "Users can access own treatment_nodes" ON treatment_nodes
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- treatment_schedule: patient_id経由でアクセス制御
CREATE POLICY "Users can access own treatment_schedule" ON treatment_schedule
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- user_settings: patient_id経由でアクセス制御
CREATE POLICY "Users can access own user_settings" ON user_settings
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- 8. マスターデータテーブルは全員読み取り可能
-- conditions
ALTER TABLE conditions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can read conditions" ON conditions;
CREATE POLICY "Everyone can read conditions" ON conditions FOR SELECT USING (true);

-- treatment_templates
ALTER TABLE treatment_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can read treatment_templates" ON treatment_templates;
CREATE POLICY "Everyone can read treatment_templates" ON treatment_templates FOR SELECT USING (true);

-- step_templates
ALTER TABLE step_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can read step_templates" ON step_templates;
CREATE POLICY "Everyone can read step_templates" ON step_templates FOR SELECT USING (true);

-- exclusive_rules
ALTER TABLE exclusive_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can read exclusive_rules" ON exclusive_rules;
CREATE POLICY "Everyone can read exclusive_rules" ON exclusive_rules FOR SELECT USING (true);

-- 9. コメント追加
COMMENT ON COLUMN patients.user_id IS 'ログインユーザー（病院スタッフ/歯科医師）のID';
