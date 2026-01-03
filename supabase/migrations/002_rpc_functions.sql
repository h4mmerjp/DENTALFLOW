-- =====================================================
-- RPC Functions for DENTALFLOW
-- =====================================================

-- =====================================================
-- 1. 治療ノード生成
-- =====================================================

CREATE OR REPLACE FUNCTION generate_treatment_nodes(
  p_patient_id UUID,
  p_grouping_mode TEXT DEFAULT 'individual'
)
RETURNS TABLE (
  group_id UUID,
  nodes_created INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_condition_record RECORD;
  v_teeth TEXT[];
  v_treatment_rule RECORD;
  v_new_group_id UUID;
  v_step_record RECORD;
  v_card_number INT;
  v_priority_order TEXT[];
BEGIN
  -- 既存の未完了・未スケジュールノードを削除
  DELETE FROM treatment_nodes
  WHERE group_id IN (
    SELECT id FROM treatment_groups WHERE patient_id = p_patient_id
  )
  AND completed = false
  AND scheduled_date IS NULL;

  -- スケジューリングルールから優先順位を取得
  SELECT priority_order INTO v_priority_order
  FROM scheduling_rules
  WHERE patient_id = p_patient_id OR patient_id IS NULL
  ORDER BY patient_id NULLS LAST
  LIMIT 1;

  IF v_priority_order IS NULL THEN
    v_priority_order := ARRAY['per', 'pul', 'C4', 'C3', 'C2', 'P2', 'P1', 'C1'];
  END IF;

  -- 各病名を処理
  FOR v_condition_record IN
    SELECT DISTINCT c.id, c.code
    FROM tooth_conditions tc
    JOIN conditions c ON c.id = tc.condition_id
    WHERE tc.patient_id = p_patient_id
    ORDER BY array_position(v_priority_order, c.code), c.code
  LOOP
    -- この病名に該当する歯を取得
    SELECT array_agg(tc.tooth_number ORDER BY tc.tooth_number)
    INTO v_teeth
    FROM tooth_conditions tc
    WHERE tc.patient_id = p_patient_id
      AND tc.condition_id = v_condition_record.id;

    IF v_teeth IS NOT NULL AND array_length(v_teeth, 1) > 0 THEN
      -- デフォルトの治療ルールを取得
      SELECT * INTO v_treatment_rule
      FROM treatment_rules
      WHERE condition_id = v_condition_record.id
      ORDER BY priority
      LIMIT 1;

      IF v_treatment_rule IS NOT NULL THEN
        IF p_grouping_mode = 'individual' THEN
          -- 個別モード
          FOR i IN 1..array_length(v_teeth, 1) LOOP
            v_new_group_id := gen_random_uuid();

            INSERT INTO treatment_groups (id, patient_id, treatment_rule_id)
            VALUES (v_new_group_id, p_patient_id, v_treatment_rule.id);

            INSERT INTO treatment_group_teeth (group_id, tooth_condition_id)
            SELECT v_new_group_id, tc.id
            FROM tooth_conditions tc
            WHERE tc.patient_id = p_patient_id
              AND tc.tooth_number = v_teeth[i]
              AND tc.condition_id = v_condition_record.id;

            v_card_number := 1;
            FOR v_step_record IN
              SELECT s.id
              FROM treatment_rule_steps trs
              JOIN steps s ON s.id = trs.step_id
              WHERE trs.treatment_rule_id = v_treatment_rule.id
              ORDER BY trs.step_order
            LOOP
              INSERT INTO treatment_nodes (group_id, step_id, card_number)
              VALUES (v_new_group_id, v_step_record.id, v_card_number);
              v_card_number := v_card_number + 1;
            END LOOP;

            group_id := v_new_group_id;
            nodes_created := v_treatment_rule.duration;
            RETURN NEXT;
          END LOOP;
        ELSE
          -- グループモード
          v_new_group_id := gen_random_uuid();

          INSERT INTO treatment_groups (id, patient_id, treatment_rule_id)
          VALUES (v_new_group_id, p_patient_id, v_treatment_rule.id);

          INSERT INTO treatment_group_teeth (group_id, tooth_condition_id)
          SELECT v_new_group_id, tc.id
          FROM tooth_conditions tc
          WHERE tc.patient_id = p_patient_id
            AND tc.condition_id = v_condition_record.id;

          v_card_number := 1;
          FOR v_step_record IN
            SELECT s.id
            FROM treatment_rule_steps trs
            JOIN steps s ON s.id = trs.step_id
            WHERE trs.treatment_rule_id = v_treatment_rule.id
            ORDER BY trs.step_order
          LOOP
            INSERT INTO treatment_nodes (group_id, step_id, card_number)
            VALUES (v_new_group_id, v_step_record.id, v_card_number);
            v_card_number := v_card_number + 1;
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

-- =====================================================
-- 2. 自動スケジューリング
-- =====================================================

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
  v_rules RECORD;
  v_node RECORD;
  v_current_date DATE;
  v_treatments_on_date INT;
  v_acute_on_date INT;
  v_is_acute BOOLEAN;
  v_prev_card_date DATE;
  v_assigned INT := 0;
  v_start_date DATE;
BEGIN
  SELECT * INTO v_rules
  FROM scheduling_rules
  WHERE patient_id = p_patient_id OR patient_id IS NULL
  ORDER BY patient_id NULLS LAST
  LIMIT 1;

  IF v_rules IS NULL THEN
    v_rules := ROW(
      NULL, p_patient_id,
      ARRAY['per', 'pul', 'C4', 'C3', 'C2', 'P2', 'P1', 'C1'],
      3, ARRAY['per', 'pul', 'C4'], 1, 7, now()
    );
  END IF;

  v_start_date := COALESCE(p_from_date, CURRENT_DATE);
  v_current_date := v_start_date;

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

    LOOP
      SELECT COUNT(*) INTO v_treatments_on_date
      FROM treatment_nodes tn
      JOIN treatment_groups tg ON tg.id = tn.group_id
      WHERE tg.patient_id = p_patient_id
        AND tn.scheduled_date = v_current_date;

      SELECT COUNT(*) INTO v_acute_on_date
      FROM treatment_nodes tn
      JOIN treatment_groups tg ON tg.id = tn.group_id
      JOIN treatment_rules tr ON tr.id = tg.treatment_rule_id
      JOIN conditions c ON c.id = tr.condition_id
      WHERE tg.patient_id = p_patient_id
        AND tn.scheduled_date = v_current_date
        AND c.code = ANY(v_rules.acute_care_conditions);

      IF v_treatments_on_date < v_rules.max_treatments_per_day
         AND (NOT v_is_acute OR v_acute_on_date < v_rules.acute_care_max_per_day)
      THEN
        IF v_node.card_number > 1 THEN
          SELECT tn.scheduled_date INTO v_prev_card_date
          FROM treatment_nodes tn
          WHERE tn.group_id = v_node.group_id
            AND tn.card_number = v_node.card_number - 1;

          IF v_prev_card_date IS NULL OR v_prev_card_date >= v_current_date THEN
            v_current_date := v_current_date + (v_rules.schedule_interval_days || ' days')::INTERVAL;
            CONTINUE;
          END IF;
        END IF;

        UPDATE treatment_nodes
        SET scheduled_date = v_current_date,
            sort_order = v_treatments_on_date + 1
        WHERE id = v_node.id;

        v_assigned := v_assigned + 1;
        EXIT;
      END IF;

      v_current_date := v_current_date + (v_rules.schedule_interval_days || ' days')::INTERVAL;

      IF v_current_date > v_start_date + INTERVAL '1 year' THEN
        EXIT;
      END IF;
    END LOOP;

    v_current_date := v_start_date;
  END LOOP;

  success := true;
  total_assigned := v_assigned;
  message := format('%s件の治療を自動配置しました。', v_assigned);
  RETURN NEXT;
END;
$$;

-- =====================================================
-- 3. 歯の分離
-- =====================================================

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
  v_source_node RECORD;
  v_source_group RECORD;
  v_new_group_id UUID;
  v_remaining_teeth INT;
  v_tooth_condition_ids UUID[];
BEGIN
  SELECT * INTO v_source_node FROM treatment_nodes WHERE id = p_node_id;
  IF v_source_node IS NULL THEN
    success := false;
    message := 'ノードが見つかりません。';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_source_group FROM treatment_groups WHERE id = v_source_node.group_id;

  SELECT array_agg(tgt.tooth_condition_id) INTO v_tooth_condition_ids
  FROM treatment_group_teeth tgt
  JOIN tooth_conditions tc ON tc.id = tgt.tooth_condition_id
  WHERE tgt.group_id = v_source_node.group_id
    AND tc.tooth_number = ANY(p_teeth_to_split);

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

  v_new_group_id := gen_random_uuid();
  INSERT INTO treatment_groups (id, patient_id, treatment_rule_id)
  VALUES (v_new_group_id, v_source_group.patient_id, v_source_group.treatment_rule_id);

  UPDATE treatment_group_teeth
  SET group_id = v_new_group_id
  WHERE tooth_condition_id = ANY(v_tooth_condition_ids)
    AND group_id = v_source_node.group_id;

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

-- =====================================================
-- 4. ノード合体
-- =====================================================

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
  v_source_group RECORD;
  v_target_group RECORD;
  v_source_teeth TEXT[];
  v_target_teeth TEXT[];
  v_duplicate_teeth TEXT[];
BEGIN
  SELECT * INTO v_source_group FROM treatment_groups WHERE id = p_source_group_id;
  SELECT * INTO v_target_group FROM treatment_groups WHERE id = p_target_group_id;

  IF v_source_group IS NULL OR v_target_group IS NULL THEN
    success := false;
    message := 'グループが見つかりません。';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_source_group.treatment_rule_id != v_target_group.treatment_rule_id THEN
    success := false;
    message := '同じ治療法のノードにのみ合体できます。';
    RETURN NEXT;
    RETURN;
  END IF;

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

  UPDATE treatment_group_teeth
  SET group_id = p_target_group_id
  WHERE group_id = p_source_group_id;

  DELETE FROM treatment_nodes WHERE group_id = p_source_group_id;
  DELETE FROM treatment_groups WHERE id = p_source_group_id;

  success := true;
  message := format('ノードを合体しました（歯式: %s）', array_to_string(v_source_teeth, ', '));
  RETURN NEXT;
END;
$$;

-- =====================================================
-- 5. 排他ルールチェック
-- =====================================================

CREATE OR REPLACE FUNCTION check_exclusive_rules(
  p_condition_code TEXT,
  p_current_conditions TEXT[]
)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule JSONB;
  v_target_group_idx INT;
  v_conflicting TEXT[] := ARRAY[]::TEXT[];
  v_code TEXT;
  i INT;
BEGIN
  FOR v_rule IN
    SELECT jsonb_array_elements(rule_groups) FROM exclusive_rules LIMIT 1
  LOOP
    v_target_group_idx := -1;

    FOR i IN 0..jsonb_array_length(v_rule) - 1 LOOP
      IF v_rule->i::TEXT ? p_condition_code THEN
        v_target_group_idx := i;
        EXIT;
      END IF;
    END LOOP;

    IF v_target_group_idx >= 0 THEN
      FOR i IN 0..jsonb_array_length(v_rule) - 1 LOOP
        IF i != v_target_group_idx THEN
          FOR v_code IN
            SELECT jsonb_array_elements(v_rule->i::TEXT)::TEXT
          LOOP
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
