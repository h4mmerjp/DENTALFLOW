import React from 'react';
import { GripVertical } from 'lucide-react';

export default function DraggableCard({
    step,
    isInSchedule = false,
    onRemoveFromSchedule = null,
    canDrag = true,
    onDragStart,
    onChangeTreatment = null
}) {
    const isDisabled = !canDrag && !isInSchedule;

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
            className={`bg-white border-2 rounded-lg p-3 shadow-sm transition-all select-none relative ${isDisabled
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                    : 'border-gray-300 cursor-move hover:shadow-md'
                } ${step.isBranched ? 'border-orange-300 bg-orange-50' : ''}`}
            style={{ userSelect: 'none' }}
        >
            {/* 分岐表示バッジ */}
            {step.isBranched && (
                <div className="absolute top-1 left-1 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                    分岐
                </div>
            )}

            {isInSchedule && onRemoveFromSchedule && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFromSchedule(step);
                    }}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors flex items-center justify-center"
                    title="スケジュールから削除（以降のステップも削除）"
                >
                    ×
                </button>
            )}

            <div className="flex items-center gap-2 mb-2">
                <GripVertical className={`w-4 h-4 flex-shrink-0 ${isDisabled ? 'text-gray-300' : 'text-gray-400'}`} />
                <h3 className="font-bold text-sm flex-1 pr-6">{step.stepName}</h3>
                {step.isSequential && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {step.cardNumber}/{step.totalCards}
                    </span>
                )}
            </div>

            {/* 治療選択ボタン（複数治療がある場合） */}
            {step.hasMultipleTreatments && onChangeTreatment && (
                <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded">
                    <div className="text-xs text-blue-800 font-medium mb-2 text-center">
                        治療法選択 ({step.selectedTreatmentIndex + 1}/{step.availableTreatments.length})
                    </div>
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={handlePrevTreatment}
                            className="w-6 h-6 bg-blue-500 text-white rounded-full text-xs hover:bg-blue-600 transition-colors flex items-center justify-center font-bold"
                            title="前の治療法"
                        >
                            ‹
                        </button>

                        <div className="flex-1 text-center px-2">
                            <div className="text-xs font-medium text-blue-900">
                                {step.availableTreatments[step.selectedTreatmentIndex]?.name || step.treatment}
                            </div>
                            <div className="text-xs text-blue-600">
                                ({step.availableTreatments[step.selectedTreatmentIndex]?.duration || 1}回)
                            </div>
                        </div>

                        <button
                            onClick={handleNextTreatment}
                            className="w-6 h-6 bg-blue-500 text-white rounded-full text-xs hover:bg-blue-600 transition-colors flex items-center justify-center font-bold"
                            title="次の治療法"
                        >
                            ›
                        </button>
                    </div>
                </div>
            )}

            <div className="text-xs text-gray-700 mb-1">
                対象歯: {step.teeth.join(', ')}
            </div>
            <div className="text-xs text-blue-600 mb-2">
                病名: {step.condition}
                {step.isBranched && (
                    <span className="ml-2 text-orange-600">
                        (第{step.branchedFrom}回から分岐)
                    </span>
                )}
            </div>

            {isDisabled && (
                <div className="text-xs text-red-500 mt-2">
                    前の治療を先に配置してください
                </div>
            )}
        </div>
    );
}
