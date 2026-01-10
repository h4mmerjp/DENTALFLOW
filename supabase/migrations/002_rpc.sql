-- ========================================
-- DentalFlow RPC Functions
-- ========================================
-- Version: 1.0
-- Purpose: Server-side logic for complex operations

-- ========================================
-- RPC: Diverge Treatment Plan
-- ========================================
-- 治療計画を分岐させる（病名変更時の複雑なロジック）
CREATE OR REPLACE FUNCTION diverge_treatment_plan(
  p_node_id UUID,
  p_new_condition TEXT,
  p_patient_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_source_node RECORD;
  v_new_group_id UUID;
  v_affected_teeth TEXT[];
  v_old_condition TEXT;
  v_transition_condition TEXT;
  v_deleted_count INT := 0;
  v_completed_count INT := 0;
BEGIN
  -- 1. ソースノード取得
  SELECT * INTO v_source_node
  FROM treatment_nodes
  WHERE id = p_node_id AND patient_id = p_patient_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'ノードが見つかりません。'
    );
  END IF;

  -- 2. 変数設定
  v_new_group_id := uuid_generate_v4();
  v_affected_teeth := v_source_node.teeth;
  v_old_condition := v_source_node.condition_code;

  -- 病名変遷表示を生成
  v_transition_condition := v_old_condition || '→' || p_new_condition;

  -- 3. 前のステップ（完了していないもの）を完了済みに
  UPDATE treatment_nodes
  SET completed = true, updated_at = now()
  WHERE group_id = v_source_node.group_id
    AND card_number < v_source_node.card_number
    AND completed = false
    AND patient_id = p_patient_id;

  GET DIAGNOSTICS v_completed_count = ROW_COUNT;

  -- 4. 対象以降のノード（完了していないもの）を削除
  DELETE FROM treatment_nodes
  WHERE group_id = v_source_node.group_id
    AND card_number >= v_source_node.card_number
    AND completed = false
    AND patient_id = p_patient_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- 5. tooth_conditionsを更新
  -- まず古い病名を削除
  DELETE FROM tooth_conditions
  WHERE patient_id = p_patient_id
    AND tooth_number = ANY(v_affected_teeth)
    AND condition_code = CASE
      WHEN position('→' IN v_old_condition) > 0 THEN
        split_part(v_old_condition, '→', array_length(string_to_array(v_old_condition, '→'), 1))
      ELSE
        v_old_condition
    END;

  -- 新しい病名を追加
  INSERT INTO tooth_conditions (patient_id, tooth_number, condition_code)
  SELECT p_patient_id, unnest(v_affected_teeth), p_new_condition
  ON CONFLICT (patient_id, tooth_number, condition_code) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'new_group_id', v_new_group_id,
    'old_condition', v_old_condition,
    'new_condition', p_new_condition,
    'transition_condition', v_transition_condition,
    'affected_teeth', v_affected_teeth,
    'deleted_nodes', v_deleted_count,
    'completed_nodes', v_completed_count,
    'message', format('病名を %s から %s へ変更しました。', v_old_condition, p_new_condition)
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION diverge_treatment_plan IS '治療計画分岐: 特定ステップから新病名に切り替え';

-- ========================================
-- RPC: Auto Schedule Treatments
-- ========================================
-- 治療の自動スケジューリング
CREATE OR REPLACE FUNCTION auto_schedule_treatments(
  p_patient_id UUID,
  p_from_date DATE DEFAULT NULL,
  p_max_per_day INT DEFAULT 3,
  p_interval_days INT DEFAULT 7,
  p_priority_order TEXT[] DEFAULT ARRAY['per','pul','C4','C3','P2','C2','P1','C1'],
  p_acute_conditions TEXT[] DEFAULT ARRAY['per','pul','C4'],
  p_acute_max_per_day INT DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
  v_node RECORD;
  v_current_date DATE;
  v_day_count INT;
  v_acute_count INT;
  v_assigned INT := 0;
  v_prev_card_date DATE;
  v_schedule_exists BOOLEAN;
BEGIN
  -- 開始日の設定
  v_current_date := COALESCE(p_from_date, CURRENT_DATE);

  -- 配置待ちノードをループ
  FOR v_node IN
    SELECT tn.*,
           array_position(p_priority_order, tn.condition_code) as priority
    FROM treatment_nodes tn
    WHERE tn.patient_id = p_patient_id
      AND tn.completed = false
      AND NOT EXISTS (
        SELECT 1 FROM treatment_schedule ts
        WHERE ts.node_id = tn.id AND ts.patient_id = p_patient_id
      )
    ORDER BY
      COALESCE(array_position(p_priority_order, tn.condition_code), 999),
      tn.group_id,
      tn.card_number
  LOOP
    -- 連続治療の順序チェック
    IF v_node.is_sequential AND v_node.card_number > 1 THEN
      -- 前のカードの日付を取得
      SELECT ts.scheduled_date INTO v_prev_card_date
      FROM treatment_schedule ts
      JOIN treatment_nodes tn ON ts.node_id = tn.id
      WHERE tn.group_id = v_node.group_id
        AND tn.card_number = v_node.card_number - 1
        AND ts.patient_id = p_patient_id;

      -- 前のカードがまだスケジュールされていない場合はスキップ
      IF v_prev_card_date IS NULL THEN
        CONTINUE;
      END IF;

      -- 前のカードより後の日付にする
      IF v_current_date <= v_prev_card_date THEN
        v_current_date := v_prev_card_date + p_interval_days;
      END IF;
    END IF;

    -- 現在の日に配置可能かチェック
    LOOP
      -- この日の配置数をカウント
      SELECT COUNT(*) INTO v_day_count
      FROM treatment_schedule
      WHERE patient_id = p_patient_id
        AND scheduled_date = v_current_date;

      -- 急性症状のカウント
      SELECT COUNT(*) INTO v_acute_count
      FROM treatment_schedule ts
      JOIN treatment_nodes tn ON ts.node_id = tn.id
      WHERE ts.patient_id = p_patient_id
        AND ts.scheduled_date = v_current_date
        AND tn.condition_code = ANY(p_acute_conditions);

      -- 配置可能かチェック
      IF v_day_count < p_max_per_day THEN
        -- 急性症状の場合は追加チェック
        IF v_node.condition_code = ANY(p_acute_conditions) THEN
          IF v_acute_count < p_acute_max_per_day THEN
            EXIT; -- 配置可能
          END IF;
        ELSE
          EXIT; -- 配置可能
        END IF;
      END IF;

      -- 次の日へ
      v_current_date := v_current_date + p_interval_days;
    END LOOP;

    -- スケジュールに追加
    INSERT INTO treatment_schedule (patient_id, scheduled_date, node_id, sort_order)
    VALUES (p_patient_id, v_current_date, v_node.id, v_day_count + 1);

    v_assigned := v_assigned + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'assigned', v_assigned,
    'message', format('%s件の治療を自動配置しました。', v_assigned)
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_schedule_treatments IS '治療の自動スケジューリング: 優先度・制約を考慮して日程配置';

-- ========================================
-- RPC: Clear Schedule
-- ========================================
-- スケジュールをクリア（枠は残す）
CREATE OR REPLACE FUNCTION clear_schedule(
  p_patient_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM treatment_schedule
  WHERE patient_id = p_patient_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', v_deleted,
    'message', format('%s件のスケジュールをクリアしました。', v_deleted)
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION clear_schedule IS 'スケジュールのクリア';

-- ========================================
-- RPC: Get Patient Summary
-- ========================================
-- 患者の治療状況サマリー
CREATE OR REPLACE FUNCTION get_patient_summary(
  p_patient_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_total_nodes INT;
  v_completed_nodes INT;
  v_scheduled_nodes INT;
  v_unscheduled_nodes INT;
  v_total_teeth INT;
  v_affected_teeth INT;
BEGIN
  SELECT COUNT(*) INTO v_total_nodes
  FROM treatment_nodes
  WHERE patient_id = p_patient_id;

  SELECT COUNT(*) INTO v_completed_nodes
  FROM treatment_nodes
  WHERE patient_id = p_patient_id AND completed = true;

  SELECT COUNT(DISTINCT node_id) INTO v_scheduled_nodes
  FROM treatment_schedule
  WHERE patient_id = p_patient_id;

  v_unscheduled_nodes := v_total_nodes - v_scheduled_nodes - v_completed_nodes;

  SELECT COUNT(DISTINCT tooth_number) INTO v_total_teeth
  FROM tooth_conditions
  WHERE patient_id = p_patient_id;

  SELECT COUNT(DISTINCT unnest(teeth)) INTO v_affected_teeth
  FROM treatment_nodes
  WHERE patient_id = p_patient_id;

  RETURN jsonb_build_object(
    'total_nodes', v_total_nodes,
    'completed_nodes', v_completed_nodes,
    'scheduled_nodes', v_scheduled_nodes,
    'unscheduled_nodes', v_unscheduled_nodes,
    'total_teeth', v_total_teeth,
    'affected_teeth', v_affected_teeth,
    'completion_rate', CASE
      WHEN v_total_nodes > 0 THEN ROUND((v_completed_nodes::NUMERIC / v_total_nodes) * 100, 1)
      ELSE 0
    END
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_patient_summary IS '患者の治療状況サマリー取得';
