import React from 'react';

const teethNumbers = [
    [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
    [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
];

export default function ToothChart({
    toothConditions,
    selectedTooth,
    onToothClick,
    getConditionInfo,
    highlightedTeeth = []
}) {
    const renderTooth = (toothNumber) => {
        const toothConditionsList = toothConditions[toothNumber] || [];
        // 重複を排除
        const uniqueConditions = [...new Set(toothConditionsList)];
        const conditionInfos = uniqueConditions
            .map(code => getConditionInfo(code))
            .filter(Boolean);
        const isSelected = selectedTooth === toothNumber;
        const isHighlighted = highlightedTeeth.includes(toothNumber);
        const primaryCondition = conditionInfos[0];

        return (
            <div
                key={toothNumber}
                className={`w-12 h-16 border-2 rounded-sm cursor-pointer flex flex-col items-center justify-between text-xs font-bold transition-all relative
                    ${isSelected ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-300' : ''}
                    ${isHighlighted ? 'border-green-500 bg-green-100 ring-2 ring-green-300' : ''}
                    ${!isSelected && !isHighlighted ? 'border-gray-300 hover:border-gray-400' : ''}
                    ${primaryCondition && !isHighlighted ? primaryCondition.color : ''}
                    ${!primaryCondition && !isHighlighted && !isSelected ? 'bg-white hover:bg-gray-50' : ''}
                `}
                onClick={() => onToothClick(toothNumber)}
                title={conditionInfos.length > 0 ?
                    `${toothNumber}: ${conditionInfos.map(c => c.name).join(', ')}` :
                    `歯番 ${toothNumber}`
                }
            >
                <div className="text-[9px] leading-tight mt-1">
                    {toothNumber}
                </div>

                <div className="flex-1 flex flex-col items-center justify-center w-full px-1">
                    {conditionInfos.length > 0 ? (
                        <div className="text-center">
                            {conditionInfos.slice(0, 2).map((info) => (
                                <div key={info.code} className="text-[8px] font-black leading-tight">
                                    {info.symbol}
                                </div>
                            ))}
                            {conditionInfos.length > 2 && (
                                <div className="text-[7px] text-gray-600">+{conditionInfos.length - 2}</div>
                            )}
                        </div>
                    ) : null}
                </div>

                {isHighlighted && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full text-white text-[8px] flex items-center justify-center">
                        ✓
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="mb-6">
            <div className="text-center mb-2 text-sm text-gray-600">上顎</div>
            <div className="flex justify-center gap-1 mb-4">
                {teethNumbers[0].map(renderTooth)}
            </div>
            <div className="text-center mb-2 text-sm text-gray-600">下顎</div>
            <div className="flex justify-center gap-1">
                {teethNumbers[1].map(renderTooth)}
            </div>
        </div>
    );
}
