// 厚生労働省マスターデータ参照フック
import { useState, useEffect, useMemo } from 'react';

// JSONデータをインポート
import procedures from '../data/master/procedures.json';
import diseases from '../data/master/diseases.json';
import toothCodes from '../data/master/toothCodes.json';
import procedureLimits from '../data/master/procedureLimits.json';
import ageRestrictions from '../data/master/ageRestrictions.json';
import exclusiveProcedures from '../data/master/exclusiveProcedures.json';

/**
 * 厚生労働省マスターデータを参照するフック
 */
export function useMasterData() {
  // インデックス作成（高速検索用）
  const procedureIndex = useMemo(() => {
    const index = new Map();
    procedures.forEach(p => index.set(p.code, p));
    return index;
  }, []);

  const diseaseIndex = useMemo(() => {
    const index = new Map();
    diseases.forEach(d => index.set(d.code, d));
    return index;
  }, []);

  const limitIndex = useMemo(() => {
    const index = new Map();
    procedureLimits.forEach(l => {
      if (!index.has(l.procedure_code)) {
        index.set(l.procedure_code, []);
      }
      index.get(l.procedure_code).push(l);
    });
    return index;
  }, []);

  const ageIndex = useMemo(() => {
    const index = new Map();
    ageRestrictions.forEach(a => index.set(a.procedure_code, a));
    return index;
  }, []);

  const exclusiveIndex = useMemo(() => {
    const index = new Map();
    exclusiveProcedures.forEach(e => {
      if (!index.has(e.procedure_code_a)) {
        index.set(e.procedure_code_a, []);
      }
      index.get(e.procedure_code_a).push(e.procedure_code_b);
    });
    return index;
  }, []);

  // 診療行為検索
  const searchProcedures = (query, options = {}) => {
    const { limit = 50, minPoints = 0 } = options;
    const lowerQuery = query.toLowerCase();

    return procedures
      .filter(p => {
        const matchesQuery = p.name.toLowerCase().includes(lowerQuery) ||
                            p.code.includes(query);
        const matchesPoints = p.points >= minPoints;
        return matchesQuery && matchesPoints;
      })
      .slice(0, limit);
  };

  // 傷病名検索
  const searchDiseases = (query, options = {}) => {
    const { limit = 50 } = options;
    const lowerQuery = query.toLowerCase();

    return diseases
      .filter(d =>
        d.name.toLowerCase().includes(lowerQuery) ||
        d.code.includes(query) ||
        (d.name_kana && d.name_kana.toLowerCase().includes(lowerQuery))
      )
      .slice(0, limit);
  };

  // コードから診療行為を取得
  const getProcedureByCode = (code) => {
    return procedureIndex.get(code) || null;
  };

  // コードから傷病名を取得
  const getDiseaseByCode = (code) => {
    return diseaseIndex.get(code) || null;
  };

  // 診療行為の算定回数限度を取得
  const getProcedureLimits = (procedureCode) => {
    return limitIndex.get(procedureCode) || [];
  };

  // 診療行為の年齢制限を取得
  const getAgeRestriction = (procedureCode) => {
    return ageIndex.get(procedureCode) || null;
  };

  // 併算定不可の診療行為を取得
  const getExclusiveProcedures = (procedureCode) => {
    return exclusiveIndex.get(procedureCode) || [];
  };

  // 併算定チェック
  const checkExclusiveRule = (procedureCodeA, procedureCodeB) => {
    const exclusiveA = exclusiveIndex.get(procedureCodeA) || [];
    const exclusiveB = exclusiveIndex.get(procedureCodeB) || [];
    return exclusiveA.includes(procedureCodeB) || exclusiveB.includes(procedureCodeA);
  };

  // 年齢制限チェック
  const checkAgeRestriction = (procedureCode, ageInMonths) => {
    const restriction = ageIndex.get(procedureCode);
    if (!restriction) return { allowed: true };

    const { min_age_months, max_age_months } = restriction;
    const allowed = ageInMonths >= min_age_months && ageInMonths <= max_age_months;

    return {
      allowed,
      restriction,
      message: allowed ? null : `年齢制限: ${min_age_months}〜${max_age_months}歳`
    };
  };

  return {
    // データ
    procedures,
    diseases,
    toothCodes,
    procedureLimits,
    ageRestrictions,
    exclusiveProcedures,

    // 検索
    searchProcedures,
    searchDiseases,

    // 個別取得
    getProcedureByCode,
    getDiseaseByCode,
    getProcedureLimits,
    getAgeRestriction,
    getExclusiveProcedures,

    // チェック
    checkExclusiveRule,
    checkAgeRestriction,

    // 統計
    stats: {
      procedureCount: procedures.length,
      diseaseCount: diseases.length,
      toothCodeCount: toothCodes.length,
    }
  };
}

/**
 * 既存の病名コード（C1, C2等）と厚労省コードのマッピング
 */
export const conditionCodeMapping = {
  'C1': { name: 'C1（初期う蝕）', diseaseCode: '8843836', diseaseName: 'う蝕' },
  'C2': { name: 'C2（中等度う蝕）', diseaseCode: '8843836', diseaseName: 'う蝕' },
  'C3': { name: 'C3（深在性う蝕）', diseaseCode: '8843836', diseaseName: 'う蝕' },
  'C4': { name: 'C4（残根）', diseaseCode: '8843836', diseaseName: 'う蝕' },
  'pul': { name: 'pul（歯髄炎）', diseaseCode: '5220071', diseaseName: '急性歯髄炎' },
  'per': { name: 'per（根尖性歯周炎）', diseaseCode: '5231035', diseaseName: '急性根端性歯周炎' },
  'P1': { name: 'P1（軽度歯周病）', diseaseCode: '5231017', diseaseName: '歯周炎' },
  'P2': { name: 'P2（中等度歯周病）', diseaseCode: '5231017', diseaseName: '歯周炎' },
  '欠損': { name: '欠損歯', diseaseCode: '8850666', diseaseName: '先天性欠如歯' },
};

/**
 * 治療ステップと厚労省診療行為コードのマッピング
 */
export const stepCodeMapping = {
  'step001': { name: 'フッ素塗布', procedureCode: '313016610', procedureName: 'フッ化物歯面塗布処置' },
  'step002': { name: 'レジン充填', procedureCode: '313009920', procedureName: '充填（１窩洞につき）' },
  'step003': { name: '印象採得', procedureCode: '313004310', procedureName: '印象採得' },
  'step004': { name: 'セット', procedureCode: '313004710', procedureName: '装着' },
  'step005': { name: '抜髄', procedureCode: '313000910', procedureName: '抜髄' },
  'step006': { name: '根管拡大・洗浄', procedureCode: '313001110', procedureName: '根管拡大' },
  'step007': { name: '根管充填', procedureCode: '313001310', procedureName: '根管充填' },
  'step008': { name: '仮封', procedureCode: '313007010', procedureName: '歯冠修復物又は補綴物の除去' },
  'step009': { name: '支台築造', procedureCode: '313002720', procedureName: '支台築造' },
  'step010': { name: '根管開放', procedureCode: '313001010', procedureName: '感染根管処置' },
  'step013': { name: 'スケーリング', procedureCode: '313013710', procedureName: '歯周基本治療' },
  'step014': { name: 'SRP', procedureCode: '313013910', procedureName: '歯周基本治療（スケーリング・ルートプレーニング）' },
};

export default useMasterData;
