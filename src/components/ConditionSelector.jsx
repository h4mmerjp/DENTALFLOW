import React from 'react';

export default function ConditionSelector({
    conditions,
    selectedTooth,
    bulkConditionMode,
    toothConditions,
    onConditionSelect,
    onClearAll,
    onComplete
}) {
    if (!selectedTooth && !bulkConditionMode) return null;

    return (
        <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
            <h3 className="font-bold mb-2">
                {bulkConditionMode
                    ? '病名を追加（歯番号なし）'
                    : `歯番 ${selectedTooth} の病名を選択`
                }
            </h3>
            <div className="text-xs text-gray-600 mb-3">
                {bulkConditionMode
                    ? '選択した病名が一般的な病名として追加されます'
                    : '複数選択可能（クリックで選択/解除）'
                }
            </div>
            <div className="grid grid-cols-2 gap-2">
                {conditions.map(condition => {
                    const isSelected = bulkConditionMode
                        ? false
                        : (toothConditions[selectedTooth] || []).includes(condition.code);
                    return (
                        <button
                            key={condition.code}
                            onClick={() => onConditionSelect(condition.code)}
                            className={`px-3 py-2 border rounded transition-all flex items-center justify-between ${isSelected
                                    ? `${condition.color} ring-2 ring-blue-400`
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
                {!bulkConditionMode && (
                    <button
                        onClick={onClearAll}
                        className="flex-1 px-3 py-2 bg-gray-200 border border-gray-400 rounded hover:bg-gray-300 transition-colors"
                    >
                        全てクリア
                    </button>
                )}
                <button
                    onClick={onComplete}
                    className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                    完了
                </button>
            </div>
        </div>
    );
}
