import React from 'react';
import { Calendar, Plus, RotateCcw, Edit2, Check, X } from 'lucide-react';
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
    onChangeScheduleDate,
    onToothChipDragStart,
    onToothChipDrop,
    onToothChipDropToEmpty,
    onNodeDrop
}) {
    const [dragOverDate, setDragOverDate] = React.useState(null);
    const [editingDateIndex, setEditingDateIndex] = React.useState(null);
    const [editingDateValue, setEditingDateValue] = React.useState('');

    // スケジュール内の治療数をカウント
    const scheduledCount = treatmentSchedule.reduce((total, day) => total + day.treatments.length, 0);

    const handleClearAll = () => {
        if (scheduledCount === 0) {
            return;
        }
        // 確認ダイアログを削除し、直接実行（ユーザーからの反応がないという報告への対応）
        onClearAllSchedules();
    };

    // 日付編集モードに入る
    const handleDateEdit = (index, currentDate) => {
        setEditingDateIndex(index);
        setEditingDateValue(currentDate);
    };

    // 日付変更を保存
    const handleDateSave = () => {
        if (editingDateIndex !== null && editingDateValue) {
            onChangeScheduleDate(editingDateIndex, editingDateValue);
            setEditingDateIndex(null);
            setEditingDateValue('');
        }
    };

    // 日付編集をキャンセル
    const handleDateCancel = () => {
        setEditingDateIndex(null);
        setEditingDateValue('');
    };

    // 日付エリアのドロップハンドラ
    const handleDateAreaDragOver = (e, date) => {
        // DraggableCardのドロップゾーンでない場合のみ処理
        if (e.target.closest('.draggable-card')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const hasJsonType = e.dataTransfer.types.includes('application/json');
        if (hasJsonType) {
            setDragOverDate(date);
        }
    };

    const handleDateAreaDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverDate(null);
    };

    const handleDateAreaDrop = (e, date) => {
        // DraggableCardのドロップゾーンでない場合のみ処理
        if (e.target.closest('.draggable-card')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        setDragOverDate(null);

        try {
            const dragData = JSON.parse(e.dataTransfer.getData('application/json') || '{}');

            if (dragData.type === 'tooth-chip' && onToothChipDropToEmpty) {
                // この日付エリアにドロップ = この日付に分離
                onToothChipDropToEmpty(dragData, date);
            }
        } catch (err) {
            console.error('日付エリアドロップ処理エラー:', err);
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
                        className={`border rounded-lg p-4 transition-all ${
                            dragOverDate === day.date
                                ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300'
                                : 'bg-gray-50'
                        }`}
                        onDragOver={(e) => handleDateAreaDragOver(e, day.date)}
                        onDragLeave={handleDateAreaDragLeave}
                        onDrop={(e) => handleDateAreaDrop(e, day.date)}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            {editingDateIndex === index ? (
                                // 編集モード
                                <div className="flex items-center gap-2 flex-1">
                                    <span className="font-bold">第{index + 1}回目 -</span>
                                    <input
                                        type="date"
                                        value={editingDateValue}
                                        onChange={(e) => setEditingDateValue(e.target.value)}
                                        className="px-2 py-1 border border-blue-400 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleDateSave}
                                        className="p-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                        title="保存"
                                    >
                                        <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleDateCancel}
                                        className="p-1 bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors"
                                        title="キャンセル"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    {index < treatmentSchedule.length - 1 && (
                                        <span className="text-xs text-orange-600 ml-2">
                                            ※ 以降の日程も連動して変更されます
                                        </span>
                                    )}
                                </div>
                            ) : (
                                // 通常モード
                                <>
                                    <h3 className="font-bold">
                                        第{index + 1}回目 - {new Date(day.date).toLocaleDateString('ja-JP', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            weekday: 'short'
                                        })}
                                    </h3>
                                    <button
                                        onClick={() => handleDateEdit(index, day.date)}
                                        className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                        title="日付を変更"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    {day.treatments.length > 0 && (
                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-2">
                                            {day.treatments.length}件
                                        </span>
                                    )}
                                </>
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
                                            onNodeDrop={onNodeDrop}
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
