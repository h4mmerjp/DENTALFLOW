import { useState } from 'react';
import { defaultConditions } from '../data/conditions';
import { defaultTreatmentRules } from '../data/treatments';
import { defaultSteps } from '../data/steps';
import { useLocalStorage } from './useLocalStorage';

export function useTreatmentWorkflow() {
    const [toothConditions, setToothConditions] = useLocalStorage('toothConditions', {});
    const [workflow, setWorkflow] = useLocalStorage('workflow', []);
    const [treatmentSchedule, setTreatmentSchedule] = useLocalStorage('treatmentSchedule', []);
    const [selectedTreatmentOptions, setSelectedTreatmentOptions] = useLocalStorage('selectedTreatmentOptions', {});
    const [conditions, setConditions] = useLocalStorage('conditions', defaultConditions);
    const [treatmentRules, setTreatmentRules] = useLocalStorage('treatmentRules', defaultTreatmentRules);
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
        if (step) {
            return step.name;
        }
        // 見つからない場合はstep00（空のステップ）を使用
        const emptyStep = stepMaster.find(s => s.id === 'step00');
        return emptyStep ? emptyStep.name : '';
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
                            const groupId = crypto.randomUUID(); // グループIDを生成
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
                                    groupId, // グループIDを追加
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
                        const groupId = crypto.randomUUID(); // グループIDを生成
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
                                    groupId, // グループIDを追加
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
        // 1. スケジュール上の全ノードを取得し、workflowに復帰させる（データ消失防止）
        const allScheduledNodes = treatmentSchedule.reduce((acc, day) => acc.concat(day.treatments), []);
        
        // 既存のworkflowにないノードだけを追加
        setWorkflow(prevWorkflow => {
            const currentWorkflowIds = new Set(prevWorkflow.map(node => node.id));
            const nodesToAdd = allScheduledNodes.filter(node => !currentWorkflowIds.has(node.id));
            
            if (nodesToAdd.length > 0) {
                console.log('Recovering lost nodes:', nodesToAdd);
                return [...prevWorkflow, ...nodesToAdd];
            }
            return prevWorkflow;
        });

        const clearedSchedule = treatmentSchedule.map(day => ({
            date: day.date,
            treatments: []
        }));
        setTreatmentSchedule(clearedSchedule);
    };

    /**
     * スケジュールの日付を変更し、以降の日程を連動して変更
     * @param {number} dayIndex - 変更する日のインデックス
     * @param {string} newDate - 新しい日付（YYYY-MM-DD形式）
     */
    const changeScheduleDate = (dayIndex, newDate) => {
        const updatedSchedule = [...treatmentSchedule];

        // 指定された日の日付を変更
        updatedSchedule[dayIndex] = {
            ...updatedSchedule[dayIndex],
            date: newDate
        };

        // 以降の日程を連動して変更
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

    /**
     * 歯式チップを分離して新しいグループを作成
     * @param {string} sourceNodeId - 分離元のノードID
     * @param {Array<string>} teethToSplit - 分離する歯式の配列
     * @param {string|null} targetDate - 分離先の日付（nullの場合は未スケジュール）
     * @returns {Object} { success: boolean, message: string }
     */
    const splitToothFromNode = (sourceNodeId, teethToSplit, targetDate = null) => {
        // ソースノードを検索（workflowまたはスケジュールから）
        let sourceNode = workflow.find(node => node.id === sourceNodeId);
        let isInSchedule = false;
        let sourceScheduleDate = null;

        if (!sourceNode) {
            // スケジュール内を検索
            for (const day of treatmentSchedule) {
                const found = day.treatments.find(t => t.id === sourceNodeId);
                if (found) {
                    sourceNode = found;
                    isInSchedule = true;
                    sourceScheduleDate = day.date;
                    break;
                }
            }
        }

        if (!sourceNode) {
            return { success: false, message: 'ソースノードが見つかりません。' };
        }

        // 分離する歯式が実際に含まれているか確認
        const invalidTeeth = teethToSplit.filter(tooth => !sourceNode.teeth.includes(tooth));
        if (invalidTeeth.length > 0) {
            return {
                success: false,
                message: `指定された歯式 ${invalidTeeth.join(', ')} はこのノードに含まれていません。`
            };
        }

        // すべての歯を分離しようとした場合は不可
        if (teethToSplit.length >= sourceNode.teeth.length) {
            return {
                success: false,
                message: '少なくとも1本の歯を残す必要があります。'
            };
        }

        // 新しいグループIDを生成
        const newGroupId = crypto.randomUUID();

        // 同じgroupIdを持つすべてのカードを取得（連続治療の全ステップ）
        // workflowとスケジュールの両方から検索
        let sameGroupNodes = workflow.filter(node => node.groupId === sourceNode.groupId);

        // スケジュール内のノードも含める
        if (isInSchedule || sameGroupNodes.length === 0) {
            treatmentSchedule.forEach(day => {
                day.treatments.forEach(t => {
                    if (t.groupId === sourceNode.groupId && !sameGroupNodes.find(n => n.id === t.id)) {
                        sameGroupNodes.push(t);
                    }
                });
            });
        }

        // 新しいノードセットを作成（分離した歯式用）
        const newNodes = sameGroupNodes.map(node => ({
            ...node,
            id: crypto.randomUUID(), // 新しいIDを生成
            groupId: newGroupId,
            teeth: teethToSplit
        }));

        // 元のノードを更新（残りの歯式）
        const remainingTeeth = sourceNode.teeth.filter(tooth => !teethToSplit.includes(tooth));
        const updatedNodes = sameGroupNodes.map(node => ({
            ...node,
            teeth: remainingTeeth
        }));

        // workflowを更新
        // 更新用の一時Mapを作成（IDをキーにして重複を排除）
        const workflowMap = new Map();

        // 1. 既存のworkflowから、対象グループ以外のノードをMapに追加
        workflow.forEach(node => {
            if (node.groupId !== sourceNode.groupId) {
                workflowMap.set(node.id, node);
            }
        });

        // 2. 更新されたノード（元のグループの残り）と新しいノード（分離された部分）を追加
        // IDが重複する場合は上書きされる（最新の状態になる）
        [...updatedNodes, ...newNodes].forEach(node => {
            workflowMap.set(node.id, node);
        });

        const newWorkflow = Array.from(workflowMap.values());

        console.log('Split completed. New Workflow count:', newWorkflow.length);
        setWorkflow(newWorkflow);
        // targetDateが指定されている場合は、そのスケジュールに分離
        // 指定されていない場合は、元の場所（スケジュールまたは未スケジュール）に分離
        const finalTargetDate = targetDate !== null ? targetDate : sourceScheduleDate;

        if (finalTargetDate) {
            // スケジュールに分離
            // workflowには元のノードのみ残す（新しいノードは追加しない）
            setWorkflow(newWorkflow);

            // スケジュールを更新
            // スケジュールを更新
            const newSchedule = treatmentSchedule.map(day => {
                let currentDayTreatments = day.treatments;

                // 1. 既存ノードの更新（すべての日に適用）
                // day.treatmentsの中にupdatedNodesに含まれるIDがあれば更新
                currentDayTreatments = currentDayTreatments.map(t => {
                    const updatedNode = updatedNodes.find(n => n.id === t.id);
                    return updatedNode || t;
                });

                // 2. 新しいノードの追加（ターゲット日のみ）
                if (day.date === finalTargetDate) {
                    currentDayTreatments = [...currentDayTreatments, ...newNodes];
                }

                return {
                    ...day,
                    treatments: currentDayTreatments
                };
            });
            setTreatmentSchedule(newSchedule);
        } else {
            // 未スケジュールに分離
            newWorkflow = newWorkflow.concat(newNodes);
            setWorkflow(newWorkflow);
        }

        return {
            success: true,
            message: `歯式 ${teethToSplit.join(', ')} を分離しました。`
        };
    };

    /**
     * 歯式チップを別のノードにマージ
     * @param {Object} dragData - { tooth, nodeId, groupId }
     * @param {Object} targetNode - マージ先のノード
     * @returns {Object} { success: boolean, message: string }
     */
    const mergeToothToNode = (dragData, targetNode) => {
        const { tooth, nodeId: sourceNodeId, groupId: sourceGroupId } = dragData;

        // ソースノードとターゲットノードがスケジュール内にあるかチェック
        let sourceScheduleDate = null;
        let targetScheduleDate = null;

        for (const day of treatmentSchedule) {
            if (day.treatments.some(t => t.groupId === sourceGroupId)) {
                sourceScheduleDate = day.date;
            }
            if (day.treatments.some(t => t.groupId === targetNode.groupId)) {
                targetScheduleDate = day.date;
            }
        }

        // ソースノードを検索（workflowまたはスケジュールから）
        let sourceNode = workflow.find(node => node.id === sourceNodeId);
        if (!sourceNode) {
            // スケジュール内を検索
            for (const day of treatmentSchedule) {
                const found = day.treatments.find(t => t.id === sourceNodeId);
                if (found) {
                    sourceNode = found;
                    break;
                }
            }
        }

        if (!sourceNode) {
            return { success: false, message: 'ソースノードが見つかりません。' };
        }

        // 同じノードへのドロップは不可
        if (sourceNode.groupId === targetNode.groupId) {
            return {
                success: false,
                message: '同じノードには合体できません。'
            };
        }

        // 病名と治療法が一致しているか確認
        if (sourceNode.condition !== targetNode.condition ||
            sourceNode.treatment !== targetNode.treatment ||
            sourceNode.cardNumber !== targetNode.cardNumber) {
            return {
                success: false,
                message: '同じ病名・治療法・ステップ番号のノードにのみ合体できます。'
            };
        }

        // 既にターゲットノードに含まれている歯式かチェック
        if (targetNode.teeth.includes(tooth)) {
            return {
                success: false,
                message: `歯式 ${tooth} は既にこのノードに含まれています。`
            };
        }

        // 同じgroupIdを持つすべてのカードを取得（workflowとスケジュールから）
        let sourceGroupNodes = workflow.filter(node => node.groupId === sourceGroupId);
        let targetGroupNodes = workflow.filter(node => node.groupId === targetNode.groupId);

        // スケジュール内も検索
        if (sourceScheduleDate) {
            treatmentSchedule.forEach(day => {
                day.treatments.forEach(t => {
                    if (t.groupId === sourceGroupId && !sourceGroupNodes.find(n => n.id === t.id)) {
                        sourceGroupNodes.push(t);
                    }
                });
            });
        }
        if (targetScheduleDate) {
            treatmentSchedule.forEach(day => {
                day.treatments.forEach(t => {
                    if (t.groupId === targetNode.groupId && !targetGroupNodes.find(n => n.id === t.id)) {
                        targetGroupNodes.push(t);
                    }
                });
            });
        }

        // ソースノードから歯式を削除
        const remainingTeeth = sourceNode.teeth.filter(t => t !== tooth);

        // 更新されたノードを作成
        const updatedSourceNodes = sourceGroupNodes.map(node => ({
            ...node,
            teeth: remainingTeeth
        }));

        const updatedTargetNodes = targetGroupNodes.map(node => ({
            ...node,
            teeth: [...node.teeth, tooth].sort()
        }));

        // workflowを更新
        let newWorkflow;
        if (remainingTeeth.length === 0) {
            // ソースノードの歯式がなくなった場合は削除
            newWorkflow = workflow.filter(node => node.groupId !== sourceGroupId);
        } else {
            // ソースノードを更新
            newWorkflow = workflow.map(node =>
                node.groupId === sourceGroupId
                    ? updatedSourceNodes.find(n => n.id === node.id) || node
                    : node
            );
        }

        // ターゲットノードを更新
        newWorkflow = newWorkflow.map(node =>
            node.groupId === targetNode.groupId
                ? updatedTargetNodes.find(n => n.id === node.id) || node
                : node
        );

        setWorkflow(newWorkflow);

        // スケジュールを更新
        let newSchedule = treatmentSchedule.map(day => {
            let updatedTreatments = day.treatments;

            // ソースノード更新（歯式削除またはノード削除）
            if (remainingTeeth.length === 0) {
                // 歯式がなくなった場合は削除
                updatedTreatments = updatedTreatments.filter(t => t.groupId !== sourceGroupId);
            } else {
                // 歯式を更新
                updatedTreatments = updatedTreatments.map(t =>
                    t.groupId === sourceGroupId
                        ? updatedSourceNodes.find(n => n.id === t.id) || t
                        : t
                );
            }

            // ターゲットノード更新
            updatedTreatments = updatedTreatments.map(t =>
                t.groupId === targetNode.groupId
                    ? updatedTargetNodes.find(n => n.id === t.id) || t
                    : t
            );

            return {
                ...day,
                treatments: updatedTreatments
            };
        });

        setTreatmentSchedule(newSchedule);

        return {
            success: true,
            message: `歯式 ${tooth} を合体しました。`
        };
    };

    /**
     * ノード全体を別のノードに合体（複数の歯を一度にマージ）
     */
    const mergeNodeToNode = (sourceNodeId, sourceGroupId, targetNode) => {
        // スケジュール日付を確認
        let sourceScheduleDate = null;
        let targetScheduleDate = null;

        for (const day of treatmentSchedule) {
            if (day.treatments.some(t => t.groupId === sourceGroupId)) {
                sourceScheduleDate = day.date;
            }
            if (day.treatments.some(t => t.groupId === targetNode.groupId)) {
                targetScheduleDate = day.date;
            }
        }

        // ソースノードを検索（workflowまたはスケジュールから）
        let sourceNode = workflow.find(node => node.id === sourceNodeId);
        if (!sourceNode) {
            // スケジュール内を検索
            for (const day of treatmentSchedule) {
                const found = day.treatments.find(t => t.id === sourceNodeId);
                if (found) {
                    sourceNode = found;
                    break;
                }
            }
        }

        if (!sourceNode) {
            return { success: false, message: 'ソースノードが見つかりません。' };
        }

        // 同じノードへのドロップは不可
        if (sourceNode.groupId === targetNode.groupId) {
            return {
                success: false,
                message: '同じノードには合体できません。'
            };
        }

        // 病名と治療法が一致しているか確認
        if (sourceNode.condition !== targetNode.condition ||
            sourceNode.treatment !== targetNode.treatment ||
            sourceNode.cardNumber !== targetNode.cardNumber) {
            return {
                success: false,
                message: '同じ病名・治療法・ステップ番号のノードにのみ合体できます。'
            };
        }

        // ソースノードの歯がターゲットノードに既に含まれていないかチェック
        const duplicateTeeth = sourceNode.teeth.filter(tooth => targetNode.teeth.includes(tooth));
        if (duplicateTeeth.length > 0) {
            return {
                success: false,
                message: `歯式 ${duplicateTeeth.join(', ')} は既にこのノードに含まれています。`
            };
        }

        // 同じgroupIdを持つすべてのカードを取得（workflowとスケジュールから）
        let sourceGroupNodes = workflow.filter(node => node.groupId === sourceGroupId);
        let targetGroupNodes = workflow.filter(node => node.groupId === targetNode.groupId);

        // スケジュール内も検索
        if (sourceScheduleDate) {
            treatmentSchedule.forEach(day => {
                day.treatments.forEach(t => {
                    if (t.groupId === sourceGroupId && !sourceGroupNodes.find(n => n.id === t.id)) {
                        sourceGroupNodes.push(t);
                    }
                });
            });
        }
        if (targetScheduleDate) {
            treatmentSchedule.forEach(day => {
                day.treatments.forEach(t => {
                    if (t.groupId === targetNode.groupId && !targetGroupNodes.find(n => n.id === t.id)) {
                        targetGroupNodes.push(t);
                    }
                });
            });
        }

        // ターゲットノードに全ての歯を追加
        const mergedTeeth = [...targetNode.teeth, ...sourceNode.teeth].sort((a, b) => a - b);

        const updatedTargetNodes = targetGroupNodes.map(node => ({
            ...node,
            teeth: mergedTeeth
        }));

        // workflowを更新（ソースノードを削除、ターゲットノードを更新）
        let newWorkflow = workflow.filter(node => node.groupId !== sourceGroupId);
        newWorkflow = newWorkflow.map(node =>
            node.groupId === targetNode.groupId
                ? updatedTargetNodes.find(n => n.id === node.id) || node
                : node
        );

        setWorkflow(newWorkflow);

        // スケジュールを更新
        const newSchedule = treatmentSchedule.map(day => {
            let updatedTreatments = day.treatments;

            // ソースノードを削除
            updatedTreatments = updatedTreatments.filter(t => t.groupId !== sourceGroupId);

            // ターゲットノードを更新
            updatedTreatments = updatedTreatments.map(t => {
                if (t.groupId === targetNode.groupId) {
                    const updatedNode = updatedTargetNodes.find(n => n.id === t.id);
                    return updatedNode || t;
                }
                return t;
            });

            return {
                ...day,
                treatments: updatedTreatments
            };
        });

        setTreatmentSchedule(newSchedule);

        return {
            success: true,
            message: `ノードを合体しました（歯式: ${sourceNode.teeth.join(', ')} → ${mergedTeeth.join(', ')}）`
        };
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
        clearAllSchedules,
        changeScheduleDate,
        splitToothFromNode,
        mergeToothToNode,
        mergeNodeToNode
    };
}
