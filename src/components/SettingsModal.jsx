import React, { useState } from 'react';

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
    onAddCondition,
    onDeleteCondition,
    onAddTreatment,
    onDeleteTreatment,
    onMoveTreatment,
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
        steps: ['']
    });
    // グループベースの排他的病名ルール作成用の状態
    // 各グループは病名コードの配列
    const [selectedExclusiveGroups, setSelectedExclusiveGroups] = useState([[]]);

    if (!isOpen) return null;

    const handleAddCondition = () => {
        if (newCondition.code && newCondition.name && newCondition.symbol) {
            onAddCondition(newCondition);
            setNewCondition({ code: '', name: '', symbol: '', color: 'bg-gray-100 border-gray-400 text-gray-800' });
        }
    };

    const handleAddTreatment = () => {
        if (newTreatment.conditionCode && newTreatment.name && newTreatment.steps.some(s => s.trim())) {
            const filteredSteps = newTreatment.steps.filter(s => s.trim());
            onAddTreatment(newTreatment.conditionCode, {
                name: newTreatment.name,
                duration: filteredSteps.length,
                steps: filteredSteps
            });
            setNewTreatment({ conditionCode: '', name: '', steps: [''] });
        }
    };

    const addStep = () => {
        setNewTreatment(prev => ({ ...prev, steps: [...prev.steps, ''] }));
    };

    const removeStep = (index) => {
        setNewTreatment(prev => ({
            ...prev,
            steps: prev.steps.filter((_, i) => i !== index)
        }));
    };

    const updateStep = (index, value) => {
        const newSteps = [...newTreatment.steps];
        newSteps[index] = value;
        setNewTreatment(prev => ({ ...prev, steps: newSteps }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
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
                    <h3 className="text-lg font-bold text-purple-900 mb-3 flex items-center gap-2">
                        🤖 AI治療スケジューリング
                        <span className="text-sm font-normal text-red-500 ml-2">(未実装)</span>
                    </h3>
                    <div className="space-y-3">
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 病名設定 */}
                    <div>
                        <h3 className="text-lg font-bold mb-3">病名マスター</h3>

                        {/* 新しい病名追加 */}
                        <div className="border rounded-lg p-4 mb-4 bg-gray-50">
                            <h4 className="font-medium mb-2">新しい病名を追加</h4>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    placeholder="病名コード（例：C1）"
                                    value={newCondition.code}
                                    onChange={(e) => setNewCondition(prev => ({ ...prev, code: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded text-sm"
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
                                    onClick={handleAddCondition}
                                    className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                                >
                                    病名を追加
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
                                    <button
                                        onClick={() => onDeleteCondition(condition.code)}
                                        className="text-red-500 hover:text-red-700 text-xs"
                                    >
                                        削除
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 治療法設定 */}
                    <div>
                        <h3 className="text-lg font-bold mb-3">治療法マスター</h3>

                        {/* 新しい治療法追加 */}
                        <div className="border rounded-lg p-4 mb-4 bg-gray-50">
                            <h4 className="font-medium mb-2">新しい治療法を追加</h4>
                            <div className="space-y-2">
                                <select
                                    value={newTreatment.conditionCode}
                                    onChange={(e) => setNewTreatment(prev => ({ ...prev, conditionCode: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded text-sm"
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
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-medium">治療ステップ</label>
                                        <button
                                            onClick={addStep}
                                            className="text-blue-500 hover:text-blue-700 text-sm"
                                        >
                                            + ステップ追加
                                        </button>
                                    </div>
                                    {newTreatment.steps.map((step, index) => (
                                        <div key={index} className="flex gap-2 mb-2">
                                            <input
                                                type="text"
                                                placeholder={`ステップ ${index + 1}`}
                                                value={step}
                                                onChange={(e) => updateStep(index, e.target.value)}
                                                className="flex-1 px-3 py-2 border rounded text-sm"
                                            />
                                            {newTreatment.steps.length > 1 && (
                                                <button
                                                    onClick={() => removeStep(index)}
                                                    className="text-red-500 hover:text-red-700 text-sm px-2"
                                                >
                                                    削除
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={handleAddTreatment}
                                    className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                                >
                                    治療法を追加
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
                                                            {treatment.steps.join(' → ')} ({treatment.duration}回)
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => onDeleteTreatment(conditionCode, index)}
                                                    className="text-red-500 hover:text-red-700 text-xs ml-2 px-2 py-1"
                                                >
                                                    削除
                                                </button>
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
