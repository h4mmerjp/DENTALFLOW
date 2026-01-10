-- ========================================
-- DentalFlow Seed Data
-- ========================================
-- Version: 1.0
-- Purpose: Insert master data (conditions, treatment templates, exclusive rules)

-- ========================================
-- Conditions Master (病名マスター)
-- ========================================
INSERT INTO conditions (code, name, symbol, color, disease_code, disease_name, sort_order) VALUES
  ('C1', 'C1（初期う蝕）', 'C1', 'bg-yellow-100 border-yellow-400 text-yellow-800', '8843836', 'う蝕', 1),
  ('C2', 'C2（中等度う蝕）', 'C2', 'bg-orange-100 border-orange-400 text-orange-800', '8843836', 'う蝕', 2),
  ('C3', 'C3（深在性う蝕）', 'C3', 'bg-red-100 border-red-400 text-red-800', '8843836', 'う蝕', 3),
  ('C4', 'C4（残根）', 'C4', 'bg-red-200 border-red-600 text-red-900', '8843836', 'う蝕', 4),
  ('pul', 'pul（歯髄炎）', 'pul', 'bg-pink-100 border-pink-400 text-pink-800', '5220071', '急性歯髄炎', 5),
  ('per', 'per（根尖性歯周炎）', 'per', 'bg-rose-100 border-rose-400 text-rose-800', '5231035', '急性根端性歯周炎', 6),
  ('P1', 'P1（軽度歯周病）', 'P1', 'bg-purple-100 border-purple-400 text-purple-800', '5231017', '歯周炎', 7),
  ('P2', 'P2（中等度歯周病）', 'P2', 'bg-purple-100 border-purple-600 text-purple-900', '5231017', '歯周炎', 8),
  ('欠損', '欠損歯', '×', 'bg-gray-200 border-gray-500 text-gray-800', '8850666', '先天性欠如歯', 9)
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- Treatment Templates (治療法マスター)
-- ========================================
-- C1の治療
INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'C1', 'CR', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'C1' AND name = 'CR');

INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'C1', '経過観察', 1, 2
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'C1' AND name = '経過観察');

-- C2の治療
INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'C2', 'CR', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'C2' AND name = 'CR');

INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'C2', 'In', 2, 2
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'C2' AND name = 'In');

-- C3の治療
INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'C3', 'RCT+CR', 3, 1
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'C3' AND name = 'RCT+CR');

INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'C3', 'RCT+FCK', 4, 2
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'C3' AND name = 'RCT+FCK');

-- C4の治療
INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'C4', 'RCT+Post+FCK', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'C4' AND name = 'RCT+Post+FCK');

INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'C4', 'Ext', 1, 2
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'C4' AND name = 'Ext');

-- pulの治療
INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'pul', 'RCT+CR', 3, 1
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'pul' AND name = 'RCT+CR');

INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'pul', 'Pulpotomy', 2, 2
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'pul' AND name = 'Pulpotomy');

-- perの治療
INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'per', 'RCT+CR', 4, 1
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'per' AND name = 'RCT+CR');

INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'per', 'RCT+FCK', 5, 2
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'per' AND name = 'RCT+FCK');

-- P1の治療
INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'P1', 'SRP', 2, 1
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'P1' AND name = 'SRP');

INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'P1', 'SC', 1, 2
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'P1' AND name = 'SC');

-- P2の治療
INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'P2', 'SRP+Flap', 3, 1
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'P2' AND name = 'SRP+Flap');

INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT 'P2', 'SRP', 2, 2
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = 'P2' AND name = 'SRP');

-- 欠損の治療
INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT '欠損', 'Br', 3, 1
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = '欠損' AND name = 'Br');

INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT '欠損', 'Imp', 4, 2
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = '欠損' AND name = 'Imp');

INSERT INTO treatment_templates (condition_code, name, duration, sort_order)
SELECT '欠損', 'PD', 2, 3
WHERE NOT EXISTS (SELECT 1 FROM treatment_templates WHERE condition_code = '欠損' AND name = 'PD');

-- ========================================
-- Step Templates (ステップマスター)
-- ========================================
-- Note: Step templates are automatically generated based on treatment templates
-- For simplicity, we'll add some common steps here

-- C2 In (2 steps)
DO $$
DECLARE
  v_template_id UUID;
BEGIN
  SELECT id INTO v_template_id FROM treatment_templates WHERE condition_code = 'C2' AND name = 'In';
  IF v_template_id IS NOT NULL THEN
    INSERT INTO step_templates (treatment_template_id, step_number, name, step_id)
    VALUES
      (v_template_id, 1, 'KP', 'step01'),
      (v_template_id, 2, 'In', 'step02')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- C3 RCT+CR (3 steps)
DO $$
DECLARE
  v_template_id UUID;
BEGIN
  SELECT id INTO v_template_id FROM treatment_templates WHERE condition_code = 'C3' AND name = 'RCT+CR';
  IF v_template_id IS NOT NULL THEN
    INSERT INTO step_templates (treatment_template_id, step_number, name, step_id)
    VALUES
      (v_template_id, 1, 'P抜', 'step03'),
      (v_template_id, 2, '根充', 'step04'),
      (v_template_id, 3, 'CR', 'step01')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- C3 RCT+FCK (4 steps)
DO $$
DECLARE
  v_template_id UUID;
BEGIN
  SELECT id INTO v_template_id FROM treatment_templates WHERE condition_code = 'C3' AND name = 'RCT+FCK';
  IF v_template_id IS NOT NULL THEN
    INSERT INTO step_templates (treatment_template_id, step_number, name, step_id)
    VALUES
      (v_template_id, 1, 'P抜', 'step03'),
      (v_template_id, 2, '根充', 'step04'),
      (v_template_id, 3, '印象', 'step05'),
      (v_template_id, 4, 'セット', 'step06')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ========================================
-- Exclusive Rules (排他ルール)
-- ========================================
-- C1, C2, C3, C4は相互排他
INSERT INTO exclusive_rules (rule_group, condition_code) VALUES
  (1, 'C1'),
  (1, 'C2'),
  (1, 'C3'),
  (1, 'C4')
ON CONFLICT DO NOTHING;

-- P1とP2は相互排他
INSERT INTO exclusive_rules (rule_group, condition_code) VALUES
  (2, 'P1'),
  (2, 'P2')
ON CONFLICT DO NOTHING;
