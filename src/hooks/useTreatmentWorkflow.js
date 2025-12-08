import { useState } from 'react';
import { defaultConditions } from '../data/conditions';
import { defaultTreatmentRules } from '../data/treatments';

export function useTreatmentWorkflow() {
    const [toothConditions, setToothConditions] = useState({});
    const [workflow, setWorkflow] = useState([]);
    const [treatmentSchedule, setTreatmentSchedule] = useState([]);
    const [selectedTreatmentOptions, setSelectedTreatmentOptions] = useState({});
    const [conditions, setConditions] = useState(defaultConditions);
    const [treatmentRules, setTreatmentRules] = useState(defaultTreatmentRules);
    const [autoScheduleEnabled, setAutoScheduleEnabled] = useState(true);
    const [aiPrompt, setAiPrompt] = useState('患者の痛みを最優先に、急性症状から治療してください。根管治療は週1回ペース、補綴物は2週間隔で進めてください。');
    const [isGeneratingWorkflow, setIsGeneratingWorkflow] = useState(false);

    const getConditionInfo = (code) => {
        return conditions.find(c => c.code === code) || null;
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

    const changeTreatmentOption = (step, newTreatmentIndex) => {
        setSelectedTreatmentOptions(prev => ({
            ...prev,
            [step.treatmentKey]: newTreatmentIndex
        }));
    };

    const generateTreatmentNodes = (groupingMode = 'individual') => {
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
                                const stepName = selectedTreatment.steps?.[i] || `${selectedTreatment.name}(${i + 1})`;
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
                            const stepName = selectedTreatment.steps?.[i] || `${selectedTreatment.name}(${i + 1})`;
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
        const initialSchedule = [];
        for (let i = 0; i < Math.max(8, Math.ceil(workflowSteps.length / 2)); i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + (i * 7));
            initialSchedule.push({
                date: date.toISOString().split('T')[0],
                treatments: []
            });
        }
        setTreatmentSchedule(initialSchedule);

        return { workflowSteps, initialSchedule };
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

        const priorityOrder = ['per', 'pul', 'C4', 'C3', 'C2', 'P2', 'P1', 'C1'];

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

        let currentDayIndex = 0;
        let totalAssigned = 0;

        sortedTreatments.forEach(treatment => {
            while (currentDayIndex < newSchedule.length) {
                const currentDay = newSchedule[currentDayIndex];

                if (currentDay.treatments.length < 3) {
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

                    if (['per', 'pul', 'C4'].includes(treatment.condition)) {
                        currentDayIndex++;
                    }

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
                newDate.setDate(lastDate.getDate() + 7);

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
                        newDate.setDate(lastDate.getDate() + 7);
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
        newDate.setDate(lastDate.getDate() + 7);

        setTreatmentSchedule([...treatmentSchedule, {
            date: newDate.toISOString().split('T')[0],
            treatments: []
        }]);
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
        autoScheduleEnabled,
        setAutoScheduleEnabled,
        aiPrompt,
        setAiPrompt,
        isGeneratingWorkflow,
        getConditionInfo,
        generateTreatmentNodes,
        executeAutoScheduling,
        canDropCard,
        isCardAvailableForDrag,
        handleDrop,
        removeFromSchedule,
        addTreatmentDay,
        addCondition,
        deleteCondition,
        addTreatment,
        deleteTreatment,
        moveTreatment,
        moveTreatment,
        changeTreatmentOption,
        clearAllConditions
    };
}
