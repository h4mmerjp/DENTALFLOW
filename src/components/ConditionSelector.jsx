import React from 'react';

export default function ConditionSelector({
    conditions,
    selectedTeeth = [],
    toothConditions,
    onConditionSelect,
    onClearAll,
    onComplete
}) {
    if (selectedTeeth.length === 0) return null;

    const teethLabel = selectedTeeth.length === 1
        ? `歯番 ${selectedTeeth[0]}`
        : `歯番 ${selectedTeeth.slice().sort((a, b) => a - b).join(', ')} (${selectedTeeth.length}本)`;

    return (
        <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
            <h3 className="font-bold mb-2 text-green-900">
                {teethLabel} の病名を選択
            </h3>
            <div className="text-xs text-gray-600 mb-3">
                複数選択可能（クリックで選択/解除）
            </div>
            <div className="grid grid-cols-2 gap-2">
                {conditions.map(condition => {
                    const isActive = selectedTeeth.length > 0 &&
                        selectedTeeth.every(t => (toothConditions[t] || []).includes(condition.code));
                    return (
                        <button
                            key={condition.code}
                            onClick={() => onConditionSelect(condition.code)}
                            className={`px-3 py-2 border rounded transition-all flex items-center justify-between ${isActive
                                    ? `${condition.color} ring-2 ring-green-500`
                                    : 'bg-white border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <span className="text-sm">{condition.name}</span>
                            <span className="font-black text-lg">{condition.symbol}</span>
                        </button>
                    );
                })}
            </div>
            <div className="flex gap-2 mt-3">
                <button
                    onClick={onClearAll}
                    className="flex-1 px-3 py-2 bg-gray-200 border border-gray-400 rounded hover:bg-gray-300 transition-colors"
                >
                    全てクリア
                </button>
                <button
                    onClick={onComplete}
                    className="flex-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                >
                    完了
                </button>
            </div>
        </div>
    );
}
