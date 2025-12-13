import React from 'react';
import DraggableCard from './DraggableCard';

export default function WorkflowBoard({
    workflow,
    treatmentSchedule,
    canDrag,
    onDragStart,
    onChangeTreatment,
    getConditionInfo,
    onAutoSchedule,
    isGenerating,
    onToothChipDragStart,
    onToothChipDrop,
    onToothChipDropToEmpty,
    onNodeDrop
}) {
    const [isDragOverArea, setIsDragOverArea] = React.useState(false);

    const assignedIds = new Set();
    treatmentSchedule.forEach(day => {
        day.treatments.forEach(treatment => assignedIds.add(treatment.id));
    });

    const unassigned = workflow.filter(step => !assignedIds.has(step.id));

    if (unassigned.length === 0) return null;

    // 治療グループごとにまとめて表示（スタック形式）
    // groupIdでグループ化（分離・合体に対応）
    const groupedTreatments = {};
    unassigned.forEach(step => {
        const groupKey = step.groupId || step.baseId; // groupIdがない場合はbaseIdをフォールバック
        if (!groupedTreatments[groupKey]) {
            groupedTreatments[groupKey] = [];
        }
        groupedTreatments[groupKey].push(step);
    });

    // エリア全体のドロップハンドラ（ノード外へのドロップ）
    const handleAreaDragOver = (e) => {
        // DraggableCardのドロップゾーンでない場合のみ処理
        if (e.target.closest('.draggable-card')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const hasJsonType = e.dataTransfer.types.includes('application/json');
        if (hasJsonType) {
            setIsDragOverArea(true);
        }
    };

    const handleAreaDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOverArea(false);
    };

    const handleAreaDrop = (e) => {
        // DraggableCardのドロップゾーンでない場合のみ処理
        if (e.target.closest('.draggable-card')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        setIsDragOverArea(false);

        try {
            const dragData = JSON.parse(e.dataTransfer.getData('application/json') || '{}');

            if (dragData.type === 'tooth-chip' && onToothChipDropToEmpty) {
                // 未スケジュールエリアにドロップ = 未スケジュールとして分離
                onToothChipDropToEmpty(dragData, null);
            }
        } catch (err) {
            console.error('エリアドロップ処理エラー:', err);
        }
    };

    const renderStackedTreatmentCard = (cardGroup, activeCard) => {
        const totalCards = cardGroup.length;
        const activeIndex = cardGroup.findIndex(card => card.id === activeCard.id);

        return (
            <div className="relative">
                {/* 背景カードの表示（重なり効果）- より明確に */}
                {totalCards > 1 && Array.from({ length: Math.min(3, totalCards) }, (_, i) => {
                    const offset = (Math.min(3, totalCards) - 1 - i) * 8; // 3pxから8pxに変更
                    const opacity = 1 - (i * 0.2); // 奥のカードほど薄く
                    return (
                        <div
                            key={`bg-${i}`}
                            className="absolute bg-gray-100 border-2 border-gray-300 rounded-lg shadow-sm"
                            style={{
                                top: `-${offset}px`,
                                right: `-${offset}px`,
                                left: `${offset}px`,
                                bottom: `${offset}px`,
                                zIndex: i,
                                opacity: opacity,
                                transform: `scale(${0.98 - (i * 0.02)})` // わずかに縮小
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
                        getConditionInfo={getConditionInfo}
                        onToothChipDragStart={onToothChipDragStart}
                        onToothChipDrop={onToothChipDrop}
                        onNodeDrop={onNodeDrop}
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
        <div
            className={`bg-white rounded-lg shadow-md p-6 mb-6 transition-all ${
                isDragOverArea ? 'ring-2 ring-blue-400 bg-blue-50' : ''
            }`}
            onDragOver={handleAreaDragOver}
            onDragLeave={handleAreaDragLeave}
            onDrop={handleAreaDrop}
        >
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">未スケジュール治療</h2>
                <button
                    onClick={onAutoSchedule}
                    disabled={isGenerating || workflow.length === 0}
                    className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors ${isGenerating || workflow.length === 0
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-purple-500 hover:bg-purple-600'
                        }`}
                >
                    <span className="text-lg">🤖</span>
                    {isGenerating ? '配置中...' : '自動配置'}
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(groupedTreatments).map(([groupKey, group]) => {
                    // カード番号順にソート
                    const sortedGroup = group.sort((a, b) => a.cardNumber - b.cardNumber);
                    // 現在表示すべきカード（ドラッグ可能な最初のカード）を取得
                    const availableCard = sortedGroup.find(card => canDrag(card)) || sortedGroup[0];

                    return (
                        <div key={groupKey} className="relative">
                            {renderStackedTreatmentCard(sortedGroup, availableCard)}
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 space-y-2">
                <div className="text-sm text-gray-600">
                    💡 重ねたカードは治療完了後に次のカードが表示されます
                </div>
                <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                    🔧 <strong>歯式チップ機能：</strong>
                    <ul className="mt-1 ml-4 space-y-1 text-xs">
                        <li>• 歯番号チップを他のノードにドロップで合体</li>
                        <li>• 歯番号チップをノード外にドロップで同じエリアに分離</li>
                        <li>• 同じ病名・治療法・ステップ番号のノード間でのみ合体可能</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
