import React, { useState, useEffect } from 'react';
import { Play, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { useTreatmentWorkflow } from './hooks/useTreatmentWorkflow';
import ToothChart from './components/ToothChart';
import ConditionSelector from './components/ConditionSelector';
import WorkflowBoard from './components/WorkflowBoard';
import ScheduleCalendar from './components/ScheduleCalendar';
import SettingsModal from './components/SettingsModal';

function App() {
    const [selectedTooth, setSelectedTooth] = useState(null);
    const [bulkConditionMode, setBulkConditionMode] = useState(false);
    const [treatmentGroupingMode, setTreatmentGroupingMode] = useState('individual');
    const [draggedNode, setDraggedNode] = useState(null);
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
        autoScheduleEnabled,
        setAutoScheduleEnabled,
        aiPrompt,
        setAiPrompt,
        isGeneratingWorkflow,
        schedulingRules,
        setSchedulingRules,
        getConditionInfo,
        generateTreatmentNodes,
        executeAutoScheduling,
        isCardAvailableForDrag,
        handleDrop,
        removeFromSchedule,
        addTreatmentDay,
        addCondition,
        deleteCondition,
        addTreatment,
        deleteTreatment,
        moveTreatment,
        changeTreatmentOption,
        clearAllConditions,
        clearAllSchedules
    } = useTreatmentWorkflow();

    // 病名が変更されたら自動的に治療ノードを生成
    useEffect(() => {
        if (Object.keys(toothConditions).length > 0) {
            generateTreatmentNodes(treatmentGroupingMode);
        } else {
            // 病名がすべて削除された場合はワークフローをクリア
            generateTreatmentNodes(treatmentGroupingMode); // 空のワークフローが生成される
        }
    }, [toothConditions, treatmentGroupingMode, selectedTreatmentOptions]);

    const handleToothClick = (toothNumber) => {
        setSelectedTooth(toothNumber);
    };

    // 病名優先モード: 選択した病名を歯に適用
    const [conditionFirstMode, setConditionFirstMode] = useState(false);
    const [selectedCondition, setSelectedCondition] = useState(null);
    const [selectedTeethForCondition, setSelectedTeethForCondition] = useState([]);

    const handleConditionSelect = (conditionCode) => {
        if (conditionFirstMode) {
            // 病名優先モード: 病名を選択
            setSelectedCondition(conditionCode);
            setSelectedTeethForCondition([]);
        } else if (bulkConditionMode) {
            const newToothNumber = `bulk-${conditionCode}-${Date.now()}`;
            setToothConditions(prev => ({
                ...prev,
                [newToothNumber]: [conditionCode]
            }));
        } else if (selectedTooth) {
            setToothConditions(prev => {
                const currentConditions = prev[selectedTooth] || [];
                let newConditions;
                if (currentConditions.includes(conditionCode)) {
                    newConditions = currentConditions.filter(c => c !== conditionCode);
                } else {
                    newConditions = [...currentConditions, conditionCode];
                }

                if (newConditions.length === 0) {
                    const newState = { ...prev };
                    delete newState[selectedTooth];
                    return newState;
                }

                return {
                    ...prev,
                    [selectedTooth]: newConditions
                };
            });
        }
    };

    // 病名優先モードで歯をクリックしたときの処理
    const handleToothClickForCondition = (toothNumber) => {
        if (conditionFirstMode && selectedCondition) {
            // 歯をクリックした瞬間に病名を適用/削除（トグル）
            setToothConditions(prev => {
                const currentConditions = prev[toothNumber] || [];
                let newConditions;

                if (currentConditions.includes(selectedCondition)) {
                    // 既に同じ病名がある場合は削除
                    newConditions = currentConditions.filter(c => c !== selectedCondition);
                } else {
                    // 病名を追加
                    newConditions = [...currentConditions, selectedCondition];
                }

                if (newConditions.length === 0) {
                    // 病名がなくなった場合は歯ごと削除
                    const newState = { ...prev };
                    delete newState[toothNumber];
                    return newState;
                }

                return {
                    ...prev,
                    [toothNumber]: newConditions
                };
            });

            // ハイライト表示用に選択状態を更新（視覚的フィードバック）
            setSelectedTeethForCondition(prev => {
                if (prev.includes(toothNumber)) {
                    return prev.filter(t => t !== toothNumber);
                } else {
                    return [...prev, toothNumber];
                }
            });
        } else {
            handleToothClick(toothNumber);
        }
    };

    // 病名優先モードをリセット
    const resetConditionFirstMode = () => {
        setConditionFirstMode(false);
        setSelectedCondition(null);
        setSelectedTeethForCondition([]);
    };

    const handleClearAll = () => {
        if (selectedTooth) {
            if (window.confirm('この歯の病名をすべてクリアしますか？')) {
                const newConditions = { ...toothConditions };
                delete newConditions[selectedTooth];
                setToothConditions(newConditions);
            }
        }
    };

    const handleComplete = () => {
        setSelectedTooth(null);
        setBulkConditionMode(false);
    };

    const handleGenerateWorkflow = () => {
        const result = generateTreatmentNodes(treatmentGroupingMode);
        alert(`✅ 治療ノード生成完了！

📊 生成結果:
• 治療ノード: ${result.workflowSteps.length}件
• 対象歯: ${Object.keys(toothConditions).length}本
• 治療日程: ${result.initialSchedule.length}回分
• グループ化: ${treatmentGroupingMode === 'individual' ? '個別' : 'まとめ'}

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
                            <button
                                onClick={handleGenerateWorkflow}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                <Play className="w-4 h-4" />
                                治療ノード生成
                            </button>
                            <button
                                onClick={handleAutoScheduling}
                                disabled={isGeneratingWorkflow || workflow.length === 0}
                                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors ${isGeneratingWorkflow || workflow.length === 0
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-purple-500 hover:bg-purple-600'
                                    }`}
                            >
                                <span className="text-lg">🤖</span>
                                {isGeneratingWorkflow ? '配置中...' : '自動配置'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* 歯式入力 */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-bold mb-4">歯式入力</h2>

                        {/* 治療ノード設定 */}
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-blue-900">治療ノード設定</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-blue-800 mb-2">
                                        複数歯の同じ病名
                                    </label>
                                    <div className="space-y-2">
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="groupingMode"
                                                value="individual"
                                                checked={treatmentGroupingMode === 'individual'}
                                                onChange={(e) => setTreatmentGroupingMode(e.target.value)}
                                                className="mr-2"
                                            />
                                            <span className="text-sm">個別ノード（歯ごとに分離）</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="groupingMode"
                                                value="grouped"
                                                checked={treatmentGroupingMode === 'grouped'}
                                                onChange={(e) => setTreatmentGroupingMode(e.target.value)}
                                                className="mr-2"
                                            />
                                            <span className="text-sm">まとめノード（同じ治療をまとめる）</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-blue-800 mb-2">
                                        入力モード
                                    </label>
                                    <div className="space-y-2">
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="inputMode"
                                                value="toothFirst"
                                                checked={!conditionFirstMode && !bulkConditionMode}
                                                onChange={() => { setConditionFirstMode(false); setBulkConditionMode(false); resetConditionFirstMode(); }}
                                                className="mr-2"
                                            />
                                            <span className="text-sm">歯優先（歯を選んで病名）</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="inputMode"
                                                value="conditionFirst"
                                                checked={conditionFirstMode}
                                                onChange={() => { setConditionFirstMode(true); setBulkConditionMode(false); setSelectedTooth(null); }}
                                                className="mr-2"
                                            />
                                            <span className="text-sm">病名優先（病名を選んで複数の歯に一括設定）</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 歯式図 */}
                        <ToothChart
                            toothConditions={toothConditions}
                            selectedTooth={conditionFirstMode ? null : selectedTooth}
                            onToothClick={handleToothClickForCondition}
                            getConditionInfo={getConditionInfo}
                            highlightedTeeth={conditionFirstMode ? selectedTeethForCondition : []}
                        />

                        {/* すべてクリアボタン（常に表示） */}
                        <div className="mt-4 mb-4">
                            <button
                                onClick={() => {
                                    if (Object.keys(toothConditions).length === 0) return;
                                    const confirmed = window.confirm('設定済みの病名をすべて削除しますか？\nこの操作は取り消せません。');
                                    if (confirmed) {
                                        clearAllConditions();
                                        setSelectedTooth(null);
                                        setBulkConditionMode(false);
                                        resetConditionFirstMode();
                                    }
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

                        {/* 病名優先モードのUI */}
                        {conditionFirstMode && (
                            <div className="mt-4 mb-4 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                                <h3 className="font-bold text-green-900 mb-3">
                                    病名優先モード - {selectedCondition
                                        ? `「${getConditionInfo(selectedCondition)?.name}」を選択中`
                                        : '病名を選択してください'}
                                </h3>

                                {/* 病名選択ボタン */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                                    {conditions.map(condition => (
                                        <button
                                            key={condition.code}
                                            onClick={() => handleConditionSelect(condition.code)}
                                            className={`px-3 py-2 border rounded transition-all text-sm ${selectedCondition === condition.code
                                                ? `${condition.color} ring-2 ring-green-500`
                                                : 'bg-white border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            {condition.symbol}（{condition.name.split('（')[1]?.replace('）', '') || condition.name}）
                                        </button>
                                    ))}
                                </div>

                                {selectedCondition && (
                                    <>
                                        <div className="text-sm text-green-700 mb-2">
                                            💡 上の歯式図で歯をクリックすると即座に病名が適用されます
                                        </div>
                                        <div className="text-xs text-green-600 mb-2">
                                            • もう一度クリックすると病名が削除されます<br />
                                            • 別の病名を選んで、そのまま歯をクリックできます
                                        </div>
                                        {selectedTeethForCondition.length > 0 && (
                                            <div className="flex items-center gap-2 mb-3 p-2 bg-green-100 rounded">
                                                <span className="text-sm font-medium text-green-800">
                                                    ✓ 適用済みの歯: {selectedTeethForCondition.sort((a, b) => a - b).join(', ')}
                                                </span>
                                                <button
                                                    onClick={() => setSelectedTeethForCondition([])}
                                                    className="px-3 py-1 bg-white text-gray-700 rounded hover:bg-gray-100 transition-colors text-xs border border-green-300"
                                                >
                                                    表示クリア
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}

                                <button
                                    onClick={resetConditionFirstMode}
                                    className="text-sm text-green-700 underline hover:text-green-900"
                                >
                                    病名優先モードを終了
                                </button>
                            </div>
                        )}

                        {/* 病名選択 */}
                        {!conditionFirstMode && (selectedTooth || bulkConditionMode) && (
                            <ConditionSelector
                                conditions={conditions}
                                selectedTooth={selectedTooth}
                                bulkConditionMode={bulkConditionMode}
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
                                                                        onClick={() => setSelectedTooth(tooth)}
                                                                        className="text-xs text-blue-600 hover:text-blue-800"
                                                                    >
                                                                        編集
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

                    {/* 未スケジュール治療一覧 */}
                    {workflow.length > 0 && (
                        <WorkflowBoard
                            workflow={workflow}
                            treatmentSchedule={treatmentSchedule}
                            canDrag={isCardAvailableForDrag}
                            onDragStart={handleDragStart}
                            onChangeTreatment={handleChangeTreatment}
                            getConditionInfo={getConditionInfo}
                        />
                    )}

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
                        />
                    )}
                </div>

                {/* 設定モーダル */}
                <SettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                    conditions={conditions}
                    treatmentRules={treatmentRules}
                    onAddCondition={addCondition}
                    onDeleteCondition={deleteCondition}
                    onAddTreatment={addTreatment}
                    onDeleteTreatment={deleteTreatment}
                    onMoveTreatment={moveTreatment}
                    autoScheduleEnabled={autoScheduleEnabled}
                    onAutoScheduleChange={setAutoScheduleEnabled}
                    aiPrompt={aiPrompt}
                    onAiPromptChange={setAiPrompt}
                    schedulingRules={schedulingRules}
                    onSchedulingRulesChange={setSchedulingRules}
                />
            </div>
        </div>
    );
}

export default App;
