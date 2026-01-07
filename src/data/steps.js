// ステップマスター - 治療ステップの定義
// 各ステップは複数の病名（conditionCodes）に紐付けることができる
// procedureCode: 厚労省診療行為マスター(H)のコード
// procedureName: 厚労省診療行為マスター(H)の正式名称
// points: 診療報酬点数（厚労省マスターより）
export const defaultSteps = [
  // 空のステップ（削除されたステップの代替として使用）
  {
    id: 'step00',
    name: '',
    conditionCodes: [],
    description: '削除されたステップの代わりに表示される空のステップ',
    procedureCode: null,
    procedureName: null,
    points: 0
  },
  // う蝕関連ステップ
  {
    id: 'step001',
    name: 'フッ素塗布',
    conditionCodes: ['C1'],
    description: '',
    procedureCode: '313016610',
    procedureName: 'フッ化物歯面塗布処置',
    points: 130
  },
  {
    id: 'step002',
    name: 'レジン充填',
    conditionCodes: ['C2'],
    description: '',
    procedureCode: '313009920',
    procedureName: '充填（１窩洞につき）',
    points: 106
  },
  {
    id: 'step003',
    name: '印象採得',
    conditionCodes: ['C2', 'C3', 'pul', 'per'],
    description: '',
    procedureCode: '313004310',
    procedureName: '印象採得',
    points: 62
  },
  {
    id: 'step004',
    name: 'セット',
    conditionCodes: ['C2', 'C3', 'pul', 'per'],
    description: '',
    procedureCode: '313004710',
    procedureName: '装着',
    points: 45
  },

  // 根管治療関連ステップ
  {
    id: 'step005',
    name: '抜髄',
    conditionCodes: ['C3', 'pul'],
    description: '',
    procedureCode: '313000910',
    procedureName: '抜髄',
    points: 234
  },
  {
    id: 'step006',
    name: '根管拡大・洗浄',
    conditionCodes: ['C3', 'pul'],
    description: '',
    procedureCode: '313001110',
    procedureName: '根管拡大',
    points: 60
  },
  {
    id: 'step007',
    name: '根管充填',
    conditionCodes: ['C3', 'pul', 'per'],
    description: '',
    procedureCode: '313001310',
    procedureName: '根管充填',
    points: 72
  },
  {
    id: 'step008',
    name: '仮封',
    conditionCodes: ['C3', 'pul'],
    description: '',
    procedureCode: '313007010',
    procedureName: '歯冠修復物又は補綴物の除去',
    points: 20
  },
  {
    id: 'step009',
    name: '支台築造',
    conditionCodes: ['C3', 'pul', 'per'],
    description: '',
    procedureCode: '313002720',
    procedureName: '支台築造',
    points: 126
  },

  // 感染根管治療関連ステップ
  {
    id: 'step010',
    name: '根管開放',
    conditionCodes: ['per'],
    description: '',
    procedureCode: '313001010',
    procedureName: '感染根管処置',
    points: 150
  },
  {
    id: 'step011',
    name: '根管拡大・洗浄①',
    conditionCodes: ['per'],
    description: '',
    procedureCode: '313001110',
    procedureName: '根管拡大',
    points: 60
  },
  {
    id: 'step012',
    name: '根管拡大・洗浄②',
    conditionCodes: ['per'],
    description: '',
    procedureCode: '313001110',
    procedureName: '根管拡大',
    points: 60
  },

  // 歯周病関連ステップ
  {
    id: 'step013',
    name: 'スケーリング',
    conditionCodes: ['P1'],
    description: '',
    procedureCode: '313013710',
    procedureName: '歯周基本治療',
    points: 72
  },
  {
    id: 'step014',
    name: 'SRP右側',
    conditionCodes: ['P2'],
    description: '',
    procedureCode: '313013910',
    procedureName: '歯周基本治療（スケーリング・ルートプレーニング）',
    points: 68
  },
  {
    id: 'step015',
    name: 'SRP左側',
    conditionCodes: ['P2'],
    description: '',
    procedureCode: '313013910',
    procedureName: '歯周基本治療（スケーリング・ルートプレーニング）',
    points: 68
  },
  {
    id: 'step016',
    name: '再評価',
    conditionCodes: ['P2'],
    description: '',
    procedureCode: '313014010',
    procedureName: '歯周病検査',
    points: 200
  }
];
