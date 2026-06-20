import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { useTreatmentWorkflow } from './hooks/useTreatmentWorkflow';
import ToothChart from './components/ToothChart';
import ConditionSelector from './components/ConditionSelector';
import WorkflowBoard from './components/WorkflowBoard';
import ScheduleCalendar from './components/ScheduleCalendar';
import SettingsModal from './components/SettingsModal';

function App() {
    const [selectedTeeth, setSelectedTeeth] = useState([]);
    const [bulkConditionMode, setBulkConditionMode] = useState(false);
    const [draggedNode, setDraggedNode] = useState(null);
    const isDragSelectingRef = useRef(false);
    const longPressTimerRef = useRef(null);
    const [showSettings, setShowSettings] = useState(false);
    const [isConditionsOpen, setIsConditionsOpen] = useState(false);

    const {
        toothConditions,
        setToothConditions,
        workflow,
        treatmentSchedule,
        conditions,
        selectedTreatmentOptions,
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
        addStep,
        updateStep,
        deleteStep,
        changeTreatmentOption,
        clearAllConditions,
        clearAllSchedules,
        changeScheduleDate,
        splitToothFromNode,
        mergeToothToNode,
        mergeNodeToNode,
        toggleTreatmentCompletion,
        executeReschedulingFromDate
    } = useTreatmentWorkflow();

    // 病名が変更されたら自動的に治療ノードを生成（常にまとめモード）
    useEffect(() => {
        generateTreatmentNodes('grouped');
    }, [toothConditions, selectedTreatmentOptions]);

    // 歯クリック: 選択/解除トグル
    const handleToothClick = (toothNumber) => {
        if (isDragSelectingRef.current) return;
        setSelectedTeeth(prev =>
            prev.includes(toothNumber)
                ? prev.filter(t => t !== toothNumber)
                : [...prev, toothNumber]
        );
    };

    // 長押し+ドラッグ選択
    const handleToothPointerDown = (toothNumber) => {
        longPressTimerRef.current = setTimeout(() => {
            isDragSelectingRef.current = true;
            setSelectedTeeth(prev =>
                prev.includes(toothNumber) ? prev : [...prev, toothNumber]
            );
        }, 400);
    };

    const handleWindowPointerMove = useCallback((e) => {
        if (!isDragSelectingRef.current) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const toothEl = el?.closest('[data-tooth]');
        if (!toothEl) return;
        const n = Number(toothEl.dataset.tooth);
        if (n) setSelectedTeeth(prev => prev.includes(n) ? prev : [...prev, n]);
    }, []);

    const handleWindowPointerUp = useCallback(() => {
        clearTimeout(longPressTimerRef.current);
        isDragSelectingRef.current = false;
    }, []);

    useEffect(() => {
        window.addEventListener('pointermove', handleWindowPointerMove);
        window.addEventListener('pointerup', handleWindowPointerUp);
        return () => {
            window.removeEventListener('pointermove', handleWindowPointerMove);
            window.removeEventListener('pointerup', handleWindowPointerUp);
        };
    }, [handleWindowPointerMove, handleWindowPointerUp]);

    const handleConditionSelect = (conditionCode) => {
        if (bulkConditionMode) {
            const newToothNumber = `bulk-${conditionCode}-${Date.now()}`;
            setToothConditions(prev => ({
                ...prev,
                [newToothNumber]: [conditionCode]
            }));
            return;
        }

        if (selectedTeeth.length === 0) return;

        setToothConditions(prev => {
            const next = { ...prev };
            const allHaveIt = selectedTeeth.every(t => (next[t] || []).includes(conditionCode));

            selectedTeeth.forEach(tooth => {
                const current = next[tooth] || [];
                if (allHaveIt) {
                    const updated = current.filter(c => c !== conditionCode);
                    if (updated.length === 0) {
                        delete next[tooth];
                    } else {
                        next[tooth] = updated;
                    }
                } else {
                    const conflicting = checkExclusiveRules(conditionCode, current);
                    if (conflicting.length > 0) {
                        const conflictNames = conflicting.map(code => getConditionInfo(code)?.name || code).join('、');
                        if (!window.confirm(`歯番${tooth}の「${conflictNames}」を削除して「${getConditionInfo(conditionCode)?.name}」を設定しますか？`)) {
                            return;
                        }
                        next[tooth] = [...current.filter(c => !conflicting.includes(c)), conditionCode];
                    } else if (!current.includes(conditionCode)) {
                        next[tooth] = [...current, conditionCode];
                    }
                }
            });
            return next;
        });

        setSelectedTeeth([]);
    };

    const handleClearAll = () => {
        if (selectedTeeth.length === 0) return;
        const label = selectedTeeth.length === 1 ? `歯番${selectedTeeth[0]}` : `選択中の${selectedTeeth.length}本`;
        if (window.confirm(`${label}の病名をすべてクリアしますか？`)) {
            setToothConditions(prev => {
                const next = { ...prev };
                selectedTeeth.forEach(t => delete next[t]);
                return next;
            });
            setSelectedTeeth([]);
        }
    };

    const handleComplete = () => {
        setSelectedTeeth([]);
        setBulkConditionMode(false);
    };

    const handleGenerateWorkflow = () => {
        const result = generateTreatmentNodes('grouped');
        alert(`✅ 治療ノード生成完了！

📊 生成結果:
• 治療ノード: ${result.workflowSteps.length}件
• 対象歯: ${Object.keys(toothConditions).length}本
• 治療日程: ${result.initialSchedule.length}回分

次のステップ:
1. 手動でドラッグ&ドロップ配置、または
2. 自動配置ボタンで自動配置`);
    };

    const handleAutoScheduling = () => {
        const result = executeAutoScheduling();
        if (result.success) {
            alert(`⚡ 自動スケジューリング完了！

📊 結果:
• 配置された治療: ${result.totalAssigned}件 / ${result.totalTreatments}件
• ルールベース処理により配置しました

🎯 優先順位: 急性症状(per, pul) → 残根(C4) → う蝕(C3, C2) → 歯周病(P2, P1) → 初期う蝕(C1)`);
        } else {
            alert(`❌ ${result.message}`);
        }
    };

    const handleChangeTreatment = (step, newTreatmentIndex) => {
        changeTreatmentOption(step, newTreatmentIndex);
    };

    const handleDragStart = (e, node) => {
        setDraggedNode(node);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDropOnSchedule = (e, targetDate) => {
        e.preventDefault();
        if (!draggedNode) return;

        const result = handleDrop(draggedNode, targetDate);
        if (!result.success) {
            alert(result.message);
        }
        setDraggedNode(null);
    };

    // 歯式チップのドラッグ開始ハンドラ
    const handleToothChipDragStart = (e, data) => {
        // 歯式チップのドラッグデータは既にToothChipコンポーネントで設定済み
        // ここでは追加の処理があれば実行
    };

    // 歯式チップのドロップハンドラ
    const handleToothChipDrop = (dragData, targetNode) => {
        const result = mergeToothToNode(dragData, targetNode);

        if (result.success) {
            // 成功時は通知（オプション）
            // alert(result.message);
        } else {
            // エラー時は通知
            alert(result.message);
        }
    };

    // ノード全体のドロップハンドラ（ノード間の合体）
    const handleNodeDrop = (dragData, targetNode) => {
        // 自分自身へのドロップは無視
        if (dragData.nodeId === targetNode.id) {
            return;
        }

        // ドラッグされたノードの全ての歯を対象ノードにマージ
        const sourceNode = dragData.node;

        if (!sourceNode.teeth || sourceNode.teeth.length === 0) {
            alert('対象歯がないノードは合体できません');
            return;
        }

        // 新しいmergeNodeToNode関数を使用して、複数の歯を一度にマージ
        const result = mergeNodeToNode(dragData.nodeId, dragData.groupId, targetNode);

        if (!result.success) {
            alert(`ノードの合体に失敗しました: ${result.message}`);
        }
    };

    // 歯式チップをノード外にドロップして分離
    const handleToothChipDropToEmpty = (dragData, targetDate) => {
        const result = splitToothFromNode(dragData.nodeId, [dragData.tooth], targetDate);

        if (result.success) {
            // 成功時は通知（オプション）
            // alert(result.message);
        } else {
            // エラー時は通知
            alert(result.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-6xl mx-auto">
                {/* ヘッダー */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold text-gray-800">歯科治療ワークフロー生成</h1>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowSettings(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                <Settings className="w-4 h-4" />
                                設定
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* 歯式入力 */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-bold mb-4">歯式入力</h2>

                        {/* 歯式図 */}
                        <div className="mb-2 text-sm text-gray-500">
                            歯をクリックして選択（緑）→ 病名を選択。長押し+スライドで連続選択。
                        </div>
                        <ToothChart
                            toothConditions={toothConditions}
                            selectedTeeth={selectedTeeth}
                            onToothClick={handleToothClick}
                            onToothPointerDown={handleToothPointerDown}
                            getConditionInfo={getConditionInfo}
                        />

                        {/* すべてクリアボタン */}
                        <div className="mt-4 mb-4">
                            <button
                                onClick={() => {
                                    if (Object.keys(toothConditions).length === 0) return;
                                    clearAllConditions();
                                    setSelectedTeeth([]);
                                    setBulkConditionMode(false);
                                }}
                                disabled={Object.keys(toothConditions).length === 0}
                                className={`w-full px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
                                    Object.keys(toothConditions).length === 0
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-red-500 text-white hover:bg-red-600'
                                }`}
                            >
                                🗑️ すべての病名をクリア
                                {Object.keys(toothConditions).length > 0 && `（${Object.keys(toothConditions).length}件）`}
                            </button>
                        </div>

                        {/* 病名選択（歯が選択されているときに表示） */}
                        {(selectedTeeth.length > 0 || bulkConditionMode) && (
                            <ConditionSelector
                                conditions={
                                    bulkConditionMode ? conditions :
                                    selectedTeeth.length < 2
                                        ? conditions.filter(c => !['局部上', '局部下', '総義歯上', '総義歯下'].includes(c.code))
                                        : conditions
                                }
                                selectedTeeth={bulkConditionMode ? [] : selectedTeeth}
                                toothConditions={toothConditions}
                                onConditionSelect={handleConditionSelect}
                                onClearAll={handleClearAll}
                                onComplete={handleComplete}
                            />
                        )}

                        {/* 設定済み病名一覧 */}
                        {Object.keys(toothConditions).length > 0 && (
                            <div className="mt-4">
                                <button
                                    onClick={() => setIsConditionsOpen(!isConditionsOpen)}
                                    className="flex items-center gap-2 font-bold mb-2 hover:bg-gray-100 p-1 rounded transition-colors w-full text-left"
                                >
                                    {isConditionsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    <span>設定済み病名</span>
                                    <span className="text-xs font-normal text-gray-500 ml-2">
                                        ({Object.keys(toothConditions).length}件)
                                    </span>
                                </button>
                                
                                {isConditionsOpen && (
                                    <>
                                        <div className="space-y-2">
                                            {Object.entries(toothConditions).map(([tooth, conditionsList]) => {
                                                // 重複を排除してユニークな病名のみ取得
                                                const uniqueConditions = [...new Set(conditionsList)];
                                                const conditionInfos = uniqueConditions
                                                    .map(code => getConditionInfo(code))
                                                    .filter(Boolean);
                                                const isBulkEntry = tooth.startsWith('bulk-');
                                                const displayTooth = isBulkEntry ? '全般' : `歯番 ${tooth}`;
        
                                                return (
                                                    <div key={tooth} className={`p-3 rounded border ${isBulkEntry ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50'}`}>
                                                        <div className="flex justify-between items-start">
                                                            <span className="font-medium">
                                                                {displayTooth}
                                                                {isBulkEntry && (
                                                                    <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">
                                                                        歯番号なし
                                                                    </span>
                                                                )}
                                                            </span>
                                                            <div className="flex gap-2">
                                                                {!isBulkEntry && (
                                                                    <button
                                                                        onClick={() => {
                                                                            const n = Number(tooth);
                                                                            setSelectedTeeth(prev =>
                                                                                prev.includes(n) ? prev.filter(t => t !== n) : [...prev, n]
                                                                            );
                                                                        }}
                                                                        className="text-xs text-green-600 hover:text-green-800"
                                                                    >
                                                                        選択
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => {
                                                                        const newConditions = { ...toothConditions };
                                                                        delete newConditions[tooth];
                                                                        setToothConditions(newConditions);
                                                                    }}
                                                                    className="text-xs text-red-600 hover:text-red-800"
                                                                >
                                                                    削除
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                            {conditionInfos.map((info) => (
                                                                <span
                                                                    key={info.code}
                                                                    className={`text-xs px-2 py-1 rounded-full ${info.color}`}
                                                                >
                                                                    {info.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-3">
                                            <button
                                                onClick={() => setBulkConditionMode(true)}
                                                className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-xs hover:bg-yellow-200 transition-colors"
                                            >
                                                + 歯番号なしで病名追加
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 未スケジュール治療一覧（常時表示） */}
                    <WorkflowBoard
                        workflow={workflow}
                        treatmentSchedule={treatmentSchedule}
                        canDrag={isCardAvailableForDrag}
                        onDragStart={handleDragStart}
                        onChangeTreatment={handleChangeTreatment}
                        getConditionInfo={getConditionInfo}
                        onAutoSchedule={handleAutoScheduling}
                        isGenerating={isGeneratingWorkflow}
                        onToothChipDragStart={handleToothChipDragStart}
                        onToothChipDrop={handleToothChipDrop}
                        onToothChipDropToEmpty={handleToothChipDropToEmpty}
                        onNodeDrop={handleNodeDrop}
                        onToggleCompletion={toggleTreatmentCompletion}
                    />

                    {/* 治療スケジュール */}
                    {treatmentSchedule.length > 0 && (
                        <ScheduleCalendar
                            treatmentSchedule={treatmentSchedule}
                            onDragOver={handleDragOver}
                            onDrop={handleDropOnSchedule}
                            onRemoveFromSchedule={removeFromSchedule}
                            onAddDay={addTreatmentDay}
                            onDragStart={handleDragStart}
                            onChangeTreatment={handleChangeTreatment}
                            autoScheduleEnabled={autoScheduleEnabled}
                            getConditionInfo={getConditionInfo}
                            onClearAllSchedules={clearAllSchedules}
                            onChangeScheduleDate={changeScheduleDate}
                            onToothChipDragStart={handleToothChipDragStart}
                            onToothChipDrop={handleToothChipDrop}
                            onToothChipDropToEmpty={handleToothChipDropToEmpty}
                            onNodeDrop={handleNodeDrop}
                            onToggleCompletion={toggleTreatmentCompletion}
                            onRescheduleFromDate={executeReschedulingFromDate}
                            isGenerating={isGeneratingWorkflow}
                        />
                    )}
                </div>

                {/* 設定モーダル */}
                <SettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                    conditions={conditions}
                    treatmentRules={treatmentRules}
                    stepMaster={stepMaster}
                    onAddCondition={addCondition}
                    onUpdateCondition={updateCondition}
                    onDeleteCondition={deleteCondition}
                    onAddTreatment={addTreatment}
                    onUpdateTreatment={updateTreatment}
                    onDeleteTreatment={deleteTreatment}
                    onMoveTreatment={moveTreatment}
                    onAddStep={addStep}
                    onUpdateStep={updateStep}
                    onDeleteStep={deleteStep}
                    autoScheduleEnabled={autoScheduleEnabled}
                    onAutoScheduleChange={setAutoScheduleEnabled}
                    aiPrompt={aiPrompt}
                    onAiPromptChange={setAiPrompt}
                    schedulingRules={schedulingRules}
                    onSchedulingRulesChange={setSchedulingRules}
                    exclusiveRules={exclusiveRules}
                    onExclusiveRulesChange={setExclusiveRules}
                />
            </div>
        </div>
    );
}

export default App;
