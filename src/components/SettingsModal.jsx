import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const colorOptions = [
    { value: 'bg-yellow-100 border-yellow-400 text-yellow-800', label: '黄色' },
    { value: 'bg-orange-100 border-orange-400 text-orange-800', label: 'オレンジ' },
    { value: 'bg-red-100 border-red-400 text-red-800', label: '赤' },
    { value: 'bg-pink-100 border-pink-400 text-pink-800', label: 'ピンク' },
    { value: 'bg-purple-100 border-purple-400 text-purple-800', label: '紫' },
    { value: 'bg-blue-100 border-blue-400 text-blue-800', label: '青' },
    { value: 'bg-green-100 border-green-400 text-green-800', label: '緑' },
    { value: 'bg-gray-100 border-gray-400 text-gray-800', label: 'グレー' }
];

export default function SettingsModal({
    isOpen,
    onClose,
    conditions,
    treatmentRules,
    stepMaster,
    onAddCondition,
    onUpdateCondition,
    onDeleteCondition,
    onAddTreatment,
    onUpdateTreatment,
    onDeleteTreatment,
    onMoveTreatment,
    onAddStep,
    onUpdateStep,
    onDeleteStep,
    autoScheduleEnabled,
    onAutoScheduleChange,
    aiPrompt,
    onAiPromptChange,
    schedulingRules,
    onSchedulingRulesChange,
    exclusiveRules,
    onExclusiveRulesChange
}) {
    const [newCondition, setNewCondition] = useState({
        code: '',
        name: '',
        symbol: '',
        color: 'bg-gray-100 border-gray-400 text-gray-800'
    });
    const [newTreatment, setNewTreatment] = useState({
        conditionCode: '',
        name: '',
        stepIds: []
    });
    const [newStep, setNewStep] = useState({
        name: '',
        conditionCodes: [],
        description: ''
    });
    // グループベースの排他的病名ルール作成用の状態
    // 各グループは病名コードの配列
    const [selectedExclusiveGroups, setSelectedExclusiveGroups] = useState([[]]);

    // 編集モードの状態
    const [editingConditionCode, setEditingConditionCode] = useState(null);
    const [editingTreatmentIndex, setEditingTreatmentIndex] = useState(null);
    const [editingStepId, setEditingStepId] = useState(null);

    // AI設定の開閉状態
    const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);

    if (!isOpen) return null;

    const handleAddCondition = () => {
        if (newCondition.code && newCondition.name && newCondition.symbol) {
            onAddCondition(newCondition);
            setNewCondition({ code: '', name: '', symbol: '', color: 'bg-gray-100 border-gray-400 text-gray-800' });
        }
    };

    const handleEditCondition = (condition) => {
        setEditingConditionCode(condition.code);
        setNewCondition({ ...condition });
    };

    const handleUpdateCondition = () => {
        if (newCondition.code && newCondition.name && newCondition.symbol) {
            onUpdateCondition(editingConditionCode, newCondition);
            setNewCondition({ code: '', name: '', symbol: '', color: 'bg-gray-100 border-gray-400 text-gray-800' });
            setEditingConditionCode(null);
        }
    };

    const cancelEditCondition = () => {
        setNewCondition({ code: '', name: '', symbol: '', color: 'bg-gray-100 border-gray-400 text-gray-800' });
        setEditingConditionCode(null);
    };

    const handleAddTreatment = () => {
        if (newTreatment.conditionCode && newTreatment.name && newTreatment.stepIds.length > 0) {
            onAddTreatment(newTreatment.conditionCode, {
                name: newTreatment.name,
                duration: newTreatment.stepIds.length,
                stepIds: newTreatment.stepIds
            });
            setNewTreatment({ conditionCode: '', name: '', stepIds: [] });
        }
    };

    const handleEditTreatment = (conditionCode, index, treatment) => {
        setEditingTreatmentIndex({ conditionCode, index });
        setNewTreatment({
            conditionCode: conditionCode,
            name: treatment.name,
            stepIds: [...(treatment.stepIds || [])]
        });
    };

    const handleUpdateTreatment = () => {
        if (newTreatment.conditionCode && newTreatment.name && newTreatment.stepIds.length > 0) {
            onUpdateTreatment(editingTreatmentIndex.conditionCode, editingTreatmentIndex.index, {
                name: newTreatment.name,
                duration: newTreatment.stepIds.length,
                stepIds: newTreatment.stepIds
            });
            setNewTreatment({ conditionCode: '', name: '', stepIds: [] });
            setEditingTreatmentIndex(null);
        }
    };

    const cancelEditTreatment = () => {
        setNewTreatment({ conditionCode: '', name: '', stepIds: [] });
        setEditingTreatmentIndex(null);
    };

    const addTreatmentStep = (stepId) => {
        if (!newTreatment.stepIds.includes(stepId)) {
            setNewTreatment(prev => ({ ...prev, stepIds: [...prev.stepIds, stepId] }));
        }
    };

    const removeTreatmentStep = (index) => {
        setNewTreatment(prev => ({
            ...prev,
            stepIds: prev.stepIds.filter((_, i) => i !== index)
        }));
    };

    const moveTreatmentStep = (fromIndex, toIndex) => {
        setNewTreatment(prev => {
            const newStepIds = [...prev.stepIds];
            const [moved] = newStepIds.splice(fromIndex, 1);
            newStepIds.splice(toIndex, 0, moved);
            return { ...prev, stepIds: newStepIds };
        });
    };

    // ステップマスター管理用のハンドラー
    const handleAddStep = () => {
        if (newStep.name && newStep.conditionCodes.length > 0) {
            const step = {
                id: `step${String(Date.now()).slice(-3)}${String(Math.random()).slice(2, 5)}`,
                name: newStep.name,
                conditionCodes: newStep.conditionCodes,
                description: newStep.description
            };
            onAddStep(step);
            setNewStep({ name: '', conditionCodes: [], description: '' });
        }
    };

    const handleEditStep = (step) => {
        setEditingStepId(step.id);
        setNewStep({
            name: step.name,
            conditionCodes: [...step.conditionCodes],
            description: step.description || ''
        });
    };

    const handleUpdateStep = () => {
        if (newStep.name && newStep.conditionCodes.length > 0) {
            const updatedStep = {
                id: editingStepId,
                name: newStep.name,
                conditionCodes: newStep.conditionCodes,
                description: newStep.description
            };
            onUpdateStep(editingStepId, updatedStep);
            setNewStep({ name: '', conditionCodes: [], description: '' });
            setEditingStepId(null);
        }
    };

    const cancelEditStep = () => {
        setNewStep({ name: '', conditionCodes: [], description: '' });
        setEditingStepId(null);
    };

    const toggleStepCondition = (conditionCode) => {
        setNewStep(prev => ({
            ...prev,
            conditionCodes: prev.conditionCodes.includes(conditionCode)
                ? prev.conditionCodes.filter(c => c !== conditionCode)
                : [...prev.conditionCodes, conditionCode]
        }));
    };

    return (
         <div className="fixed inset-0 bg-white overflow-hidden z-50">
            <div className="w-full h-full p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">病名・治療法設定</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                        title="設定を閉じる"
                    >
                        ×
                    </button>
                </div>

                {/* AIワークフロー生成設定 */}
                <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                    <button
                        onClick={() => setIsAiSettingsOpen(!isAiSettingsOpen)}
                        className="w-full flex items-center justify-between text-left mb-1"
                    >
                        <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                            {isAiSettingsOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                            🤖 AI治療スケジューリング
                            <span className="text-sm font-normal text-red-500 ml-2">(未実装)</span>
                        </h3>
                    </button>
                    
                    {isAiSettingsOpen && (
                        <div className="mt-3 space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-purple-800 mb-2">
                                    治療方針・制約プロンプト
                                </label>
                                <textarea
                                    value={aiPrompt}
                                    onChange={(e) => onAiPromptChange(e.target.value)}
                                    placeholder="例：患者の痛みを最優先に、急性症状から治療してください。根管治療は週1回ペース、補綴物は2週間隔で進めてください。"
                                    className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    rows={3}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-purple-700">
                                <div>
                                    <div className="font-medium mb-1">💡 使用例</div>
                                    <ul className="space-y-1 list-disc list-inside">
                                        <li>「痛みのある歯を最優先で治療」</li>
                                        <li>「右側から先に治療して左側で噛めるように」</li>
                                        <li>「根管治療は週1回、印象は2週間間隔で」</li>
                                    </ul>
                                </div>
                                <div>
                                    <div className="font-medium mb-1">🔧 動作確認</div>
                                    <ul className="space-y-1 list-disc list-inside">
                                        <li>歯式入力完了後に生成ボタンを押す</li>
                                        <li>ブラウザのコンソールでログ確認可能</li>
                                        <li>エラー時は詳細情報を表示</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ルールベース自動配置設定 */}
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="text-lg font-bold text-green-900 mb-3 flex items-center gap-2">
                        ⚙️ ルールベース自動配置設定
                    </h3>

                    <div className="space-y-4">
                        {/* 基本設定 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-green-800 mb-2">
                                    1日の最大治療数
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={schedulingRules.maxTreatmentsPerDay}
                                    onChange={(e) => onSchedulingRulesChange({
                                        ...schedulingRules,
                                        maxTreatmentsPerDay: parseInt(e.target.value) || 1
                                    })}
                                    className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-green-800 mb-2">
                                    スケジュール間隔（日数）
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={schedulingRules.scheduleIntervalDays}
                                    onChange={(e) => onSchedulingRulesChange({
                                        ...schedulingRules,
                                        scheduleIntervalDays: parseInt(e.target.value) || 1
                                    })}
                                    className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                                <p className="text-xs text-green-600 mt-1">治療日の間隔を設定します</p>
                            </div>
                        </div>

                        {/* 急性症状設定 */}
                        <div>
                            <label className="block text-sm font-medium text-green-800 mb-2">
                                急性症状として扱う病名（1日の配置数を制限）
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {conditions.map(condition => (
                                    <label
                                        key={condition.code}
                                        className="flex items-center gap-1 px-2 py-1 border rounded cursor-pointer hover:bg-green-100 transition-colors text-sm"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={schedulingRules.acuteCareConditions.includes(condition.code)}
                                            onChange={(e) => {
                                                const newConditions = e.target.checked
                                                    ? [...schedulingRules.acuteCareConditions, condition.code]
                                                    : schedulingRules.acuteCareConditions.filter(c => c !== condition.code);
                                                onSchedulingRulesChange({
                                                    ...schedulingRules,
                                                    acuteCareConditions: newConditions
                                                });
                                            }}
                                            className="mr-1"
                                        />
                                        {condition.symbol}
                                    </label>
                                ))}
                            </div>
                            <div className="mt-2">
                                <label className="block text-sm font-medium text-green-800 mb-2">
                                    急性症状の1日最大治療数
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={schedulingRules.acuteCareMaxPerDay}
                                    onChange={(e) => onSchedulingRulesChange({
                                        ...schedulingRules,
                                        acuteCareMaxPerDay: parseInt(e.target.value) || 1
                                    })}
                                    className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                            </div>
                        </div>

                        {/* 優先順位設定 */}
                        <div>
                            <label className="block text-sm font-medium text-green-800 mb-2">
                                治療優先順位（上から優先度が高い）
                            </label>
                            <div className="space-y-2">
                                {schedulingRules.priorityOrder.map((code, index) => {
                                    const condition = conditions.find(c => c.code === code);
                                    return (
                                        <div key={code} className="flex items-center gap-2 p-2 bg-white border border-green-200 rounded">
                                            <span className="text-sm font-medium text-gray-500 w-6">{index + 1}.</span>
                                            <span className={`flex-1 px-3 py-1 rounded text-sm ${condition?.color || 'bg-gray-100'}`}>
                                                {condition?.symbol || code} - {condition?.name || code}
                                            </span>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => {
                                                        if (index > 0) {
                                                            const newOrder = [...schedulingRules.priorityOrder];
                                                            [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                                                            onSchedulingRulesChange({
                                                                ...schedulingRules,
                                                                priorityOrder: newOrder
                                                            });
                                                        }
                                                    }}
                                                    disabled={index === 0}
                                                    className={`px-2 py-1 text-xs rounded ${index === 0 ? 'bg-gray-200 text-gray-400' : 'bg-green-500 text-white hover:bg-green-600'}`}
                                                >
                                                    ↑
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (index < schedulingRules.priorityOrder.length - 1) {
                                                            const newOrder = [...schedulingRules.priorityOrder];
                                                            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                                                            onSchedulingRulesChange({
                                                                ...schedulingRules,
                                                                priorityOrder: newOrder
                                                            });
                                                        }
                                                    }}
                                                    disabled={index === schedulingRules.priorityOrder.length - 1}
                                                    className={`px-2 py-1 text-xs rounded ${index === schedulingRules.priorityOrder.length - 1 ? 'bg-gray-200 text-gray-400' : 'bg-green-500 text-white hover:bg-green-600'}`}
                                                >
                                                    ↓
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="text-xs text-green-700 bg-green-100 p-3 rounded">
                            <p className="font-medium mb-1">💡 ルールベース自動配置について</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>設定した優先順位に従って治療を自動配置します</li>
                                <li>急性症状は1日の配置数を制限できます</li>
                                <li>シーケンシャル治療は前のステップが配置済みの場合のみ配置されます</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* 自動スケジューリング設定 */}
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-blue-900 mb-1">自動スケジューリング</h3>
                            <p className="text-sm text-blue-700">
                                複数ステップ治療の1回目を配置時に、残りのステップを自動的に後日に配置します
                            </p>
                        </div>
                        <div className="flex items-center">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={autoScheduleEnabled}
                                    onChange={(e) => onAutoScheduleChange(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                <span className="ml-3 text-sm font-medium text-blue-900">
                                    {autoScheduleEnabled ? 'ON' : 'OFF'}
                                </span>
                            </label>
                        </div>
                    </div>
                    {autoScheduleEnabled && (
                        <div className="mt-2 text-xs text-blue-600">
                            💡 例：インレーの「印象採得」を第1回目に配置すると、「セット」が自動的に第2回目に配置されます
                        </div>
                    )}
                </div>

                {/* 排他的病名ルール設定 */}
                <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <h3 className="text-lg font-bold text-orange-900 mb-3 flex items-center gap-2">
                        🚫 排他的病名ルール設定（グループ間排他）
                    </h3>
                    <p className="text-sm text-orange-700 mb-4">
                        グループ間で排他的な病名を設定します。同じグループ内の病名は同時設定可能です。<br />
                        <span className="text-xs">例：C1⇄C2⇄C3⇄C4（すべて相互排他）、欠損⇄(C1&P1)（C1とP1は同時設定可だが欠損とは排他）</span>
                    </p>

                    <div className="space-y-3">
                        {/* 既存ルールの表示 */}
                        {exclusiveRules.map((rule, ruleIndex) => (
                            <div key={ruleIndex} className="flex items-center gap-2 p-3 bg-white border border-orange-200 rounded">
                                <span className="text-sm font-medium text-gray-500 w-6">{ruleIndex + 1}.</span>
                                <div className="flex-1 flex items-center gap-2 flex-wrap">
                                    {rule.map((group, groupIndex) => (
                                        <React.Fragment key={groupIndex}>
                                            {groupIndex > 0 && <span className="text-gray-400 font-bold">⇄</span>}
                                            <div className="flex items-center gap-1">
                                                {group.length > 1 && <span className="text-xs text-gray-500">(</span>}
                                                {group.map((code, codeIndex) => {
                                                    const condition = conditions.find(c => c.code === code);
                                                    return (
                                                        <React.Fragment key={code}>
                                                            {codeIndex > 0 && <span className="text-xs text-gray-500">&</span>}
                                                            <span className={`px-2 py-1 rounded text-xs ${condition?.color || 'bg-gray-100'}`}>
                                                                {condition?.symbol || code}
                                                            </span>
                                                        </React.Fragment>
                                                    );
                                                })}
                                                {group.length > 1 && <span className="text-xs text-gray-500">)</span>}
                                            </div>
                                        </React.Fragment>
                                    ))}
                                </div>
                                <button
                                    onClick={() => {
                                        const newRules = exclusiveRules.filter((_, i) => i !== ruleIndex);
                                        onExclusiveRulesChange(newRules);
                                    }}
                                    className="px-2 py-1 text-xs text-red-600 hover:text-red-800"
                                >
                                    削除
                                </button>
                            </div>
                        ))}

                        {/* 新規ルール追加 */}
                        <div className="p-3 bg-white border-2 border-dashed border-orange-300 rounded">
                            <div className="text-sm font-medium text-orange-800 mb-3">新しいルールを追加（グループベース）</div>

                            {/* グループ一覧 */}
                            <div className="space-y-2 mb-3">
                                {selectedExclusiveGroups.map((group, groupIndex) => (
                                    <div key={groupIndex} className="p-3 bg-orange-50 border border-orange-200 rounded">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-orange-800">
                                                グループ {groupIndex + 1}
                                                {group.length > 0 && <span className="ml-2 text-xs text-orange-600">({group.length}個選択)</span>}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    if (selectedExclusiveGroups.length > 1) {
                                                        setSelectedExclusiveGroups(prev => prev.filter((_, i) => i !== groupIndex));
                                                    }
                                                }}
                                                disabled={selectedExclusiveGroups.length <= 1}
                                                className={`text-xs px-2 py-1 rounded ${
                                                    selectedExclusiveGroups.length <= 1
                                                        ? 'text-gray-400 cursor-not-allowed'
                                                        : 'text-red-600 hover:text-red-800 hover:bg-red-50'
                                                }`}
                                            >
                                                グループ削除
                                            </button>
                                        </div>

                                        {/* 選択中の病名表示 */}
                                        {group.length > 0 && (
                                            <div className="mb-2 flex flex-wrap gap-1">
                                                {group.map(code => {
                                                    const condition = conditions.find(c => c.code === code);
                                                    return (
                                                        <span key={code} className={`px-2 py-1 rounded text-xs ${condition?.color || 'bg-gray-100'} flex items-center gap-1`}>
                                                            {condition?.symbol || code}
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedExclusiveGroups(prev => {
                                                                        const newGroups = [...prev];
                                                                        newGroups[groupIndex] = newGroups[groupIndex].filter(c => c !== code);
                                                                        return newGroups;
                                                                    });
                                                                }}
                                                                className="text-red-600 hover:text-red-800 ml-1"
                                                            >
                                                                ×
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* 病名選択チェックボックス */}
                                        <div className="grid grid-cols-3 md:grid-cols-5 gap-1 max-h-32 overflow-y-auto p-2 bg-white border border-orange-200 rounded">
                                            {conditions.map(condition => (
                                                <label
                                                    key={condition.code}
                                                    className={`flex items-center gap-1 p-1 rounded cursor-pointer transition-colors text-xs ${
                                                        group.includes(condition.code)
                                                            ? `${condition.color} ring-1 ring-orange-500`
                                                            : 'hover:bg-orange-50'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={group.includes(condition.code)}
                                                        onChange={(e) => {
                                                            setSelectedExclusiveGroups(prev => {
                                                                const newGroups = [...prev];
                                                                if (e.target.checked) {
                                                                    // 他のグループから削除
                                                                    newGroups.forEach((g, i) => {
                                                                        if (i !== groupIndex) {
                                                                            newGroups[i] = g.filter(c => c !== condition.code);
                                                                        }
                                                                    });
                                                                    // このグループに追加
                                                                    newGroups[groupIndex] = [...newGroups[groupIndex], condition.code];
                                                                } else {
                                                                    // このグループから削除
                                                                    newGroups[groupIndex] = newGroups[groupIndex].filter(c => c !== condition.code);
                                                                }
                                                                return newGroups;
                                                            });
                                                        }}
                                                        className="rounded"
                                                    />
                                                    <span className="text-xs">{condition.symbol}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* グループ追加ボタン */}
                            <button
                                onClick={() => setSelectedExclusiveGroups(prev => [...prev, []])}
                                className="w-full px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium mb-3"
                            >
                                + グループを追加
                            </button>

                            {/* ルール追加ボタン */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        // バリデーション
                                        const validGroups = selectedExclusiveGroups.filter(g => g.length > 0);
                                        if (validGroups.length < 2) {
                                            alert('2つ以上のグループに病名を設定してください。');
                                            return;
                                        }

                                        // 重複チェック
                                        const isDuplicate = exclusiveRules.some(rule => {
                                            if (rule.length !== validGroups.length) return false;
                                            return validGroups.every(group => {
                                                return rule.some(ruleGroup => {
                                                    if (ruleGroup.length !== group.length) return false;
                                                    return group.every(code => ruleGroup.includes(code));
                                                });
                                            });
                                        });

                                        if (!isDuplicate) {
                                            onExclusiveRulesChange([...exclusiveRules, validGroups]);
                                            setSelectedExclusiveGroups([[]]);
                                        } else {
                                            alert('このルールは既に設定されています。');
                                        }
                                    }}
                                    className="flex-1 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm font-medium"
                                >
                                    ルールを追加
                                </button>
                                <button
                                    onClick={() => setSelectedExclusiveGroups([[]])}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                                >
                                    クリア
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 text-xs text-orange-700 bg-orange-100 p-3 rounded">
                        <p className="font-medium mb-1">💡 グループベース排他的病名ルールについて</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>グループを作成し、各グループに病名を設定します</li>
                            <li>同じグループ内の病名は同時に設定できます（例：C1&P1）</li>
                            <li>異なるグループの病名は排他的です（例：欠損⇄(C1&P1)）</li>
                            <li>最低2つのグループが必要です</li>
                            <li>各病名は1つのグループにのみ設定できます</li>
                        </ul>
                    </div>
                </div>

                {/* ステップマスター設定 */}
                <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <h3 className="text-lg font-bold text-purple-900 mb-3 flex items-center gap-2">
                        📋 ステップマスター
                    </h3>
                    <p className="text-sm text-purple-700 mb-4">
                        治療で使用するステップを登録し、対象病名を選択します。ステップは治療法マスターから参照できます。
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* ステップ追加・編集フォーム */}
                        <div className={`border rounded-lg p-4 ${editingStepId ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-purple-200'}`}>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-medium text-purple-900">{editingStepId ? 'ステップを編集' : '新しいステップを追加'}</h4>
                                {editingStepId && (
                                    <button onClick={cancelEditStep} className="text-xs text-gray-500 hover:text-gray-700">キャンセル</button>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-purple-800 mb-1">ステップ名</label>
                                    <input
                                        type="text"
                                        placeholder="例：フッ素塗布、印象採得"
                                        value={newStep.name}
                                        onChange={(e) => setNewStep(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-3 py-2 border border-purple-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-purple-800 mb-2">
                                        対象病名（複数選択可）
                                        {newStep.conditionCodes.length > 0 && (
                                            <span className="ml-2 text-xs text-purple-600">
                                                {newStep.conditionCodes.length}個選択中
                                            </span>
                                        )}
                                    </label>
                                    <div className="grid grid-cols-2 gap-1 p-2 bg-white border border-purple-200 rounded max-h-40 overflow-y-auto">
                                        {conditions.map(condition => (
                                            <label
                                                key={condition.code}
                                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ${
                                                    newStep.conditionCodes.includes(condition.code)
                                                        ? `${condition.color} ring-1 ring-purple-500`
                                                        : 'hover:bg-purple-50'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={newStep.conditionCodes.includes(condition.code)}
                                                    onChange={() => toggleStepCondition(condition.code)}
                                                    className="rounded"
                                                />
                                                <span className="text-xs">{condition.symbol}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={editingStepId ? handleUpdateStep : handleAddStep}
                                    className={`w-full px-3 py-2 text-white rounded text-sm ${
                                        editingStepId
                                            ? 'bg-yellow-500 hover:bg-yellow-600'
                                            : 'bg-purple-500 hover:bg-purple-600'
                                    }`}
                                >
                                    {editingStepId ? 'ステップを更新' : 'ステップを追加'}
                                </button>
                            </div>
                        </div>

                        {/* ステップ一覧 */}
                        <div>
                            <h4 className="font-medium text-purple-900 mb-3">登録済みステップ一覧</h4>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {stepMaster && stepMaster.filter(step => step.id !== 'step00').length > 0 ? (
                                    stepMaster.filter(step => step.id !== 'step00').map(step => (
                                        <div key={step.id} className="bg-white p-3 rounded border border-purple-200 hover:border-purple-400 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm text-purple-900">{step.name}</div>
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {step.conditionCodes.map(code => {
                                                            const condition = conditions.find(c => c.code === code);
                                                            return (
                                                                <span
                                                                    key={code}
                                                                    className={`px-2 py-1 rounded text-xs ${condition?.color || 'bg-gray-100'}`}
                                                                >
                                                                    {condition?.symbol || code}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 ml-2">
                                                    <button
                                                        onClick={() => handleEditStep(step)}
                                                        className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1"
                                                        disabled={!!editingStepId}
                                                    >
                                                        編集
                                                    </button>
                                                    <button
                                                        onClick={() => onDeleteStep(step.id)}
                                                        className="text-red-500 hover:text-red-700 text-xs px-2 py-1"
                                                        disabled={!!editingStepId}
                                                    >
                                                        削除
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-gray-500 text-center py-4">
                                        ステップがまだ登録されていません
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 text-xs text-purple-700 bg-purple-100 p-3 rounded">
                        <p className="font-medium mb-1">💡 ステップマスターについて</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>治療で使用するステップを一元管理できます</li>
                            <li>各ステップは複数の病名に対して使用可能です</li>
                            <li>治療法マスターで病名を選ぶと、対応するステップのみ選択できます</li>
                        </ul>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 病名設定 */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 className="text-lg font-bold mb-3 text-blue-900 flex items-center gap-2">
                            🏥 病名マスター
                        </h3>

                        {/* 新しい病名追加 */}
                        {/* 新しい病名追加・編集 */}
                        <div className={`border rounded-lg p-4 mb-4 ${editingConditionCode ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-blue-200'}`}>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-medium">{editingConditionCode ? '病名を編集' : '新しい病名を追加'}</h4>
                                {editingConditionCode && (
                                    <button onClick={cancelEditCondition} className="text-xs text-gray-500 hover:text-gray-700">キャンセル</button>
                                )}
                            </div>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    placeholder="病名コード（例：C1）"
                                    value={newCondition.code}
                                    onChange={(e) => setNewCondition(prev => ({ ...prev, code: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded text-sm"
                                    disabled={!!editingConditionCode} // 編集時はコード変更不可
                                />
                                <input
                                    type="text"
                                    placeholder="病名（例：C1（初期う蝕））"
                                    value={newCondition.name}
                                    onChange={(e) => setNewCondition(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded text-sm"
                                />
                                <input
                                    type="text"
                                    placeholder="表示記号（例：C1）"
                                    value={newCondition.symbol}
                                    onChange={(e) => setNewCondition(prev => ({ ...prev, symbol: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded text-sm"
                                />
                                <select
                                    value={newCondition.color}
                                    onChange={(e) => setNewCondition(prev => ({ ...prev, color: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded text-sm"
                                >
                                    {colorOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={editingConditionCode ? handleUpdateCondition : handleAddCondition}
                                    className={`w-full px-3 py-2 text-white rounded text-sm ${editingConditionCode ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                                >
                                    {editingConditionCode ? '病名を更新' : '病名を追加'}
                                </button>
                            </div>
                        </div>

                        {/* 既存の病名一覧 */}
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {conditions.map(condition => (
                                <div key={condition.code} className={`p-3 rounded border flex justify-between items-center ${condition.color}`}>
                                    <div>
                                        <div className="font-medium text-sm">{condition.name}</div>
                                        <div className="text-xs text-gray-600">コード: {condition.code} | 記号: {condition.symbol}</div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleEditCondition(condition)}
                                            className="text-blue-500 hover:text-blue-700 text-xs px-2"
                                            disabled={!!editingConditionCode}
                                        >
                                            編集
                                        </button>
                                        <button
                                            onClick={() => onDeleteCondition(condition.code)}
                                            className="text-red-500 hover:text-red-700 text-xs"
                                            disabled={!!editingConditionCode}
                                        >
                                            削除
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 治療法設定 */}
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h3 className="text-lg font-bold mb-3 text-green-900 flex items-center gap-2">
                            💊 治療法マスター
                        </h3>

                        {/* 新しい治療法追加 */}
                        {/* 新しい治療法追加・編集 */}
                        <div className={`border rounded-lg p-4 mb-4 ${editingTreatmentIndex ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-green-200'}`}>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-medium">{editingTreatmentIndex ? '治療法を編集' : '新しい治療法を追加'}</h4>
                                {editingTreatmentIndex && (
                                    <button onClick={cancelEditTreatment} className="text-xs text-gray-500 hover:text-gray-700">キャンセル</button>
                                )}
                            </div>
                            <div className="space-y-2">
                                <select
                                    value={newTreatment.conditionCode}
                                    onChange={(e) => setNewTreatment(prev => ({ ...prev, conditionCode: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded text-sm"
                                    disabled={!!editingTreatmentIndex} // 編集時は病名変更不可
                                >
                                    <option value="">対象病名を選択</option>
                                    {conditions.map(condition => (
                                        <option key={condition.code} value={condition.code}>
                                            {condition.name}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    placeholder="治療名（例：レジン充填）"
                                    value={newTreatment.name}
                                    onChange={(e) => setNewTreatment(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded text-sm"
                                />

                                <div>
                                    <div className="mb-2">
                                        <label className="text-sm font-medium block mb-1">治療ステップを選択</label>
                                        {newTreatment.conditionCode ? (
                                            <select
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        addTreatmentStep(e.target.value);
                                                        e.target.value = '';
                                                    }
                                                }}
                                                className="w-full px-3 py-2 border rounded text-sm"
                                            >
                                                <option value="">ステップを選択してください</option>
                                                {stepMaster
                                                    ?.filter(step => step.conditionCodes.includes(newTreatment.conditionCode))
                                                    .map(step => (
                                                        <option key={step.id} value={step.id}>
                                                            {step.name}
                                                        </option>
                                                    ))}
                                            </select>
                                        ) : (
                                            <div className="text-sm text-gray-500 p-2 bg-gray-50 border rounded">
                                                まず対象病名を選択してください
                                            </div>
                                        )}
                                    </div>

                                    {newTreatment.stepIds.length > 0 && (
                                        <div className="mt-2">
                                            <label className="text-sm font-medium block mb-2">選択済みステップ（順序変更可）</label>
                                            <div className="space-y-1">
                                                {newTreatment.stepIds.map((stepId, index) => {
                                                    const step = stepMaster?.find(s => s.id === stepId);
                                                    return (
                                                        <div key={index} className="flex items-center gap-2 p-2 bg-white border rounded">
                                                            <div className="flex flex-col gap-1">
                                                                <button
                                                                    onClick={() => index > 0 && moveTreatmentStep(index, index - 1)}
                                                                    disabled={index === 0}
                                                                    className={`text-xs px-1 ${index === 0 ? 'text-gray-300' : 'text-blue-600 hover:text-blue-800'}`}
                                                                >
                                                                    ↑
                                                                </button>
                                                                <button
                                                                    onClick={() => index < newTreatment.stepIds.length - 1 && moveTreatmentStep(index, index + 1)}
                                                                    disabled={index === newTreatment.stepIds.length - 1}
                                                                    className={`text-xs px-1 ${index === newTreatment.stepIds.length - 1 ? 'text-gray-300' : 'text-blue-600 hover:text-blue-800'}`}
                                                                >
                                                                    ↓
                                                                </button>
                                                            </div>
                                                            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                                                                {index + 1}
                                                            </span>
                                                            <span className="flex-1 text-sm">
                                                                {step ? step.name : (stepMaster?.find(s => s.id === 'step00')?.name || '')}
                                                            </span>
                                                            <button
                                                                onClick={() => removeTreatmentStep(index)}
                                                                className="text-red-500 hover:text-red-700 text-sm px-2"
                                                            >
                                                                削除
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={editingTreatmentIndex ? handleUpdateTreatment : handleAddTreatment}
                                    className={`w-full px-3 py-2 text-white rounded text-sm ${editingTreatmentIndex ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'}`}
                                >
                                    {editingTreatmentIndex ? '治療法を更新' : '治療法を追加'}
                                </button>
                            </div>
                        </div>

                        {/* 既存の治療法一覧 */}
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {Object.entries(treatmentRules).map(([conditionCode, treatments]) => (
                                <div key={conditionCode} className="border rounded-lg p-3">
                                    <h4 className="font-bold text-sm mb-2">
                                        {conditions.find(c => c.code === conditionCode)?.name || conditionCode}
                                        {treatments.length > 1 && (
                                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                                複数治療あり（1番目がデフォルト）
                                            </span>
                                        )}
                                    </h4>
                                    <div className="space-y-2">
                                        {treatments.map((treatment, index) => (
                                            <div key={index} className={`bg-white p-2 rounded border flex justify-between items-center ${index === 0 ? 'border-green-400 bg-green-50' : 'border-gray-200'
                                                }`}>
                                                <div className="flex items-center gap-2 flex-1">
                                                    <div className="flex flex-col">
                                                        <button
                                                            onClick={() => index > 0 && onMoveTreatment(conditionCode, index, index - 1)}
                                                            disabled={index === 0}
                                                            className={`text-xs px-1 ${index === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
                                                            title="上に移動"
                                                        >
                                                            ↑
                                                        </button>
                                                        <button
                                                            onClick={() => index < treatments.length - 1 && onMoveTreatment(conditionCode, index, index + 1)}
                                                            disabled={index === treatments.length - 1}
                                                            className={`text-xs px-1 ${index === treatments.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
                                                            title="下に移動"
                                                        >
                                                            ↓
                                                        </button>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                                                                {index + 1}
                                                            </span>
                                                            <div className="font-medium text-sm">{treatment.name}</div>
                                                            {index === 0 && (
                                                                <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
                                                                    デフォルト
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-600 mt-1">
                                                            {treatment.stepIds
                                                                ? treatment.stepIds.map(stepId => {
                                                                    const step = stepMaster?.find(s => s.id === stepId);
                                                                    // ステップが見つからない場合はstep00（空のステップ）を使用
                                                                    if (!step) {
                                                                        const emptyStep = stepMaster?.find(s => s.id === 'step00');
                                                                        return emptyStep?.name || '';
                                                                    }
                                                                    return step.name;
                                                                }).join(' → ')
                                                                : (treatment.steps || []).join(' → ')
                                                            } ({treatment.duration}回)
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex">
                                                    <button
                                                        onClick={() => handleEditTreatment(conditionCode, index, treatment)}
                                                        className="text-blue-500 hover:text-blue-700 text-xs ml-2 px-2 py-1"
                                                        disabled={!!editingTreatmentIndex}
                                                    >
                                                        編集
                                                    </button>
                                                    <button
                                                        onClick={() => onDeleteTreatment(conditionCode, index)}
                                                        className="text-red-500 hover:text-red-700 text-xs ml-2 px-2 py-1"
                                                        disabled={!!editingTreatmentIndex}
                                                    >
                                                        削除
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-center mt-6 pt-4 border-t">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                    >
                        設定を閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
