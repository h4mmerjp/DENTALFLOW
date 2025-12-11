// 同じ病名に対して複数の治療法があり、各治療法は複数ステップを持つ
// stepIdsはステップマスター(steps.js)で定義されたステップIDを参照
export const defaultTreatmentRules = {
    'C1': [
        { name: 'フッ素塗布', duration: 1, stepIds: ['step001'] }
    ],
    'C2': [
        { name: 'レジン充填', duration: 1, stepIds: ['step002'] },
        { name: 'インレー', duration: 2, stepIds: ['step003', 'step004'] }
    ],
    'C3': [
        { name: '抜髄→根治→クラウン', duration: 7, stepIds: ['step005', 'step006', 'step007', 'step008', 'step009', 'step003', 'step004'] },
        { name: '抜髄→根治', duration: 4, stepIds: ['step005', 'step006', 'step007', 'step008'] },
        { name: 'クラウンのみ', duration: 3, stepIds: ['step009', 'step003', 'step004'] }
    ],
    'pul': [
        { name: '抜髄→根治→クラウン', duration: 7, stepIds: ['step005', 'step006', 'step007', 'step008', 'step009', 'step003', 'step004'] },
        { name: '抜髄→根治', duration: 4, stepIds: ['step005', 'step006', 'step007', 'step008'] }
    ],
    'per': [
        { name: '感染根管治療→クラウン', duration: 7, stepIds: ['step010', 'step011', 'step012', 'step007', 'step009', 'step003', 'step004'] },
        { name: '感染根管治療のみ', duration: 4, stepIds: ['step010', 'step011', 'step012', 'step007'] }
    ],
    'P1': [
        { name: 'スケーリング', duration: 1, stepIds: ['step013'] }
    ],
    'P2': [
        { name: 'SRP→再評価', duration: 3, stepIds: ['step014', 'step015', 'step016'] },
        { name: 'SRPのみ', duration: 2, stepIds: ['step014', 'step015'] }
    ]
};
