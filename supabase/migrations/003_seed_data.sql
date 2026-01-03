-- =====================================================
-- Seed Data for DENTALFLOW
-- =====================================================

-- =====================================================
-- 病名マスタデータ
-- =====================================================

INSERT INTO conditions (code, name, symbol, color, is_default) VALUES
('C1', 'C1（初期う蝕）', 'C1', 'bg-yellow-100 border-yellow-400 text-yellow-800', true),
('C2', 'C2（中等度う蝕）', 'C2', 'bg-orange-100 border-orange-400 text-orange-800', true),
('C3', 'C3（深在性う蝕）', 'C3', 'bg-red-100 border-red-400 text-red-800', true),
('C4', 'C4（残根）', 'C4', 'bg-red-200 border-red-600 text-red-900', true),
('pul', 'pul（歯髄炎）', 'pul', 'bg-pink-100 border-pink-400 text-pink-800', true),
('per', 'per（根尖性歯周炎）', 'per', 'bg-rose-100 border-rose-400 text-rose-800', true),
('P1', 'P1（軽度歯周病）', 'P1', 'bg-purple-100 border-purple-400 text-purple-800', true),
('P2', 'P2（中等度歯周病）', 'P2', 'bg-purple-100 border-purple-600 text-purple-900', true),
('欠損', '欠損歯', '×', 'bg-gray-200 border-gray-500 text-gray-800', true)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- ステップマスタデータ
-- =====================================================

INSERT INTO steps (code, name, description) VALUES
('step00', '', '削除されたステップの代わりに表示される空のステップ'),
('step001', 'フッ素塗布', ''),
('step002', 'レジン充填', ''),
('step003', '印象採得', ''),
('step004', 'セット', ''),
('step005', '抜髄', ''),
('step006', '根管拡大・洗浄', ''),
('step007', '根管充填', ''),
('step008', '仮封', ''),
('step009', '支台築造', ''),
('step010', '根管開放', ''),
('step011', '根管拡大・洗浄①', ''),
('step012', '根管拡大・洗浄②', ''),
('step013', 'スケーリング', ''),
('step014', 'SRP右側', ''),
('step015', 'SRP左側', ''),
('step016', '再評価', '')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- ステップ→病名マッピング
-- =====================================================

INSERT INTO step_condition_mappings (step_id, condition_id)
SELECT s.id, c.id FROM steps s, conditions c WHERE
(s.code = 'step001' AND c.code = 'C1') OR
(s.code = 'step002' AND c.code = 'C2') OR
(s.code = 'step003' AND c.code IN ('C2', 'C3', 'pul', 'per')) OR
(s.code = 'step004' AND c.code IN ('C2', 'C3', 'pul', 'per')) OR
(s.code = 'step005' AND c.code IN ('C3', 'pul')) OR
(s.code = 'step006' AND c.code IN ('C3', 'pul')) OR
(s.code = 'step007' AND c.code IN ('C3', 'pul', 'per')) OR
(s.code = 'step008' AND c.code IN ('C3', 'pul')) OR
(s.code = 'step009' AND c.code IN ('C3', 'pul', 'per')) OR
(s.code = 'step010' AND c.code = 'per') OR
(s.code = 'step011' AND c.code = 'per') OR
(s.code = 'step012' AND c.code = 'per') OR
(s.code = 'step013' AND c.code = 'P1') OR
(s.code = 'step014' AND c.code = 'P2') OR
(s.code = 'step015' AND c.code = 'P2') OR
(s.code = 'step016' AND c.code = 'P2')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 治療ルール
-- =====================================================

-- C1: フッ素塗布
INSERT INTO treatment_rules (condition_id, name, duration, priority)
SELECT id, 'フッ素塗布', 1, 0 FROM conditions WHERE code = 'C1'
ON CONFLICT (condition_id, name) DO NOTHING;

-- C2: レジン充填、インレー
INSERT INTO treatment_rules (condition_id, name, duration, priority)
SELECT id, 'レジン充填', 1, 0 FROM conditions WHERE code = 'C2'
ON CONFLICT (condition_id, name) DO NOTHING;

INSERT INTO treatment_rules (condition_id, name, duration, priority)
SELECT id, 'インレー', 2, 1 FROM conditions WHERE code = 'C2'
ON CONFLICT (condition_id, name) DO NOTHING;

-- C3: 複数の治療法
INSERT INTO treatment_rules (condition_id, name, duration, priority)
SELECT id, '抜髄→根治→クラウン', 7, 0 FROM conditions WHERE code = 'C3'
ON CONFLICT (condition_id, name) DO NOTHING;

INSERT INTO treatment_rules (condition_id, name, duration, priority)
SELECT id, '抜髄→根治', 4, 1 FROM conditions WHERE code = 'C3'
ON CONFLICT (condition_id, name) DO NOTHING;

INSERT INTO treatment_rules (condition_id, name, duration, priority)
SELECT id, 'クラウンのみ', 3, 2 FROM conditions WHERE code = 'C3'
ON CONFLICT (condition_id, name) DO NOTHING;

-- pul: 抜髄関連
INSERT INTO treatment_rules (condition_id, name, duration, priority)
SELECT id, '抜髄→根治→クラウン', 7, 0 FROM conditions WHERE code = 'pul'
ON CONFLICT (condition_id, name) DO NOTHING;

INSERT INTO treatment_rules (condition_id, name, duration, priority)
SELECT id, '抜髄→根治', 4, 1 FROM conditions WHERE code = 'pul'
ON CONFLICT (condition_id, name) DO NOTHING;

-- per: 感染根管治療
INSERT INTO treatment_rules (condition_id, name, duration, priority)
SELECT id, '感染根管治療→クラウン', 7, 0 FROM conditions WHERE code = 'per'
ON CONFLICT (condition_id, name) DO NOTHING;

INSERT INTO treatment_rules (condition_id, name, duration, priority)
SELECT id, '感染根管治療のみ', 4, 1 FROM conditions WHERE code = 'per'
ON CONFLICT (condition_id, name) DO NOTHING;

-- P1: スケーリング
INSERT INTO treatment_rules (condition_id, name, duration, priority)
SELECT id, 'スケーリング', 1, 0 FROM conditions WHERE code = 'P1'
ON CONFLICT (condition_id, name) DO NOTHING;

-- P2: SRP
INSERT INTO treatment_rules (condition_id, name, duration, priority)
SELECT id, 'SRP→再評価', 3, 0 FROM conditions WHERE code = 'P2'
ON CONFLICT (condition_id, name) DO NOTHING;

INSERT INTO treatment_rules (condition_id, name, duration, priority)
SELECT id, 'SRPのみ', 2, 1 FROM conditions WHERE code = 'P2'
ON CONFLICT (condition_id, name) DO NOTHING;

-- =====================================================
-- 治療ルール→ステップ紐付け
-- =====================================================

-- C1: フッ素塗布 → step001
INSERT INTO treatment_rule_steps (treatment_rule_id, step_id, step_order)
SELECT tr.id, s.id, 1
FROM treatment_rules tr
JOIN conditions c ON c.id = tr.condition_id
JOIN steps s ON s.code = 'step001'
WHERE c.code = 'C1' AND tr.name = 'フッ素塗布'
ON CONFLICT (treatment_rule_id, step_order) DO NOTHING;

-- C2: レジン充填 → step002
INSERT INTO treatment_rule_steps (treatment_rule_id, step_id, step_order)
SELECT tr.id, s.id, 1
FROM treatment_rules tr
JOIN conditions c ON c.id = tr.condition_id
JOIN steps s ON s.code = 'step002'
WHERE c.code = 'C2' AND tr.name = 'レジン充填'
ON CONFLICT (treatment_rule_id, step_order) DO NOTHING;

-- C2: インレー → step003, step004
INSERT INTO treatment_rule_steps (treatment_rule_id, step_id, step_order)
SELECT tr.id, s.id, 1
FROM treatment_rules tr
JOIN conditions c ON c.id = tr.condition_id
JOIN steps s ON s.code = 'step003'
WHERE c.code = 'C2' AND tr.name = 'インレー'
ON CONFLICT (treatment_rule_id, step_order) DO NOTHING;

INSERT INTO treatment_rule_steps (treatment_rule_id, step_id, step_order)
SELECT tr.id, s.id, 2
FROM treatment_rules tr
JOIN conditions c ON c.id = tr.condition_id
JOIN steps s ON s.code = 'step004'
WHERE c.code = 'C2' AND tr.name = 'インレー'
ON CONFLICT (treatment_rule_id, step_order) DO NOTHING;

-- C3: 抜髄→根治→クラウン
INSERT INTO treatment_rule_steps (treatment_rule_id, step_id, step_order)
SELECT tr.id, s.id, step_order
FROM treatment_rules tr
JOIN conditions c ON c.id = tr.condition_id
CROSS JOIN LATERAL (VALUES
  (1, 'step005'),
  (2, 'step006'),
  (3, 'step007'),
  (4, 'step008'),
  (5, 'step009'),
  (6, 'step003'),
  (7, 'step004')
) AS steps_seq(step_order, code)
JOIN steps s ON s.code = steps_seq.code
WHERE c.code = 'C3' AND tr.name = '抜髄→根治→クラウン'
ON CONFLICT (treatment_rule_id, step_order) DO NOTHING;

-- C3: 抜髄→根治
INSERT INTO treatment_rule_steps (treatment_rule_id, step_id, step_order)
SELECT tr.id, s.id, step_order
FROM treatment_rules tr
JOIN conditions c ON c.id = tr.condition_id
CROSS JOIN LATERAL (VALUES
  (1, 'step005'),
  (2, 'step006'),
  (3, 'step007'),
  (4, 'step008')
) AS steps_seq(step_order, code)
JOIN steps s ON s.code = steps_seq.code
WHERE c.code = 'C3' AND tr.name = '抜髄→根治'
ON CONFLICT (treatment_rule_id, step_order) DO NOTHING;

-- C3: クラウンのみ
INSERT INTO treatment_rule_steps (treatment_rule_id, step_id, step_order)
SELECT tr.id, s.id, step_order
FROM treatment_rules tr
JOIN conditions c ON c.id = tr.condition_id
CROSS JOIN LATERAL (VALUES
  (1, 'step009'),
  (2, 'step003'),
  (3, 'step004')
) AS steps_seq(step_order, code)
JOIN steps s ON s.code = steps_seq.code
WHERE c.code = 'C3' AND tr.name = 'クラウンのみ'
ON CONFLICT (treatment_rule_id, step_order) DO NOTHING;

-- pul: 抜髄→根治→クラウン
INSERT INTO treatment_rule_steps (treatment_rule_id, step_id, step_order)
SELECT tr.id, s.id, step_order
FROM treatment_rules tr
JOIN conditions c ON c.id = tr.condition_id
CROSS JOIN LATERAL (VALUES
  (1, 'step005'),
  (2, 'step006'),
  (3, 'step007'),
  (4, 'step008'),
  (5, 'step009'),
  (6, 'step003'),
  (7, 'step004')
) AS steps_seq(step_order, code)
JOIN steps s ON s.code = steps_seq.code
WHERE c.code = 'pul' AND tr.name = '抜髄→根治→クラウン'
ON CONFLICT (treatment_rule_id, step_order) DO NOTHING;

-- pul: 抜髄→根治
INSERT INTO treatment_rule_steps (treatment_rule_id, step_id, step_order)
SELECT tr.id, s.id, step_order
FROM treatment_rules tr
JOIN conditions c ON c.id = tr.condition_id
CROSS JOIN LATERAL (VALUES
  (1, 'step005'),
  (2, 'step006'),
  (3, 'step007'),
  (4, 'step008')
) AS steps_seq(step_order, code)
JOIN steps s ON s.code = steps_seq.code
WHERE c.code = 'pul' AND tr.name = '抜髄→根治'
ON CONFLICT (treatment_rule_id, step_order) DO NOTHING;

-- per: 感染根管治療→クラウン
INSERT INTO treatment_rule_steps (treatment_rule_id, step_id, step_order)
SELECT tr.id, s.id, step_order
FROM treatment_rules tr
JOIN conditions c ON c.id = tr.condition_id
CROSS JOIN LATERAL (VALUES
  (1, 'step010'),
  (2, 'step011'),
  (3, 'step012'),
  (4, 'step007'),
  (5, 'step009'),
  (6, 'step003'),
  (7, 'step004')
) AS steps_seq(step_order, code)
JOIN steps s ON s.code = steps_seq.code
WHERE c.code = 'per' AND tr.name = '感染根管治療→クラウン'
ON CONFLICT (treatment_rule_id, step_order) DO NOTHING;

-- per: 感染根管治療のみ
INSERT INTO treatment_rule_steps (treatment_rule_id, step_id, step_order)
SELECT tr.id, s.id, step_order
FROM treatment_rules tr
JOIN conditions c ON c.id = tr.condition_id
CROSS JOIN LATERAL (VALUES
  (1, 'step010'),
  (2, 'step011'),
  (3, 'step012'),
  (4, 'step007')
) AS steps_seq(step_order, code)
JOIN steps s ON s.code = steps_seq.code
WHERE c.code = 'per' AND tr.name = '感染根管治療のみ'
ON CONFLICT (treatment_rule_id, step_order) DO NOTHING;

-- P1: スケーリング
INSERT INTO treatment_rule_steps (treatment_rule_id, step_id, step_order)
SELECT tr.id, s.id, 1
FROM treatment_rules tr
JOIN conditions c ON c.id = tr.condition_id
JOIN steps s ON s.code = 'step013'
WHERE c.code = 'P1' AND tr.name = 'スケーリング'
ON CONFLICT (treatment_rule_id, step_order) DO NOTHING;

-- P2: SRP→再評価
INSERT INTO treatment_rule_steps (treatment_rule_id, step_id, step_order)
SELECT tr.id, s.id, step_order
FROM treatment_rules tr
JOIN conditions c ON c.id = tr.condition_id
CROSS JOIN LATERAL (VALUES
  (1, 'step014'),
  (2, 'step015'),
  (3, 'step016')
) AS steps_seq(step_order, code)
JOIN steps s ON s.code = steps_seq.code
WHERE c.code = 'P2' AND tr.name = 'SRP→再評価'
ON CONFLICT (treatment_rule_id, step_order) DO NOTHING;

-- P2: SRPのみ
INSERT INTO treatment_rule_steps (treatment_rule_id, step_id, step_order)
SELECT tr.id, s.id, step_order
FROM treatment_rules tr
JOIN conditions c ON c.id = tr.condition_id
CROSS JOIN LATERAL (VALUES
  (1, 'step014'),
  (2, 'step015')
) AS steps_seq(step_order, code)
JOIN steps s ON s.code = steps_seq.code
WHERE c.code = 'P2' AND tr.name = 'SRPのみ'
ON CONFLICT (treatment_rule_id, step_order) DO NOTHING;

-- =====================================================
-- グローバル排他ルール
-- =====================================================

INSERT INTO exclusive_rules (rule_groups) VALUES
('[[["C1"], ["C2"], ["C3"], ["C4"]], [["P1"], ["P2"]]]'::jsonb)
ON CONFLICT DO NOTHING;

-- =====================================================
-- グローバルスケジューリングルール
-- =====================================================

INSERT INTO scheduling_rules (
  patient_id,
  priority_order,
  max_treatments_per_day,
  acute_care_conditions,
  acute_care_max_per_day,
  schedule_interval_days
) VALUES (
  NULL,
  ARRAY['per', 'pul', 'C4', 'C3', 'C2', 'P2', 'P1', 'C1'],
  3,
  ARRAY['per', 'pul', 'C4'],
  1,
  7
)
ON CONFLICT (patient_id) DO NOTHING;
