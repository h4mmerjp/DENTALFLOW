// 厚労省傷病名マスターコードとの対応表
// diseaseCode: 厚労省傷病名マスター(B)のコード
// diseaseName: 厚労省傷病名マスター(B)の正式名称
export const defaultConditions = [
    {
        code: 'C1',
        name: 'C1（初期う蝕）',
        symbol: 'C1',
        color: 'bg-yellow-100 border-yellow-400 text-yellow-800',
        diseaseCode: '8843836',
        diseaseName: 'う蝕'
    },
    {
        code: 'C2',
        name: 'C2（中等度う蝕）',
        symbol: 'C2',
        color: 'bg-orange-100 border-orange-400 text-orange-800',
        diseaseCode: '8843836',
        diseaseName: 'う蝕'
    },
    {
        code: 'C3',
        name: 'C3（深在性う蝕）',
        symbol: 'C3',
        color: 'bg-red-100 border-red-400 text-red-800',
        diseaseCode: '8843836',
        diseaseName: 'う蝕'
    },
    {
        code: 'C4',
        name: 'C4（残根）',
        symbol: 'C4',
        color: 'bg-red-200 border-red-600 text-red-900',
        diseaseCode: '8843836',
        diseaseName: 'う蝕'
    },
    {
        code: 'pul',
        name: 'pul（歯髄炎）',
        symbol: 'pul',
        color: 'bg-pink-100 border-pink-400 text-pink-800',
        diseaseCode: '5220071',
        diseaseName: '急性歯髄炎'
    },
    {
        code: 'per',
        name: 'per（根尖性歯周炎）',
        symbol: 'per',
        color: 'bg-rose-100 border-rose-400 text-rose-800',
        diseaseCode: '5231035',
        diseaseName: '急性根端性歯周炎'
    },
    {
        code: 'P1',
        name: 'P1（軽度歯周病）',
        symbol: 'P1',
        color: 'bg-purple-100 border-purple-400 text-purple-800',
        diseaseCode: '5231017',
        diseaseName: '歯周炎'
    },
    {
        code: 'P2',
        name: 'P2（中等度歯周病）',
        symbol: 'P2',
        color: 'bg-purple-100 border-purple-600 text-purple-900',
        diseaseCode: '5231017',
        diseaseName: '歯周炎'
    },
    {
        code: '欠損',
        name: '欠損歯',
        symbol: '×',
        color: 'bg-gray-200 border-gray-500 text-gray-800',
        diseaseCode: '8850666',
        diseaseName: '先天性欠如歯'
    }
];
