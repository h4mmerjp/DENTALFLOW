// ステップマスター - 治療ステップの定義
// 各ステップは複数の病名（conditionCodes）に紐付けることができる
export const defaultSteps = [
  // う蝕関連ステップ
  {
    id: 'step001',
    name: 'フッ素塗布',
    conditionCodes: ['C1'],
    description: ''
  },
  {
    id: 'step002',
    name: 'レジン充填',
    conditionCodes: ['C2'],
    description: ''
  },
  {
    id: 'step003',
    name: '印象採得',
    conditionCodes: ['C2', 'C3', 'pul', 'per'],
    description: ''
  },
  {
    id: 'step004',
    name: 'セット',
    conditionCodes: ['C2', 'C3', 'pul', 'per'],
    description: ''
  },

  // 根管治療関連ステップ
  {
    id: 'step005',
    name: '抜髄',
    conditionCodes: ['C3', 'pul'],
    description: ''
  },
  {
    id: 'step006',
    name: '根管拡大・洗浄',
    conditionCodes: ['C3', 'pul'],
    description: ''
  },
  {
    id: 'step007',
    name: '根管充填',
    conditionCodes: ['C3', 'pul', 'per'],
    description: ''
  },
  {
    id: 'step008',
    name: '仮封',
    conditionCodes: ['C3', 'pul'],
    description: ''
  },
  {
    id: 'step009',
    name: '支台築造',
    conditionCodes: ['C3', 'pul', 'per'],
    description: ''
  },

  // 感染根管治療関連ステップ
  {
    id: 'step010',
    name: '根管開放',
    conditionCodes: ['per'],
    description: ''
  },
  {
    id: 'step011',
    name: '根管拡大・洗浄①',
    conditionCodes: ['per'],
    description: ''
  },
  {
    id: 'step012',
    name: '根管拡大・洗浄②',
    conditionCodes: ['per'],
    description: ''
  },

  // 歯周病関連ステップ
  {
    id: 'step013',
    name: 'スケーリング',
    conditionCodes: ['P1'],
    description: ''
  },
  {
    id: 'step014',
    name: 'SRP右側',
    conditionCodes: ['P2'],
    description: ''
  },
  {
    id: 'step015',
    name: 'SRP左側',
    conditionCodes: ['P2'],
    description: ''
  },
  {
    id: 'step016',
    name: '再評価',
    conditionCodes: ['P2'],
    description: ''
  }
];
