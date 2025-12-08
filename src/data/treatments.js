// 同じ病名に対して複数の治療法があり、各治療法は複数ステップを持つ
export const defaultTreatmentRules = {
    'C1': [
        { name: 'フッ素塗布', duration: 1, steps: ['フッ素塗布'] }
    ],
    'C2': [
        { name: 'レジン充填', duration: 1, steps: ['レジン充填'] },
        { name: 'インレー', duration: 2, steps: ['印象採得', 'セット'] }
    ],
    'C3': [
        { name: '抜髄→根治→クラウン', duration: 7, steps: ['抜髄', '根管拡大・洗浄', '根管充填', '仮封', '支台築造', '印象採得', 'セット'] },
        { name: '抜髄→根治', duration: 4, steps: ['抜髄', '根管拡大・洗浄', '根管充填', '仮封'] },
        { name: 'クラウンのみ', duration: 3, steps: ['支台築造', '印象採得', 'セット'] }
    ],
    'pul': [
        { name: '抜髄→根治→クラウン', duration: 7, steps: ['抜髄', '根管拡大・洗浄', '根管充填', '仮封', '支台築造', '印象採得', 'セット'] },
        { name: '抜髄→根治', duration: 4, steps: ['抜髄', '根管拡大・洗浄', '根管充填', '仮封'] }
    ],
    'per': [
        { name: '感染根管治療→クラウン', duration: 7, steps: ['根管開放', '根管拡大・洗浄①', '根管拡大・洗浄②', '根管充填', '支台築造', '印象採得', 'セット'] },
        { name: '感染根管治療のみ', duration: 4, steps: ['根管開放', '根管拡大・洗浄①', '根管拡大・洗浄②', '根管充填'] }
    ],
    'P1': [
        { name: 'スケーリング', duration: 1, steps: ['スケーリング'] }
    ],
    'P2': [
        { name: 'SRP→再評価', duration: 3, steps: ['SRP右側', 'SRP左側', '再評価'] },
        { name: 'SRPのみ', duration: 2, steps: ['SRP右側', 'SRP左側'] }
    ]
};
