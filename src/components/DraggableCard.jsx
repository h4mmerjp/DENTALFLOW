import React, { useState } from 'react';
import { GripVertical } from 'lucide-react';
import ToothChip from './ToothChip';

export default function DraggableCard({
    step,
    isInSchedule = false,
    onRemoveFromSchedule = null,
    canDrag = true,
    onDragStart,
    onChangeTreatment = null,
    getConditionInfo = null,
    onToothChipDragStart = null,
    onToothChipDrop = null,
    onNodeDrop = null
}) {
    const isDisabled = !canDrag && !isInSchedule;
    const [isDragOver, setIsDragOver] = useState(false);
    const [canAcceptDrop, setCanAcceptDrop] = useState(false);
    
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

    // 歯式チップのドラッグハンドラ
    const handleToothChipDragStart = (e, data) => {
        if (onToothChipDragStart) {
            onToothChipDragStart(e, data);
        }
    };

    // ドロップゾーンとしてのハンドラ
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // dataTransfer.typesで歯式チップのドラッグかチェック
        // dragoverイベント時はgetData()が使えないため、typesで判定
        const hasJsonType = e.dataTransfer.types.includes('application/json');

        if (hasJsonType) {
            // 歯式チップの可能性があるため、ドロップ可能状態にする
            setCanAcceptDrop(true);
            setIsDragOver(true);
        } else {
            setCanAcceptDrop(false);
            setIsDragOver(false);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        setCanAcceptDrop(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        setCanAcceptDrop(false);

        try {
            const dragData = JSON.parse(e.dataTransfer.getData('application/json') || '{}');

            if (dragData.type === 'tooth-chip' && onToothChipDrop) {
                onToothChipDrop(dragData, step);
            } else if (dragData.type === 'treatment-node' && onNodeDrop) {
                // ノード全体のドロップ処理
                onNodeDrop(dragData, step);
            }
        } catch (err) {
            console.error('ドロップ処理エラー:', err);
        }
    };

    // ノードドラッグ開始時にノードデータを設定
    const handleNodeDragStart = (e) => {
        if (!canDrag) return;

        // ノードデータをJSON形式で設定
        const nodeData = {
            type: 'treatment-node',
            nodeId: step.id,
            groupId: step.groupId,
            node: step
        };
        e.dataTransfer.setData('application/json', JSON.stringify(nodeData));

        // 親コンポーネントのハンドラーも呼び出す
        if (onDragStart) {
            onDragStart(e, step);
        }
    };

    return (
        <div
            draggable={canDrag}
            onDragStart={handleNodeDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`draggable-card bg-white border-2 rounded-lg shadow-sm transition-all select-none relative flex flex-col ${isDisabled
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                    : 'border-gray-300 cursor-move hover:shadow-md'
                } ${step.isBranched ? 'border-orange-300' : ''}
                ${isDragOver && canAcceptDrop ? 'border-green-500 bg-green-50 ring-2 ring-green-300' : ''}
                ${isDragOver && !canAcceptDrop ? 'border-red-500 bg-red-50' : ''}`}
            style={{ userSelect: 'none', minHeight: '140px', touchAction: 'none' }}
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
            <div className="p-2 border-t border-gray-100">
                {/* 病名とページネーション */}
                <div className="flex items-center justify-between text-xs mb-2">
                    <div className={`px-2 py-0.5 rounded border ${conditionColorClass}`}>
                        {step.condition}
                    </div>

                    <div className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {step.cardNumber}/{step.totalCards}
                    </div>
                </div>

                {/* 歯式チップエリア */}
                <div className="flex flex-wrap gap-1.5">
                    {step.teeth && step.teeth.length > 0 ? (
                        step.teeth.map((tooth) => (
                            <ToothChip
                                key={`${step.id}-${tooth}`}
                                tooth={tooth}
                                nodeId={step.id}
                                groupId={step.groupId}
                                onDragStart={handleToothChipDragStart}
                                disabled={false}
                                size="small"
                            />
                        ))
                    ) : (
                        <div className="text-gray-400 text-xs italic">対象歯なし</div>
                    )}

                    {/* 歯数バッジ */}
                    {step.teeth && step.teeth.length > 1 && (
                        <div className="ml-auto bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                            {step.teeth.length}本
                        </div>
                    )}
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
