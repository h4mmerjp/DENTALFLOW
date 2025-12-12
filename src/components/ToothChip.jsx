import React, { useState } from 'react';

/**
 * ToothChip - ドラッグ可能な歯式チップコンポーネント
 * まとめノード内の各歯式を個別のチップとして表示し、
 * ドラッグによる分離・合体操作を可能にします
 */
const ToothChip = ({
  tooth,
  nodeId,
  groupId,
  onDragStart,
  onDragEnd,
  disabled = false,
  size = 'normal' // 'small' | 'normal'
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e) => {
    if (disabled) {
      e.preventDefault();
      return;
    }

    setIsDragging(true);

    // ドラッグデータを設定
    e.dataTransfer.effectAllowed = 'move';
    const dragData = {
      type: 'tooth-chip',
      tooth,
      nodeId,
      groupId
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));

    if (onDragStart) {
      onDragStart(e, { tooth, nodeId, groupId });
    }
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    if (onDragEnd) {
      onDragEnd(e);
    }
  };

  const sizeClasses = size === 'small'
    ? 'px-2 py-1 text-xs'
    : 'px-3 py-1.5 text-sm';

  return (
    <div
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`
        inline-flex items-center gap-1 rounded-md
        bg-blue-100 border border-blue-300
        font-medium text-blue-800
        transition-all duration-200 ease-in-out
        ${sizeClasses}
        ${!disabled && 'cursor-move hover:bg-blue-200 hover:border-blue-400 hover:shadow-lg hover:scale-105 active:scale-95'}
        ${disabled && 'opacity-50 cursor-not-allowed'}
        ${isDragging && 'opacity-30 scale-90 rotate-2'}
      `}
      title={disabled ? '操作できません' : `${tooth}番をドラッグして分離・合体`}
    >
      {/* ドラッグハンドル */}
      {!disabled && (
        <svg
          className="w-3 h-3 text-blue-600"
          fill="currentColor"
          viewBox="0 0 16 16"
        >
          <circle cx="4" cy="3" r="1.5"/>
          <circle cx="4" cy="8" r="1.5"/>
          <circle cx="4" cy="13" r="1.5"/>
          <circle cx="12" cy="3" r="1.5"/>
          <circle cx="12" cy="8" r="1.5"/>
          <circle cx="12" cy="13" r="1.5"/>
        </svg>
      )}

      {/* 歯番号 */}
      <span className="font-semibold">{tooth}</span>
      <span className="text-xs">番</span>
    </div>
  );
};

export default ToothChip;
