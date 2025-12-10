import React from 'react';
import { GripVertical } from 'lucide-react';

export default function DraggableCard({
    step,
    isInSchedule = false,
    onRemoveFromSchedule = null,
    canDrag = true,
    onDragStart,
    onChangeTreatment = null,
    getConditionInfo = null
}) {
    const isDisabled = !canDrag && !isInSchedule;
    
    // 病名情報を取得して色を決定
    const conditionInfo = getConditionInfo ? getConditionInfo(step.condition) : null;
    const conditionColorClass = conditionInfo ? conditionInfo.color : 'bg-gray-100 border-gray-400 text-gray-800';

    const handlePrevTreatment = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!onChangeTreatment) return;
        const currentIndex = step.selectedTreatmentIndex;
        const newIndex = currentIndex > 0 ? currentIndex - 1 : step.availableTreatments.length - 1;
        onChangeTreatment(step, newIndex);
    };

    const handleNextTreatment = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!onChangeTreatment) return;
        const currentIndex = step.selectedTreatmentIndex;
        const newIndex = currentIndex < step.availableTreatments.length - 1 ? currentIndex + 1 : 0;
        onChangeTreatment(step, newIndex);
    };

    return (
        <div
            draggable={canDrag}
            onDragStart={(e) => canDrag && onDragStart(e, step)}
            className={`bg-white border-2 rounded-lg shadow-sm transition-all select-none relative flex flex-col ${isDisabled
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                    : 'border-gray-300 cursor-move hover:shadow-md'
                } ${step.isBranched ? 'border-orange-300' : ''}`}
            style={{ userSelect: 'none', minHeight: '140px' }}
        >
            {/* 上部：治療法選択または治療名表示 */}
            <div className="bg-gray-50 border-b border-gray-200 p-2 rounded-t-lg">
                {step.hasMultipleTreatments && onChangeTreatment ? (
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handlePrevTreatment}
                            className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 flex items-center justify-center"
                        >
                            ‹
                        </button>
                        <div className="text-xs font-bold text-gray-600 text-center flex-1 mx-2 truncate">
                            {step.availableTreatments[step.selectedTreatmentIndex]?.name || step.treatment}
                        </div>
                        <button
                            onClick={handleNextTreatment}
                            className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 flex items-center justify-center"
                        >
                            ›
                        </button>
                    </div>
                ) : (
                    <div className="text-xs font-bold text-gray-600 text-center truncate">
                        {step.treatment}
                    </div>
                )}
            </div>

            {/* 中央：治療ステップ名（ドラッグハンドル含む） */}
            <div className="flex-1 p-3 flex items-center justify-center relative">
                <GripVertical className={`absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 ${isDisabled ? 'text-gray-300' : 'text-gray-400'}`} />
                
                <h3 className="font-bold text-lg text-center text-gray-800 break-words w-full px-4">
                    {step.stepName}
                </h3>

                {isInSchedule && onRemoveFromSchedule && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemoveFromSchedule(step);
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 shadow-md flex items-center justify-center z-10"
                        title="削除"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* 下部：情報エリア（病名・対象歯・ページネーション） */}
            <div className="p-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <div className={`px-2 py-0.5 rounded border ${conditionColorClass}`}>
                    {step.condition}
                </div>
                
                <div className="text-gray-500 font-medium">
                    {step.teeth.join(', ')}番
                </div>

                <div className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {step.cardNumber}/{step.totalCards}
                </div>
            </div>

            {/* 分岐バッジ */}
            {step.isBranched && (
                <div className="absolute top-1 left-1 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full z-10">
                    分岐
                </div>
            )}
        </div>
    );
}
