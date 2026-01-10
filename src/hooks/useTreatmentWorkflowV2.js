import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useTreatmentWorkflowV2 - Supabase版治療ワークフロー管理フック
 *
 * LocalStorageからSupabaseへの移行版
 * 既存のuseTreatmentWorkflowと同じインターフェースを維持
 */
export function useTreatmentWorkflowV2(patientId = null) {
  // ========================================
  // State Management
  // ========================================
  const [currentPatientId, setCurrentPatientId] = useState(patientId);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingWorkflow, setIsGeneratingWorkflow] = useState(false);

  // Data state (既存形式互換)
  const [toothConditions, setToothConditions] = useState({});
  const [workflow, setWorkflow] = useState([]);
  const [treatmentSchedule, setTreatmentSchedule] = useState([]);
  const [selectedTreatmentOptions, setSelectedTreatmentOptions] = useState({});

  // Master Data
  const [conditions, setConditions] = useState([]);
  const [treatmentRules, setTreatmentRules] = useState({});
  const [stepMaster, setStepMaster] = useState([]);
  const [exclusiveRules, setExclusiveRules] = useState([]);

  // Settings
  const [autoScheduleEnabled, setAutoScheduleEnabled] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('患者の痛みを最優先に、急性症状から治療してください。根管治療は週1回ペース、補綴物は2週間隔で進めてください。');
  const [schedulingRules, setSchedulingRules] = useState({
    priorityOrder: ['per', 'pul', 'C4', 'C3', 'C2', 'P2', 'P1', 'C1'],
    maxTreatmentsPerDay: 3,
    acuteCareConditions: ['per', 'pul', 'C4'],
    acuteCareMaxPerDay: 1,
    scheduleIntervalDays: 7
  });

  // ========================================
  // Data Loading from Supabase
  // ========================================

  /**
   * マスターデータをSupabaseから読み込み
   */
  const loadMasterData = useCallback(async () => {
    try {
      // Conditions (病名マスター)
      const { data: conditionsData, error: conditionsError } = await supabase
        .from('conditions')
        .select('*')
        .order('sort_order');

      if (conditionsError) throw conditionsError;

      // 既存フォーマットに変換
      const formattedConditions = conditionsData?.map(c => ({
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        color: c.color,
        diseaseCode: c.disease_code,
        diseaseName: c.disease_name,
        sortOrder: c.sort_order
      })) || [];
      setConditions(formattedConditions);

      // Treatment Templates + Step Templates
      const { data: treatmentTemplates, error: treatmentError } = await supabase
        .from('treatment_templates')
        .select('*')
        .order('condition_code, sort_order');

      if (treatmentError) throw treatmentError;

      const { data: stepTemplates, error: stepError } = await supabase
        .from('step_templates')
        .select('*')
        .order('treatment_template_id, step_number');

      if (stepError) throw stepError;

      // treatmentRules形式に変換
      const rulesMap = {};
      treatmentTemplates?.forEach(template => {
        if (!rulesMap[template.condition_code]) {
          rulesMap[template.condition_code] = [];
        }

        const steps = stepTemplates
          ?.filter(s => s.treatment_template_id === template.id)
          .sort((a, b) => a.step_number - b.step_number)
          .map(s => s.name) || [];

        const stepIds = stepTemplates
          ?.filter(s => s.treatment_template_id === template.id)
          .sort((a, b) => a.step_number - b.step_number)
          .map(s => s.step_id) || [];

        rulesMap[template.condition_code].push({
          name: template.name,
          duration: template.duration,
          steps: steps.length > 0 ? steps : Array(template.duration).fill(template.name),
          stepIds: stepIds.length > 0 ? stepIds : null
        });
      });
      setTreatmentRules(rulesMap);

      // Step Master（レガシー互換用）
      const uniqueSteps = [];
      const stepIdSet = new Set();
      stepTemplates?.forEach(template => {
        if (template.step_id && !stepIdSet.has(template.step_id)) {
          stepIdSet.add(template.step_id);
          uniqueSteps.push({
            id: template.step_id,
            name: template.name,
            conditionCodes: []
          });
        }
      });
      setStepMaster(uniqueSteps);

      // Exclusive Rules
      const { data: exclusiveData, error: exclusiveError } = await supabase
        .from('exclusive_rules')
        .select('*')
        .order('rule_group');

      if (exclusiveError) throw exclusiveError;

      const groupedRules = [];
      const groups = new Set(exclusiveData?.map(r => r.rule_group) || []);
      groups.forEach(groupNum => {
        const conditions = exclusiveData
          .filter(r => r.rule_group === groupNum)
          .map(r => r.condition_code);
        groupedRules.push(conditions.map(c => [c]));
      });
      setExclusiveRules(groupedRules);

    } catch (error) {
      console.error('Error loading master data:', error);
    }
  }, []);

  /**
   * 患者データをSupabaseから読み込み
   */
  const loadPatientData = useCallback(async (patId) => {
    if (!patId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Tooth Conditions
      const { data: toothConditionsData, error: toothError } = await supabase
        .from('tooth_conditions')
        .select('tooth_number, condition_code')
        .eq('patient_id', patId);

      if (toothError) throw toothError;

      // toothConditions形式に変換: { "11": ["C1", "P1"], "12": ["C2"] }
      const toothConditionsMap = {};
      toothConditionsData?.forEach(tc => {
        if (!toothConditionsMap[tc.tooth_number]) {
          toothConditionsMap[tc.tooth_number] = [];
        }
        toothConditionsMap[tc.tooth_number].push(tc.condition_code);
      });
      setToothConditions(toothConditionsMap);

      // Treatment Nodes（未完了のみ）
      const { data: nodesData, error: nodesError } = await supabase
        .from('treatment_nodes')
        .select('*')
        .eq('patient_id', patId)
        .eq('completed', false)
        .order('created_at');

      if (nodesError) throw nodesError;

      // workflow形式に変換
      const workflowNodes = nodesData?.map(node => ({
        id: node.id,
        baseId: `${node.condition_code}-${node.treatment_name}-${node.teeth.join(',')}`,
        groupId: node.group_id,
        condition: node.condition_code,
        actualCondition: node.actual_condition_code || node.condition_code,
        treatment: node.treatment_name,
        stepName: node.step_name,
        teeth: node.teeth,
        cardNumber: node.card_number,
        totalCards: node.total_cards,
        isSequential: node.is_sequential,
        completed: node.completed,
        treatmentKey: `${node.actual_condition_code || node.condition_code}-${node.teeth.join(',')}`,
        hasMultipleTreatments: false
      })) || [];
      setWorkflow(workflowNodes);

      // Treatment Schedule
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('treatment_schedule')
        .select(`
          scheduled_date,
          sort_order,
          node_id,
          treatment_nodes (*)
        `)
        .eq('patient_id', patId)
        .order('scheduled_date, sort_order');

      if (scheduleError) throw scheduleError;

      // treatmentSchedule形式に変換
      const scheduleMap = new Map();
      scheduleData?.forEach(item => {
        const date = item.scheduled_date;
        if (!scheduleMap.has(date)) {
          scheduleMap.set(date, { date, treatments: [] });
        }

        const node = item.treatment_nodes;
        if (node) {
          scheduleMap.get(date).treatments.push({
            id: node.id,
            baseId: `${node.condition_code}-${node.treatment_name}-${node.teeth.join(',')}`,
            groupId: node.group_id,
            condition: node.condition_code,
            actualCondition: node.actual_condition_code || node.condition_code,
            treatment: node.treatment_name,
            stepName: node.step_name,
            teeth: node.teeth,
            cardNumber: node.card_number,
            totalCards: node.total_cards,
            isSequential: node.is_sequential,
            completed: node.completed
          });
        }
      });
      setTreatmentSchedule(Array.from(scheduleMap.values()));

      // User Settings
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('key, value')
        .eq('patient_id', patId);

      settingsData?.forEach(setting => {
        if (setting.key === 'autoScheduleEnabled') {
          setAutoScheduleEnabled(setting.value);
        } else if (setting.key === 'aiPrompt') {
          setAiPrompt(setting.value);
        } else if (setting.key === 'schedulingRules') {
          setSchedulingRules(setting.value);
        }
      });

    } catch (error) {
      console.error('Error loading patient data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ========================================
  // Effects
  // ========================================

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  useEffect(() => {
    if (currentPatientId) {
      loadPatientData(currentPatientId);
    }
  }, [currentPatientId, loadPatientData]);

  // ========================================
  // Core Workflow Functions (RPC)
  // ========================================

  /**
   * 自動スケジューリング実行（RPC使用）
   */
  const executeAutoScheduling = async (fromDate = null) => {
    if (!currentPatientId) {
      return { success: false, message: '患者IDが設定されていません。' };
    }

    setIsGeneratingWorkflow(true);

    try {
      const { data, error } = await supabase
        .rpc('auto_schedule_treatments', {
          p_patient_id: currentPatientId,
          p_from_date: fromDate,
          p_max_per_day: schedulingRules.maxTreatmentsPerDay,
          p_interval_days: schedulingRules.scheduleIntervalDays,
          p_priority_order: schedulingRules.priorityOrder,
          p_acute_conditions: schedulingRules.acuteCareConditions,
          p_acute_max_per_day: schedulingRules.acuteCareMaxPerDay
        });

      if (error) throw error;

      await loadPatientData(currentPatientId);

      setIsGeneratingWorkflow(false);
      return {
        success: data.success,
        totalAssigned: data.assigned,
        totalTreatments: workflow.length,
        message: data.message
      };
    } catch (error) {
      console.error('Error in auto scheduling:', error);
      setIsGeneratingWorkflow(false);
      return { success: false, message: error.message };
    }
  };

  /**
   * 治療計画分岐（RPC使用）
   */
  const divergeTreatmentPlan = async (nodeId, newCondition) => {
    if (!currentPatientId) {
      return { success: false, message: '患者IDが設定されていません。' };
    }

    try {
      const { data, error } = await supabase
        .rpc('diverge_treatment_plan', {
          p_node_id: nodeId,
          p_new_condition: newCondition,
          p_patient_id: currentPatientId
        });

      if (error) throw error;

      await loadPatientData(currentPatientId);

      return data;
    } catch (error) {
      console.error('Error diverging treatment plan:', error);
      return { success: false, message: error.message };
    }
  };

  /**
   * スケジュールクリア（RPC使用）
   */
  const clearAllSchedules = async () => {
    if (!currentPatientId) return;

    try {
      const { data, error } = await supabase
        .rpc('clear_schedule', {
          p_patient_id: currentPatientId
        });

      if (error) throw error;

      const clearedSchedule = treatmentSchedule.map(day => ({
        date: day.date,
        treatments: []
      }));
      setTreatmentSchedule(clearedSchedule);

      return data;
    } catch (error) {
      console.error('Error clearing schedules:', error);
      return { success: false, message: error.message };
    }
  };

  // ========================================
  // Utility Functions (Same as V1)
  // ========================================

  const getConditionInfo = (code) => {
    return conditions.find(c => c.code === code) || null;
  };

  const checkExclusiveRules = (conditionCode, currentConditions) => {
    const conflictingConditions = [];

    exclusiveRules.forEach(rule => {
      let targetGroupIndex = -1;
      rule.forEach((group, index) => {
        if (group.includes(conditionCode)) {
          targetGroupIndex = index;
        }
      });

      if (targetGroupIndex !== -1) {
        rule.forEach((group, index) => {
          if (index !== targetGroupIndex) {
            group.forEach(ruleCode => {
              if (currentConditions.includes(ruleCode)) {
                conflictingConditions.push(ruleCode);
              }
            });
          }
        });
      }
    });

    return conflictingConditions;
  };

  const getStepName = (stepId) => {
    const step = stepMaster.find(s => s.id === stepId);
    if (step) return step.name;
    const emptyStep = stepMaster.find(s => s.id === 'step00');
    return emptyStep ? emptyStep.name : '';
  };

  const getAvailableSteps = (conditionCode) => {
    return stepMaster.filter(step =>
      step.conditionCodes.includes(conditionCode)
    );
  };

  const changeTreatmentOption = (step, newTreatmentIndex) => {
    setSelectedTreatmentOptions(prev => ({
      ...prev,
      [step.treatmentKey]: newTreatmentIndex
    }));
  };

  const executeReschedulingFromDate = (date) => {
    executeAutoScheduling(date);
  };

  const clearAllConditions = async () => {
    if (!currentPatientId) return;

    setToothConditions({});
    setWorkflow([]);
    setTreatmentSchedule([]);

    try {
      const { error } = await supabase
        .from('tooth_conditions')
        .delete()
        .eq('patient_id', currentPatientId);

      if (error) throw error;
    } catch (error) {
      console.error('Error clearing conditions:', error);
    }
  };

  const addTreatmentDay = () => {
    const lastDate = treatmentSchedule.length > 0
      ? new Date(treatmentSchedule[treatmentSchedule.length - 1].date)
      : new Date();

    const newDate = new Date(lastDate);
    newDate.setDate(lastDate.getDate() + schedulingRules.scheduleIntervalDays);

    setTreatmentSchedule([...treatmentSchedule, {
      date: newDate.toISOString().split('T')[0],
      treatments: []
    }]);
  };

  const changeScheduleDate = (dayIndex, newDate) => {
    const updatedSchedule = [...treatmentSchedule];

    updatedSchedule[dayIndex] = {
      ...updatedSchedule[dayIndex],
      date: newDate
    };

    const baseDate = new Date(newDate);
    for (let i = dayIndex + 1; i < updatedSchedule.length; i++) {
      const intervalDays = schedulingRules.scheduleIntervalDays * (i - dayIndex);
      const nextDate = new Date(baseDate);
      nextDate.setDate(baseDate.getDate() + intervalDays);

      updatedSchedule[i] = {
        ...updatedSchedule[i],
        date: nextDate.toISOString().split('T')[0]
      };
    }

    setTreatmentSchedule(updatedSchedule);
  };

  const toggleTreatmentCompletion = async (nodeId) => {
    try {
      const { data: nodeData } = await supabase
        .from('treatment_nodes')
        .select('completed')
        .eq('id', nodeId)
        .single();

      const { error } = await supabase
        .from('treatment_nodes')
        .update({ completed: !nodeData.completed })
        .eq('id', nodeId);

      if (error) throw error;

      await loadPatientData(currentPatientId);
    } catch (error) {
      console.error('Error toggling completion:', error);
    }
  };

  // ========================================
  // Placeholder Functions (要実装)
  // ========================================

  const generateTreatmentNodes = async () => {
    console.warn('generateTreatmentNodes: 未実装');
    return { workflowSteps: [], initialSchedule: [] };
  };

  const canDropCard = () => true;
  const isCardAvailableForDrag = () => true;
  const handleDrop = async () => ({ success: true });
  const removeFromSchedule = async () => {};

  const addCondition = async () => {
    console.warn('addCondition: 未実装');
  };

  const updateCondition = async () => {
    console.warn('updateCondition: 未実装');
  };

  const deleteCondition = async () => {
    console.warn('deleteCondition: 未実装');
  };

  const addTreatment = () => {
    console.warn('addTreatment: 未実装');
  };

  const updateTreatment = () => {
    console.warn('updateTreatment: 未実装');
  };

  const deleteTreatment = () => {
    console.warn('deleteTreatment: 未実装');
  };

  const moveTreatment = () => {
    console.warn('moveTreatment: 未実装');
  };

  const addStep = () => {
    console.warn('addStep: 未実装');
  };

  const updateStep = () => {
    console.warn('updateStep: 未実装');
  };

  const deleteStep = () => {
    console.warn('deleteStep: 未実装');
  };

  const splitToothFromNode = () => {
    console.warn('splitToothFromNode: 未実装');
    return { success: false, message: '未実装' };
  };

  const mergeToothToNode = () => {
    console.warn('mergeToothToNode: 未実装');
    return { success: false, message: '未実装' };
  };

  const mergeNodeToNode = () => {
    console.warn('mergeNodeToNode: 未実装');
    return { success: false, message: '未実装' };
  };

  const generateNodesForCondition = () => {
    console.warn('generateNodesForCondition: 未実装');
    return [];
  };

  // ========================================
  // Return Hook Interface (V1互換)
  // ========================================

  return {
    // State
    toothConditions,
    setToothConditions,
    workflow,
    treatmentSchedule,
    setTreatmentSchedule,
    selectedTreatmentOptions,
    setSelectedTreatmentOptions,
    conditions,
    treatmentRules,
    stepMaster,
    autoScheduleEnabled,
    setAutoScheduleEnabled,
    aiPrompt,
    setAiPrompt,
    isGeneratingWorkflow,
    schedulingRules,
    setSchedulingRules,
    exclusiveRules,
    setExclusiveRules,

    // New state
    isLoading,
    currentPatientId,
    setCurrentPatientId,

    // Utility functions
    getConditionInfo,
    checkExclusiveRules,
    getStepName,
    getAvailableSteps,

    // Node generation
    generateTreatmentNodes,
    generateNodesForCondition,

    // Scheduling
    executeAutoScheduling,
    executeReschedulingFromDate,

    // Drag & drop
    canDropCard,
    isCardAvailableForDrag,
    handleDrop,
    removeFromSchedule,

    // Schedule management
    addTreatmentDay,
    clearAllConditions,
    clearAllSchedules,
    changeScheduleDate,

    // Master data management
    addCondition,
    updateCondition,
    deleteCondition,
    addTreatment,
    updateTreatment,
    deleteTreatment,
    moveTreatment,
    changeTreatmentOption,
    addStep,
    updateStep,
    deleteStep,

    // Node manipulation
    splitToothFromNode,
    mergeToothToNode,
    mergeNodeToNode,
    toggleTreatmentCompletion,

    // Treatment plan divergence
    divergeTreatmentPlan
  };
}
