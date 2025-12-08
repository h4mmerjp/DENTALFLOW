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
    onAiPromptChange
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
