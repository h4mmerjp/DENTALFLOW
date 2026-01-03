import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Simplified treatment workflow hook using Supabase
 * Reduces complexity from 1,203 lines to ~300 lines
 */
export function useTreatmentWorkflowV2(patientId) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGeneratingWorkflow, setIsGeneratingWorkflow] = useState(false);

  // Data state
  const [toothConditions, setToothConditions] = useState([]);
  const [treatmentNodes, setTreatmentNodes] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [treatmentRules, setTreatmentRules] = useState([]);
  const [stepMaster, setStepMaster] = useState([]);

  // Fetch all data
  const fetchData = async () => {
    if (!patientId) return;

    setLoading(true);
    try {
      // Fetch tooth conditions
      const { data: condData, error: condErr } = await supabase
        .from('tooth_conditions')
        .select('*, condition:conditions(*)')
        .eq('patient_id', patientId);
      if (condErr) throw condErr;

      // Fetch treatment nodes
      const { data: nodesData, error: nodesErr } = await supabase
        .from('treatment_nodes_view')
        .select('*')
        .eq('patient_id', patientId)
        .order('scheduled_date', { ascending: true, nullsFirst: false });
      if (nodesErr) throw nodesErr;

      // Fetch master data
      const { data: condMaster, error: condMasterErr } = await supabase
        .from('conditions')
        .select('*');
      if (condMasterErr) throw condMasterErr;

      const { data: stepData, error: stepErr } = await supabase
        .from('steps')
        .select('*');
      if (stepErr) throw stepErr;

      const { data: rulesData, error: rulesErr } = await supabase
        .from('treatment_rules')
        .select('*, condition:conditions(code), steps:treatment_rule_steps(step_order, step:steps(*))')
        .order('priority', { ascending: true });
      if (rulesErr) throw rulesErr;

      setToothConditions(condData);
      setConditions(condMaster);
      setStepMaster(stepData);
      setTreatmentRules(rulesData);

      // Separate scheduled and unscheduled nodes
      const scheduled = nodesData.filter(n => n.scheduled_date);
      const unscheduled = nodesData.filter(n => !n.scheduled_date);

      // Group by date
      const scheduleMap = new Map();
      scheduled.forEach(node => {
        if (!scheduleMap.has(node.scheduled_date)) {
          scheduleMap.set(node.scheduled_date, []);
        }
        scheduleMap.get(node.scheduled_date).push(node);
      });

      setSchedule(
        Array.from(scheduleMap.entries())
          .map(([date, treatments]) => ({
            date,
            treatments: treatments.sort((a, b) => a.sort_order - b.sort_order)
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
      );
      setTreatmentNodes(unscheduled);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [patientId]);

  // ===== RPC Operations =====

  const generateNodes = async (groupingMode = 'individual') => {
    if (!patientId) return;

    try {
      const { data, error } = await supabase.rpc('generate_treatment_nodes', {
        p_patient_id: patientId,
        p_grouping_mode: groupingMode
      });
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error generating nodes:', err);
      throw err;
    }
  };

  const autoSchedule = async (fromDate = null) => {
    if (!patientId) return null;

    try {
      setIsGeneratingWorkflow(true);
      const { data, error } = await supabase.rpc('execute_auto_scheduling', {
        p_patient_id: patientId,
        p_from_date: fromDate
      });
      if (error) throw error;
      await fetchData();
      return data?.[0];
    } catch (err) {
      console.error('Error auto scheduling:', err);
      throw err;
    } finally {
      setIsGeneratingWorkflow(false);
    }
  };

  const splitTooth = async (nodeId, teethToSplit, targetDate = null) => {
    try {
      const { data, error } = await supabase.rpc('split_tooth_from_node', {
        p_node_id: nodeId,
        p_teeth_to_split: teethToSplit,
        p_target_date: targetDate
      });
      if (error) throw error;
      await fetchData();
      return data?.[0];
    } catch (err) {
      console.error('Error splitting tooth:', err);
      throw err;
    }
  };

  const mergeNodes = async (sourceGroupId, targetGroupId) => {
    try {
      const { data, error } = await supabase.rpc('merge_nodes', {
        p_source_group_id: sourceGroupId,
        p_target_group_id: targetGroupId
      });
      if (error) throw error;
      await fetchData();
      return data?.[0];
    } catch (err) {
      console.error('Error merging nodes:', err);
      throw err;
    }
  };

  const checkExclusiveRules = async (conditionCode, currentConditions) => {
    try {
      const { data, error } = await supabase.rpc('check_exclusive_rules', {
        p_condition_code: conditionCode,
        p_current_conditions: currentConditions
      });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error checking exclusive rules:', err);
      return [];
    }
  };

  // ===== CRUD Operations =====

  const addToothCondition = async (toothNumber, conditionId) => {
    if (!patientId) return;

    try {
      const { error } = await supabase.from('tooth_conditions').insert({
        patient_id: patientId,
        tooth_number: toothNumber,
        condition_id: conditionId
      });
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error adding tooth condition:', err);
      throw err;
    }
  };

  const removeToothCondition = async (id) => {
    try {
      const { error } = await supabase
        .from('tooth_conditions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error removing tooth condition:', err);
      throw err;
    }
  };

  const moveNodeToDate = async (nodeId, targetDate, sortOrder = 0) => {
    try {
      const { error } = await supabase
        .from('treatment_nodes')
        .update({ scheduled_date: targetDate, sort_order: sortOrder })
        .eq('id', nodeId);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error moving node to date:', err);
      throw err;
    }
  };

  const toggleCompletion = async (nodeId) => {
    try {
      const allNodes = [...treatmentNodes, ...schedule.flatMap(d => d.treatments)];
      const node = allNodes.find(n => n.id === nodeId);
      if (!node) return;

      const { error } = await supabase
        .from('treatment_nodes')
        .update({
          completed: !node.completed,
          completed_at: !node.completed ? new Date().toISOString() : null
        })
        .eq('id', nodeId);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error toggling completion:', err);
      throw err;
    }
  };

  const addTreatmentDay = async (baseDate = null) => {
    if (!patientId || schedule.length === 0) return;

    try {
      const lastDate = new Date(baseDate || schedule[schedule.length - 1].date);
      const newDate = new Date(lastDate);
      newDate.setDate(lastDate.getDate() + 7); // Default 7-day interval

      // Create initial unscheduled node to reserve the date
      // In practice, this would be done when dragging a node to this date
      await fetchData();
    } catch (err) {
      console.error('Error adding treatment day:', err);
      throw err;
    }
  };

  const clearAllConditions = async () => {
    if (!patientId) return;

    try {
      // Delete all tooth conditions
      const { error } = await supabase
        .from('tooth_conditions')
        .delete()
        .eq('patient_id', patientId);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error clearing conditions:', err);
      throw err;
    }
  };

  const clearAllSchedules = async () => {
    try {
      // Clear all scheduled_date values while keeping nodes
      const { error } = await supabase
        .from('treatment_nodes')
        .update({ scheduled_date: null, sort_order: 0 })
        .in(
          'id',
          schedule.flatMap(d => d.treatments).map(t => t.id)
        );
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error clearing schedules:', err);
      throw err;
    }
  };

  const changeScheduleDate = async (dayIndex, newDate) => {
    try {
      if (dayIndex >= 0 && dayIndex < schedule.length) {
        const day = schedule[dayIndex];
        const { error } = await supabase
          .from('treatment_nodes')
          .update({ scheduled_date: newDate })
          .in(
            'id',
            day.treatments.map(t => t.id)
          );
        if (error) throw error;
        await fetchData();
      }
    } catch (err) {
      console.error('Error changing schedule date:', err);
      throw err;
    }
  };

  const getConditionInfo = (code) => {
    return conditions.find(c => c.code === code) || null;
  };

  return {
    loading,
    error,
    isGeneratingWorkflow,

    // Data
    toothConditions,
    treatmentNodes, // Unscheduled nodes (old: workflow)
    schedule, // Scheduled nodes (old: treatmentSchedule)
    conditions,
    treatmentRules,
    stepMaster,

    // RPC Operations
    generateNodes,
    autoSchedule,
    splitTooth,
    mergeNodes,
    checkExclusiveRules,

    // CRUD Operations
    addToothCondition,
    removeToothCondition,
    moveNodeToDate,
    toggleCompletion,
    addTreatmentDay,
    clearAllConditions,
    clearAllSchedules,
    changeScheduleDate,

    // Utilities
    getConditionInfo,
    refresh: fetchData
  };
}
