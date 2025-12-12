import React from 'react';
import { Calendar, Plus, RotateCcw } from 'lucide-react';
import DraggableCard from './DraggableCard';

export default function ScheduleCalendar({
    treatmentSchedule,
    onDragOver,
    onDrop,
    onRemoveFromSchedule,
    onAddDay,
    onDragStart,
    onChangeTreatment,
    autoScheduleEnabled,
    getConditionInfo,
    onClearAllSchedules,
    onToothChipDragStart,
    onToothChipDrop
}) {
    // スケジュール内の治療数をカウント
    const scheduledCount = treatmentSchedule.reduce((total, day) => total + day.treatments.length, 0);

    const handleClearAll = () => {
        if (scheduledCount === 0) {
            return;
        }
        if (window.confirm('スケジュールに配置されたすべての治療を未スケジュール状態に戻しますか？\nスケジュール枠（日付）は残ります。')) {
            onClearAllSchedules();
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">治療スケジュール</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleClearAll}
                        disabled={scheduledCount === 0}
                        className={`flex items-center gap-2 px-3 py-1 rounded transition-colors text-sm ${
                            scheduledCount === 0
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-red-500 text-white hover:bg-red-600'
                        }`}
                        title="スケジュールをすべてリセット"
                    >
                        <RotateCcw className="w-4 h-4" />
                        一括リセット
                    </button>
                    <button
                        onClick={onAddDay}
                        className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        治療日追加
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {treatmentSchedule.map((day, index) => (
                    <div
                        key={day.date}
                        className="border rounded-lg p-4 bg-gray-50"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            <h3 className="font-bold">
                                第{index + 1}回目 - {new Date(day.date).toLocaleDateString('ja-JP', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    weekday: 'short'
                                })}
                            </h3>
                            {day.treatments.length > 0 && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-2">
                                    {day.treatments.length}件
                                </span>
                            )}
                        </div>

                        <div
                            className="min-h-[120px] border-2 border-dashed border-gray-300 rounded-lg p-3 bg-white"
                            onDragOver={onDragOver}
                            onDrop={(e) => onDrop(e, day.date)}
                        >
                            {day.treatments.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {day.treatments.map(treatment =>
                                        <DraggableCard
                                            key={treatment.id}
                                            step={treatment}
                                            isInSchedule={true}
                                            onRemoveFromSchedule={onRemoveFromSchedule}
                                            canDrag={true}
                                            onDragStart={onDragStart}
                                            onChangeTreatment={onChangeTreatment}
                                            getConditionInfo={getConditionInfo}
                                            onToothChipDragStart={onToothChipDragStart}
                                            onToothChipDrop={onToothChipDrop}
                                        />
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
                                    治療ノードをドラッグしてください
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 text-sm text-gray-600">
                💡 治療ノードをドラッグして任意の治療日に配置できます
                {autoScheduleEnabled && (
                    <span className="block mt-1 text-blue-600">
                        🔄 自動スケジューリング有効：複数ステップ治療の1回目を配置すると残りが自動配置されます
                    </span>
                )}
                <span className="block mt-1 text-red-600">
                    ❌ スケジュール削除：各治療ノードの右上の×ボタンで未スケジュールに戻せます
                </span>
            </div>
        </div>
    );
}
