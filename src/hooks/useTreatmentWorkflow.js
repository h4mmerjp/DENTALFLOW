import { useState } from 'react';
import { defaultConditions } from '../data/conditions';
import { defaultTreatmentRules } from '../data/treatments';
import { defaultSteps } from '../data/steps';
import { useLocalStorage } from './useLocalStorage';

export function useTreatmentWorkflow() {
    const [toothConditions, setToothConditions] = useState({});
    const [workflow, setWorkflow] = useState([]);
    const [treatmentSchedule, setTreatmentSchedule] = useState([]);
    const [selectedTreatmentOptions, setSelectedTreatmentOptions] = useState({});
    const [conditions, setConditions] = useState(defaultConditions);
    const [treatmentRules, setTreatmentRules] = useState(defaultTreatmentRules);
    const [stepMaster, setStepMaster] = useLocalStorage('stepMaster', defaultSteps);
    const [autoScheduleEnabled, setAutoScheduleEnabled] = useLocalStorage('autoScheduleEnabled', true);
    const [aiPrompt, setAiPrompt] = useLocalStorage('aiPrompt', '患者の痛みを最優先に、急性症状から治療してください。根管治療は週1回ペース、補綴物は2週間隔で進めてください。');
    const [isGeneratingWorkflow, setIsGeneratingWorkflow] = useState(false);

    // ルールベース自動配置の設定
    const [schedulingRules, setSchedulingRules] = useLocalStorage('schedulingRules', {
        priorityOrder: ['per', 'pul', 'C4', 'C3', 'C2', 'P2', 'P1', 'C1'], // 優先順位
        maxTreatmentsPerDay: 3, // 1日の最大治療数
        acuteCareConditions: ['per', 'pul', 'C4'], // 急性症状として扱う病名
        acuteCareMaxPerDay: 1, // 急性症状の1日最大治療数
        scheduleIntervalDays: 7 // スケジュール間隔（日数）
    });

    // 排他的病名ルール（グループ間で排他的な病名の組み合わせ）
    // ルールは「グループの配列」として定義
    // 例: [['欠損'], ['C1', 'P1']] → 欠損と(C1またはP1)は排他的だが、C1とP1は同時設定可能
    const [exclusiveRules, setExclusiveRules] = useLocalStorage('exclusiveRules', [
        [['C1'], ['C2'], ['C3'], ['C4']],  // C1⇄C2⇄C3⇄C4（すべて相互排他）
        [['P1'], ['P2']]                    // P1⇄P2（相互排他）
    ]);

    const getConditionInfo = (code) => {
        return conditions.find(c => c.code === code) || null;
    };

    // 排他的病名ルールをチェック（グループベース）
    const checkExclusiveRules = (conditionCode, currentConditions) => {
        // 追加しようとしている病名と排他関係にある病名を見つける
        const conflictingConditions = [];

        exclusiveRules.forEach(rule => {
            // このルール内で、追加しようとしている病名がどのグループに属するか探す
            let targetGroupIndex = -1;
            rule.forEach((group, index) => {
                if (group.includes(conditionCode)) {
                    targetGroupIndex = index;
                }
            });

            // 対象の病名がこのルールに含まれている場合
            if (targetGroupIndex !== -1) {
                // 他のグループ（排他的なグループ）の病名をチェック
                rule.forEach((group, index) => {
                    if (index !== targetGroupIndex) {
                        // 異なるグループの病名
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

    const addCondition = (newCondition) => {
        setConditions(prev => [...prev, { ...newCondition }]);
    };

    const deleteCondition = (code) => {
        setConditions(prev => prev.filter(c => c.code !== code));
        setTreatmentRules(prev => {
            const newRules = { ...prev };
            delete newRules[code];
            return newRules;
        });
    };

    const updateCondition = (oldCode, updatedCondition) => {
        setConditions(prev => prev.map(c => c.code === oldCode ? updatedCondition : c));
    };

    const updateTreatment = (conditionCode, index, updatedTreatment) => {
        setTreatmentRules(prev => {
            const treatments = [...(prev[conditionCode] || [])];
            treatments[index] = updatedTreatment;
            return {
                ...prev,
                [conditionCode]: treatments
            };
        });
    };

    const addTreatment = (conditionCode, treatment) => {
        setTreatmentRules(prev => ({
            ...prev,
            [conditionCode]: [...(prev[conditionCode] || []), treatment]
        }));
    };

    const deleteTreatment = (conditionCode, treatmentIndex) => {
        setTreatmentRules(prev => ({
            ...prev,
            [conditionCode]: prev[conditionCode].filter((_, index) => index !== treatmentIndex)
        }));
    };

    const moveTreatment = (conditionCode, fromIndex, toIndex) => {
        setTreatmentRules(prev => {
            const treatments = [...(prev[conditionCode] || [])];
            const [moved] = treatments.splice(fromIndex, 1);
            treatments.splice(toIndex, 0, moved);
            return { ...prev, [conditionCode]: treatments };
        });
    };

    // ステップマスター管理関数
    const addStep = (step) => {
        setStepMaster(prev => [...prev, step]);
    };

    const updateStep = (stepId, updatedStep) => {
        setStepMaster(prev => prev.map(step =>
            step.id === stepId ? updatedStep : step
        ));
    };

    const deleteStep = (stepId) => {
        setStepMaster(prev => prev.filter(step => step.id !== stepId));
    };

    // ステップIDからステップ名を取得
    const getStepName = (stepId) => {
        const step = stepMaster.find(s => s.id === stepId);
        return step ? step.name : stepId; // 見つからない場合はIDをそのまま返す
    };

    // 指定した病名で使用可能なステップを取得
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

    const generateTreatmentNodes = (groupingMode = 'individual') => {
        // 1. 現在のスケジュール配置をバックアップ
        // key: `${baseId}-${cardNumber}` -> value: dateString
        const scheduledNodesMap = new Map();
        if (treatmentSchedule.length > 0) {
            treatmentSchedule.forEach(day => {
                day.treatments.forEach(node => {
                    scheduledNodesMap.set(`${node.baseId}-${node.cardNumber}`, day.date);
                });
            });
        }

        const workflowSteps = [];
        const priority = ['per', 'pul', 'C4', 'C3', 'P2', 'C2', 'P1', 'C1'];

        priority.forEach(condition => {
            const affectedTeeth = [];
            Object.entries(toothConditions).forEach(([tooth, conditionsList]) => {
                if (conditionsList.includes(condition)) {
                    affectedTeeth.push(tooth);
                }
            });

            if (affectedTeeth.length > 0) {
                const treatments = treatmentRules[condition] || [];

                if (groupingMode === 'individual') {
                    affectedTeeth.forEach(tooth => {
                        const treatmentKey = `${condition}-${tooth}`;
                        const selectedTreatmentIndex = selectedTreatmentOptions[treatmentKey] || 0;
                        const selectedTreatment = treatments[selectedTreatmentIndex] || treatments[0];

                        if (selectedTreatment) {
                            for (let i = 0; i < selectedTreatment.duration; i++) {
                                const cardId = crypto.randomUUID();
                                // stepIdsがある場合はステップマスターから名前を取得、なければstepsから取得（後方互換性）
                                let stepName;
                                if (selectedTreatment.stepIds && selectedTreatment.stepIds[i]) {
                                    stepName = getStepName(selectedTreatment.stepIds[i]);
                                } else if (selectedTreatment.steps && selectedTreatment.steps[i]) {
                                    stepName = selectedTreatment.steps[i];
                                } else {
                                    stepName = `${selectedTreatment.name}(${i + 1})`;
                                }

                                workflowSteps.push({
                                    id: cardId,
                                    baseId: `${condition}-${selectedTreatment.name}-${tooth}`,
                                    condition,
                                    treatment: selectedTreatment.name,
                                    stepName,
                                    teeth: [tooth],
                                    cardNumber: i + 1,
                                    totalCards: selectedTreatment.duration,
                                    isSequential: selectedTreatment.duration > 1,
                                    treatmentKey,
                                    availableTreatments: treatments,
                                    selectedTreatmentIndex,
                                    hasMultipleTreatments: treatments.length > 1
                                });
                            }
                        }
                    });
                } else {
                    const treatmentKey = `${condition}-${affectedTeeth.sort().join(',')}`;
                    const selectedTreatmentIndex = selectedTreatmentOptions[treatmentKey] || 0;
                    const selectedTreatment = treatments[selectedTreatmentIndex] || treatments[0];

                    if (selectedTreatment) {
                        for (let i = 0; i < selectedTreatment.duration; i++) {
                            const cardId = crypto.randomUUID();
                            // stepIdsがある場合はステップマスターから名前を取得、なければstepsから取得（後方互換性）
                            let stepName;
                            if (selectedTreatment.stepIds && selectedTreatment.stepIds[i]) {
                                stepName = getStepName(selectedTreatment.stepIds[i]);
                            } else if (selectedTreatment.steps && selectedTreatment.steps[i]) {
                                stepName = selectedTreatment.steps[i];
                            } else {
                                stepName = `${selectedTreatment.name}(${i + 1})`;
                            }

                            workflowSteps.push({
                                id: cardId,
                                    baseId: `${condition}-${selectedTreatment.name}`,
                                    condition,
                                    treatment: selectedTreatment.name,
                                    stepName,
                                    teeth: affectedTeeth,
                                    cardNumber: i + 1,
                                    totalCards: selectedTreatment.duration,
                                    isSequential: selectedTreatment.duration > 1,
                                    treatmentKey,
                                    availableTreatments: treatments,
                                    selectedTreatmentIndex,
                                    hasMultipleTreatments: treatments.length > 1
                            });
                        }
                    }
                }
            }
        });

        setWorkflow(workflowSteps);

        const today = new Date();
        let newSchedule = [];

        // 2. スケジュール枠の準備
        if (treatmentSchedule.length > 0) {
            // 既存の日付枠を維持して、treatmentsだけ空にする
            newSchedule = treatmentSchedule.map(day => ({
                date: day.date,
                treatments: []
            }));
        } else {
            // 新規作成
            for (let i = 0; i < Math.max(8, Math.ceil(workflowSteps.length / 2)); i++) {
                const date = new Date(today);
                date.setDate(today.getDate() + (i * schedulingRules.scheduleIntervalDays));
                newSchedule.push({
                    date: date.toISOString().split('T')[0],
                    treatments: []
                });
            }
        }

        // 3. 配置の復元
        workflowSteps.forEach(node => {
            const mapKey = `${node.baseId}-${node.cardNumber}`;
            const targetDate = scheduledNodesMap.get(mapKey);

            if (targetDate) {
                const targetDay = newSchedule.find(day => day.date === targetDate);
                if (targetDay) {
                    targetDay.treatments.push(node);
                }
            }
        });

        setTreatmentSchedule(newSchedule);

        return { workflowSteps, initialSchedule: newSchedule };
    };

    const executeAutoScheduling = () => {
        if (workflow.length === 0) {
            return { success: false, message: '治療ノードが生成されていません。' };
        }

        setIsGeneratingWorkflow(true);

        const newSchedule = treatmentSchedule.map(day => ({
            ...day,
            treatments: []
        }));

        const priorityOrder = schedulingRules.priorityOrder;

        const sortedTreatments = [...workflow].sort((a, b) => {
            const aPriority = priorityOrder.indexOf(a.condition);
            const bPriority = priorityOrder.indexOf(b.condition);

            if (aPriority !== bPriority) {
                return (aPriority === -1 ? 999 : aPriority) - (bPriority === -1 ? 999 : bPriority);
            }

            if (a.baseId === b.baseId) {
                return a.cardNumber - b.cardNumber;
            }

            return 0;
        });

        let totalAssigned = 0;

        sortedTreatments.forEach(treatment => {
            let currentDayIndex = 0; // 各治療ごとに最初からチェック
            while (currentDayIndex < newSchedule.length) {
                const currentDay = newSchedule[currentDayIndex];

                // 急性症状のカウント
                const acuteCareCount = currentDay.treatments.filter(t =>
                    schedulingRules.acuteCareConditions.includes(t.condition)
                ).length;

                // 1日の最大治療数チェック
                const canAddMore = currentDay.treatments.length < schedulingRules.maxTreatmentsPerDay;

                // 急性症状の場合は専用の制限もチェック
                const canAddAcuteCare = !schedulingRules.acuteCareConditions.includes(treatment.condition) ||
                    acuteCareCount < schedulingRules.acuteCareMaxPerDay;

                if (canAddMore && canAddAcuteCare) {
                    if (treatment.isSequential && treatment.cardNumber > 1) {
                        const previousCardNumber = treatment.cardNumber - 1;
                        const previousCard = workflow.find(w =>
                            w.baseId === treatment.baseId &&
                            w.cardNumber === previousCardNumber
                        );

                        if (previousCard) {
                            let foundPrevious = false;
                            for (let i = 0; i < currentDayIndex; i++) {
                                if (newSchedule[i].treatments.some(t => t.id === previousCard.id)) {
                                    foundPrevious = true;
                                    break;
                                }
                            }
                            if (!foundPrevious) {
                                currentDayIndex++;
                                continue;
                            }
                        }
                    }

                    currentDay.treatments.push(treatment);
                    totalAssigned++;
                    break;
                } else {
                    currentDayIndex++;
                }
            }

            if (currentDayIndex >= newSchedule.length) {
                const lastDate = newSchedule.length > 0
                    ? new Date(newSchedule[newSchedule.length - 1].date)
                    : new Date();

                const newDate = new Date(lastDate);
                newDate.setDate(lastDate.getDate() + schedulingRules.scheduleIntervalDays);

                newSchedule.push({
                    date: newDate.toISOString().split('T')[0],
                    treatments: [treatment]
                });

                totalAssigned++;
            }
        });

        setTreatmentSchedule(newSchedule);
        setIsGeneratingWorkflow(false);

        return {
            success: true,
            totalAssigned,
            totalTreatments: workflow.length,
            message: `${totalAssigned}件の治療を自動配置しました。`
        };
    };

    const canDropCard = (card, targetDate) => {
        if (!card.isSequential) return true;
        if (card.cardNumber === 1) return true;

        const previousCardNumber = card.cardNumber - 1;
        const previousCard = workflow.find(w =>
            w.baseId === card.baseId && w.cardNumber === previousCardNumber
        );

        if (!previousCard) return true;

        let previousCardDate = null;
        for (const day of treatmentSchedule) {
            if (day.treatments.some(t => t.id === previousCard.id)) {
                previousCardDate = day.date;
                break;
            }
        }

        if (!previousCardDate) return false;
        return new Date(targetDate) > new Date(previousCardDate);
    };

    const isCardAvailableForDrag = (card) => {
        if (!card.isSequential) return true;
        if (card.cardNumber === 1) return true;

        const previousCardNumber = card.cardNumber - 1;
        const previousCard = workflow.find(w =>
            w.baseId === card.baseId && w.cardNumber === previousCardNumber
        );

        if (!previousCard) return false;

        return treatmentSchedule.some(day =>
            day.treatments.some(t => t.id === previousCard.id)
        );
    };

    const handleDrop = (draggedNode, targetDate) => {
        if (!canDropCard(draggedNode, targetDate)) {
            return { success: false, message: '治療の順序が正しくありません。前の治療の後に配置してください。' };
        }

        let updatedSchedule = treatmentSchedule.map(day => ({
            ...day,
            treatments: day.treatments.filter(t => t.id !== draggedNode.id)
        }));

        const targetDayIndex = updatedSchedule.findIndex(day => day.date === targetDate);
        if (targetDayIndex !== -1) {
            updatedSchedule[targetDayIndex].treatments.push(draggedNode);

            if (autoScheduleEnabled && draggedNode.isSequential && draggedNode.cardNumber === 1) {
                const remainingCards = workflow.filter(w =>
                    w.baseId === draggedNode.baseId && w.cardNumber > draggedNode.cardNumber
                ).sort((a, b) => a.cardNumber - b.cardNumber);

                let currentDayIndex = targetDayIndex;
                remainingCards.forEach(card => {
                    currentDayIndex += 1;
                    while (currentDayIndex >= updatedSchedule.length) {
                        const lastDate = updatedSchedule.length > 0
                            ? new Date(updatedSchedule[updatedSchedule.length - 1].date)
                            : new Date();
                        const newDate = new Date(lastDate);
                        newDate.setDate(lastDate.getDate() + schedulingRules.scheduleIntervalDays);
                        updatedSchedule.push({
                            date: newDate.toISOString().split('T')[0],
                            treatments: []
                        });
                    }
                    updatedSchedule[currentDayIndex].treatments.push(card);
                });
            }
        }

        setTreatmentSchedule(updatedSchedule);
        return { success: true };
    };

    // スケジュールからノードを削除（以降のステップも一緒に削除）
    const removeFromSchedule = (treatment) => {
        const idsToRemove = new Set([treatment.id]);

        if (treatment.isSequential) {
            workflow.forEach(w => {
                if (w.baseId === treatment.baseId && w.cardNumber >= treatment.cardNumber) {
                    idsToRemove.add(w.id);
                }
            });
        }

        const updatedSchedule = treatmentSchedule.map(day => ({
            ...day,
            treatments: day.treatments.filter(t => !idsToRemove.has(t.id))
        }));
        setTreatmentSchedule(updatedSchedule);
    };

    const clearAllConditions = () => {
        setToothConditions({});
        setWorkflow([]);
        setTreatmentSchedule([]);
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

    // スケジュールを一括リセット（スケジュール枠は残す）
    const clearAllSchedules = () => {
        const clearedSchedule = treatmentSchedule.map(day => ({
            date: day.date,
            treatments: []
        }));
        setTreatmentSchedule(clearedSchedule);
    };

    return {
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
        getConditionInfo,
        checkExclusiveRules,
        generateTreatmentNodes,
        executeAutoScheduling,
        canDropCard,
        isCardAvailableForDrag,
        handleDrop,
        removeFromSchedule,
        addTreatmentDay,
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
        getStepName,
        getAvailableSteps,
        clearAllConditions,
        clearAllSchedules
    };
}
