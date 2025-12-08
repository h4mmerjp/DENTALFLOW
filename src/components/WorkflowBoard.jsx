import React from 'react';
import DraggableCard from './DraggableCard';

export default function WorkflowBoard({
    workflow,
    treatmentSchedule,
    canDrag,
    onDragStart,
    onChangeTreatment
}) {
    const assignedIds = new Set();
    treatmentSchedule.forEach(day => {
        day.treatments.forEach(treatment => assignedIds.add(treatment.id));
    });

    const unassigned = workflow.filter(step => !assignedIds.has(step.id));

    if (unassigned.length === 0) return null;

    // 治療グループごとにまとめて表示（スタック形式）
    const groupedTreatments = {};
    unassigned.forEach(step => {
        if (!groupedTreatments[step.baseId]) {
            groupedTreatments[step.baseId] = [];
        }
        groupedTreatments[step.baseId].push(step);
    });

    const renderStackedTreatmentCard = (cardGroup, activeCard) => {
        const totalCards = cardGroup.length;
        const activeIndex = cardGroup.findIndex(card => card.id === activeCard.id);

        return (
            <div className="relative">
                {/* 背景カードの表示（重なり効果） */}
                {totalCards > 1 && Array.from({ length: Math.min(3, totalCards) }, (_, i) => {
                    const offset = (Math.min(3, totalCards) - 1 - i) * 3;
                    return (
                        <div
                            key={`bg-${i}`}
                            className="absolute bg-gray-200 border border-gray-400 rounded-lg"
                            style={{
                                top: `-${offset}px`,
                                right: `-${offset}px`,
                                left: `${offset}px`,
                                bottom: `${offset}px`,
                                zIndex: i
                            }}
                        />
                    );
                })}

                {/* アクティブカード */}
                <div className="relative" style={{ zIndex: 10 }}>
                    <DraggableCard
                        step={activeCard}
                        canDrag={canDrag(activeCard)}
                        onDragStart={onDragStart}
                        onChangeTreatment={onChangeTreatment}
                    />
                </div>

                {/* 進捗表示 */}
                {totalCards > 1 && (
                    <div className="text-center mt-2">
                        <div className="text-xs text-gray-500">
                            {activeIndex + 1} / {totalCards} 枚目
                        </div>
                        <div className="flex justify-center mt-1">
                            {cardGroup.map((_, index) => (
                                <div
                                    key={index}
                                    className={`w-2 h-2 rounded-full mx-1 ${index <= activeIndex ? 'bg-blue-500' : 'bg-gray-300'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">未スケジュール治療</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(groupedTreatments).map(group => {
                    // カード番号順にソート
                    const sortedGroup = group.sort((a, b) => a.cardNumber - b.cardNumber);
                    // 現在表示すべきカード（ドラッグ可能な最初のカード）を取得
                    const availableCard = sortedGroup.find(card => canDrag(card)) || sortedGroup[0];

                    return (
                        <div key={availableCard.baseId} className="relative">
                            {renderStackedTreatmentCard(sortedGroup, availableCard)}
                        </div>
                    );
                })}
            </div>
            <div className="mt-4 text-sm text-gray-600">
                💡 重ねたカードは治療完了後に次のカードが表示されます
            </div>
        </div>
    );
}
