# 治療計画分岐機能 仕様書

## 概要

スケジュール途中から病名・治療を変更する機能。選択したノードのシーケンスのみを対象とし、他の治療シーケンスには影響を与えない。

## 要件

### 変更対象
- **選択したシーケンス（groupId）のみ**を対象
- 同じ歯でも別のgroupIdを持つ治療シーケンスは変更しない

### ノードの扱い
| ノード種別 | 処理 |
|-----------|------|
| 同一groupId かつ cardNumber < 選択ノード | `completed: true` に変更（履歴保持）、病名は元のまま |
| 同一groupId かつ cardNumber >= 選択ノード | 削除 |
| 別のgroupId | 変更なし |
| 既に `completed: true` のノード | 変更なし |

### 病名の変遷表示
- **完了済みノード**: 元の病名を維持（例: `"C2"`）
- **新規生成ノード**: 変遷を表示（例: `"C2→C3"`）

```
【変更前】C2治療のStep2で「C3に変更」
  C2-Step1 (未完了)
  C2-Step2 (未完了) ← ここで変更実行
  C2-Step3 (未完了)

【変更後】
  C2-Step1 (completed: true, condition: "C2")     ← 元病名のまま
  C2→C3-Step1 (未完了, condition: "C2→C3")       ← 変遷表示
  C2→C3-Step2 (未完了, condition: "C2→C3")
```

### toothConditions の更新
- 選択したノードの歯について、古い病名を新しい病名に**置換**
- 他の病名は維持
- 配列形式で管理: `{ "11": ["C3", "P1"] }`
- ※ノード上は `"C2→C3"` と表示されるが、toothConditionsは現在の状態 `"C3"` を保持

## 実装

### 修正対象ファイル
`src/hooks/useTreatmentWorkflow.js`

### divergeTreatmentPlan 関数の修正

```javascript
const divergeTreatmentPlan = (nodeId, newCondition) => {
    // 1. 起点ノードの情報を取得
    const sourceNode = workflow.find(w => w.id === nodeId);
    if (!sourceNode) return { success: false, message: 'ノードが見つかりません。' };

    const { groupId, cardNumber, teeth: affectedTeeth, condition: oldCondition } = sourceNode;

    // 元の病名を取得（既に変遷表示の場合は最初の病名を抽出）
    const originalCondition = oldCondition.includes('→')
        ? oldCondition.split('→')[0]
        : oldCondition;

    // 変遷表示用の病名を生成（例: "C2→C3" または "C1→C2→C3"）
    const transitionCondition = oldCondition.includes('→')
        ? `${oldCondition}→${newCondition}`
        : `${oldCondition}→${newCondition}`;

    // 2. 同一シーケンス内の「前のステップ」を特定
    const priorNodeIds = new Set();
    workflow.forEach(w => {
        if (w.groupId === groupId && w.cardNumber < cardNumber && !w.completed) {
            priorNodeIds.add(w.id);
        }
    });

    // 3. 削除対象を特定（同一シーケンスの選択ノード以降のみ）
    const idsToRemove = new Set();
    workflow.forEach(w => {
        if (w.groupId === groupId && w.cardNumber >= cardNumber) {
            idsToRemove.add(w.id);
        }
    });

    // 4. workflow更新: 削除 + 前ステップを完了扱い（病名は元のまま）
    const updatedWorkflow = workflow
        .filter(w => !idsToRemove.has(w.id))
        .map(w => priorNodeIds.has(w.id) ? { ...w, completed: true } : w);

    // 5. treatmentSchedule更新: 前ステップを完了扱い + 削除対象を除去
    setTreatmentSchedule(prev => prev.map(day => ({
        ...day,
        treatments: day.treatments
            .filter(t => !idsToRemove.has(t.id))
            .map(t => priorNodeIds.has(t.id) ? { ...t, completed: true } : t)
    })));

    // 6. toothConditions更新: 古い病名を新しい病名に置換（配列形式）
    //    ※toothConditionsは現在の状態のみ保持（変遷表示はノード側で管理）
    setToothConditions(prev => {
        const next = { ...prev };
        affectedTeeth.forEach(tooth => {
            const currentConditions = Array.isArray(next[tooth]) ? next[tooth] : [next[tooth]].filter(Boolean);
            // 古い病名（変遷含む可能性）を除去し、新しい病名を追加
            const filtered = currentConditions.filter(c => {
                const baseCondition = c.includes('→') ? c.split('→').pop() : c;
                return baseCondition !== originalCondition && baseCondition !== oldCondition.split('→').pop();
            });
            next[tooth] = [...filtered, newCondition];
        });
        return next;
    });

    // 7. 新しい治療ノードを生成して追加（変遷表示付き）
    const newNodes = generateNodesForCondition(transitionCondition, newCondition, affectedTeeth);
    setWorkflow([...updatedWorkflow, ...newNodes]);

    return { success: true, message: `病名を ${oldCondition} から ${newCondition} へ変更しました。` };
};
```

### 新規ヘルパー関数

```javascript
/**
 * 指定した病名・歯に対する治療ノードを生成
 * @param {string} displayCondition - 表示用病名（例: "C2→C3"）
 * @param {string} actualCondition - 実際の病名（例: "C3"）※treatmentRulesの検索に使用
 * @param {string[]} teeth - 対象歯
 * @returns {Array} 生成されたノード配列
 */
const generateNodesForCondition = (displayCondition, actualCondition, teeth) => {
    const treatments = treatmentRules[actualCondition] || [];
    if (treatments.length === 0) return [];

    const nodes = [];
    const groupId = crypto.randomUUID();

    teeth.forEach(tooth => {
        const treatmentKey = `${actualCondition}-${tooth}`;
        const selectedTreatmentIndex = selectedTreatmentOptions[treatmentKey] || 0;
        const selectedTreatment = treatments[selectedTreatmentIndex] || treatments[0];

        if (selectedTreatment) {
            for (let i = 0; i < selectedTreatment.duration; i++) {
                const cardId = crypto.randomUUID();
                let stepName;
                if (selectedTreatment.stepIds && selectedTreatment.stepIds[i]) {
                    stepName = getStepName(selectedTreatment.stepIds[i]);
                } else if (selectedTreatment.steps && selectedTreatment.steps[i]) {
                    stepName = selectedTreatment.steps[i];
                } else {
                    stepName = `${selectedTreatment.name}(${i + 1})`;
                }

                nodes.push({
                    id: cardId,
                    baseId: `${displayCondition}-${selectedTreatment.name}-${tooth}`,
                    groupId,
                    condition: displayCondition,        // 表示用（例: "C2→C3"）
                    actualCondition: actualCondition,   // 実際の病名（例: "C3"）
                    treatment: selectedTreatment.name,
                    stepName,
                    teeth: [tooth],
                    cardNumber: i + 1,
                    totalCards: selectedTreatment.duration,
                    isSequential: selectedTreatment.duration > 1,
                    treatmentKey,
                    availableTreatments: treatments,
                    selectedTreatmentIndex,
                    hasMultipleTreatments: treatments.length > 1,
                    completed: false
                });
            }
        }
    });

    return nodes;
};
```

### ノードデータ構造の拡張

```javascript
// 既存ノード
{
    condition: "C2",           // 表示・ロジック両方で使用
    // ... 他のフィールド
}

// 変遷後のノード
{
    condition: "C2→C3",        // 表示用
    actualCondition: "C3",     // ロジック用（treatmentRules検索等）
    // ... 他のフィールド
}
```

**注意**: `actualCondition` が存在する場合はそれを使用、なければ `condition` を使用するロジックが必要

## 検証計画

### テストケース1: 基本動作
1. 歯11にC2治療（3ステップ）を追加
2. 3ステップをスケジュールに配置
3. Step2で「C3に変更」を実行
4. **期待結果**:
   - C2-Step1: `completed: true`, `condition: "C2"`（緑色表示、元病名）
   - C2-Step2, Step3: 削除
   - 新規ノード: `condition: "C2→C3"`, `actualCondition: "C3"`

### テストケース2: 複数シーケンス
1. 歯11にC2治療とP1治療を追加
2. 両方をスケジュールに配置
3. C2のStep2で「C3に変更」を実行
4. **期待結果**:
   - C2-Step1: `completed: true`, `condition: "C2"`
   - C2-Step2, Step3: 削除 → `"C2→C3"` ノードに置換
   - P1治療: **変更なし**（condition: "P1" のまま）

### テストケース3: 最初のステップから変更
1. 歯11にC2治療（3ステップ）を追加
2. Step1で「C3に変更」を実行
4. **期待結果**:
   - 完了扱いになるノードなし
   - C2の全ステップが削除
   - 新規ノード: `condition: "C2→C3"`, `actualCondition: "C3"`

### テストケース4: 既に完了済みのノードがある場合
1. 歯11にC2治療（3ステップ）を追加
2. Step1を手動で完了済みにする
3. Step2で「C3に変更」を実行
4. **期待結果**:
   - C2-Step1: `completed: true`, `condition: "C2"`（変更なし）
   - C2-Step2, Step3: 削除 → `"C2→C3"` ノードに置換

### テストケース5: 連続変更（C1→C2→C3）
1. 歯11にC1治療（3ステップ）を追加
2. Step2で「C2に変更」を実行
3. さらに新しいC2→ノードのStep1で「C3に変更」を実行
4. **期待結果**:
   - C1-Step1: `completed: true`, `condition: "C1"`
   - C1→C2-Step1: `completed: true`, `condition: "C1→C2"`（※この挙動は要確認）
   - 新規ノード: `condition: "C1→C2→C3"`, `actualCondition: "C3"`

### テストケース6: UI表示確認
1. 変遷ノードがスケジュール上で正しく表示されること
2. `"C2→C3"` の形式で病名が表示されること
3. 色分けや優先度ロジックが `actualCondition` を参照すること

---

## 実装検証結果（2026-01-10）

### ✅ 実装済み項目

| 項目 | 状態 | 備考 |
|------|------|------|
| `generateNodesForCondition` ヘルパー関数 | ✅ 完了 | 仕様書通りに実装 |
| `divergeTreatmentPlan` 関数の修正 | ✅ 完了 | 仕様書通りに実装 |
| `actualCondition` フィールドの追加 | ✅ 完了 | 新規ノードに追加 |
| DraggableCard.jsx の `actualCondition` 対応 | ✅ 完了 | 色決定ロジックを修正 |

### ⚠️ 発見された問題点

#### 問題1: スケジュール上のノードを検索できない

**現象**: `divergeTreatmentPlan` は `workflow.find()` でノードを検索しているが、ノードがスケジュールに配置されている場合、workflowからは見つからない可能性がある。

**原因**: 他の関数（`splitToothFromNode`, `mergeToothToNode`など）では workflowとスケジュール両方を検索するパターンを使用しているが、`divergeTreatmentPlan` では workflow のみを検索している。

**修正方法**:
```javascript
const divergeTreatmentPlan = (nodeId, newCondition) => {
    // 1. 起点ノードの情報を取得（workflowとスケジュール両方を検索）
    let sourceNode = workflow.find(w => w.id === nodeId);
    let sourceScheduleDate = null;

    if (!sourceNode) {
        // スケジュール内を検索
        for (const day of treatmentSchedule) {
            const found = day.treatments.find(t => t.id === nodeId);
            if (found) {
                sourceNode = found;
                sourceScheduleDate = day.date;
                break;
            }
        }
    }

    if (!sourceNode) return { success: false, message: 'ノードが見つかりません。' };

    // ... 以降は同じ
};
```

#### 問題2: 同一groupIdのノードがスケジュールにも存在する場合の処理

**現象**: `priorNodeIds` と `idsToRemove` を workflow からのみ収集しているため、スケジュール上のノードが漏れる可能性がある。

**修正方法**:
```javascript
// 2. 同一シーケンス内のノードを特定（workflowとスケジュール両方から）
const allGroupNodes = [];

// workflowから収集
workflow.forEach(w => {
    if (w.groupId === groupId) {
        allGroupNodes.push(w);
    }
});

// スケジュールからも収集（重複を避ける）
treatmentSchedule.forEach(day => {
    day.treatments.forEach(t => {
        if (t.groupId === groupId && !allGroupNodes.find(n => n.id === t.id)) {
            allGroupNodes.push(t);
        }
    });
});

// 前のステップを特定
const priorNodeIds = new Set();
allGroupNodes.forEach(w => {
    if (w.cardNumber < cardNumber && !w.completed) {
        priorNodeIds.add(w.id);
    }
});

// 削除対象を特定
const idsToRemove = new Set();
allGroupNodes.forEach(w => {
    if (w.cardNumber >= cardNumber) {
        idsToRemove.add(w.id);
    }
});
```

### 🔧 修正版 divergeTreatmentPlan 関数（完全版）

```javascript
const divergeTreatmentPlan = (nodeId, newCondition) => {
    // 1. 起点ノードの情報を取得（workflowとスケジュール両方を検索）
    let sourceNode = workflow.find(w => w.id === nodeId);
    let sourceScheduleDate = null;

    if (!sourceNode) {
        for (const day of treatmentSchedule) {
            const found = day.treatments.find(t => t.id === nodeId);
            if (found) {
                sourceNode = found;
                sourceScheduleDate = day.date;
                break;
            }
        }
    }

    if (!sourceNode) return { success: false, message: 'ノードが見つかりません。' };

    const { groupId, cardNumber, teeth: affectedTeeth, condition: oldCondition } = sourceNode;

    // 元の病名を取得（既に変遷表示の場合は最初の病名を抽出）
    const originalCondition = oldCondition.includes('→')
        ? oldCondition.split('→')[0]
        : oldCondition;

    // 変遷表示用の病名を生成
    const transitionCondition = `${oldCondition}→${newCondition}`;

    // 2. 同一シーケンス内のノードを全て収集（workflowとスケジュール両方から）
    const allGroupNodes = [];
    workflow.forEach(w => {
        if (w.groupId === groupId) {
            allGroupNodes.push(w);
        }
    });
    treatmentSchedule.forEach(day => {
        day.treatments.forEach(t => {
            if (t.groupId === groupId && !allGroupNodes.find(n => n.id === t.id)) {
                allGroupNodes.push(t);
            }
        });
    });

    // 3. 前のステップを特定
    const priorNodeIds = new Set();
    allGroupNodes.forEach(w => {
        if (w.cardNumber < cardNumber && !w.completed) {
            priorNodeIds.add(w.id);
        }
    });

    // 4. 削除対象を特定
    const idsToRemove = new Set();
    allGroupNodes.forEach(w => {
        if (w.cardNumber >= cardNumber) {
            idsToRemove.add(w.id);
        }
    });

    // 5. workflow更新
    const updatedWorkflow = workflow
        .filter(w => !idsToRemove.has(w.id))
        .map(w => priorNodeIds.has(w.id) ? { ...w, completed: true } : w);

    // 6. treatmentSchedule更新
    setTreatmentSchedule(prev => prev.map(day => ({
        ...day,
        treatments: day.treatments
            .filter(t => !idsToRemove.has(t.id))
            .map(t => priorNodeIds.has(t.id) ? { ...t, completed: true } : t)
    })));

    // 7. toothConditions更新
    setToothConditions(prev => {
        const next = { ...prev };
        affectedTeeth.forEach(tooth => {
            const currentConditions = Array.isArray(next[tooth]) ? next[tooth] : [next[tooth]].filter(Boolean);
            const filtered = currentConditions.filter(c => {
                const baseCondition = c.includes('→') ? c.split('→').pop() : c;
                return baseCondition !== originalCondition && baseCondition !== oldCondition.split('→').pop();
            });
            next[tooth] = [...filtered, newCondition];
        });
        return next;
    });

    // 8. 新しい治療ノードを生成して追加
    const newNodes = generateNodesForCondition(transitionCondition, newCondition, affectedTeeth);
    setWorkflow([...updatedWorkflow, ...newNodes]);

    return { success: true, message: `病名を ${oldCondition} から ${newCondition} へ変更しました。` };
};
```

### 📋 適用手順

1. `src/hooks/useTreatmentWorkflow.js` の `divergeTreatmentPlan` 関数を上記の修正版に置き換える
2. ビルドして構文エラーがないことを確認: `npm run build`
3. テストケース1〜6を実行して動作確認

### ✅ 修正適用完了（2026-01-10）

上記の修正を `src/hooks/useTreatmentWorkflow.js` に適用済み。ビルド成功確認済み。

**変更内容**:
- `divergeTreatmentPlan` 関数がworkflowとスケジュール両方からノードを検索するように修正
- 同一groupIdのノードをworkflowとスケジュール両方から収集するように修正

---

## 追加修正（2026-01-10 #2）

### 問題3: スケジュール上で病名変更すると新規ノードが未スケジュールに戻る

**現象**: スケジュールに配置されているノードで病名を変更すると、新しく生成されたノードが未スケジュール（workflow）に戻ってしまう。

**原因**: 新しいノードは常に`workflow`に追加されていたため、スケジュールに配置されない。

**修正内容**:
- 起点ノードがスケジュール上にあった場合（`sourceScheduleDate`が設定されている場合）、新しいノードもスケジュールに自動配置
- 起点ノードと同じ日から順次配置
- 必要に応じて日を追加

**修正後の動作**:
```
【変更前】スケジュール上のC2-Step2で「C3に変更」
  Day1: C2-Step1
  Day2: C2-Step2 ← ここで変更実行
  Day3: C2-Step3

【変更後】
  Day1: C2-Step1 (completed: true)
  Day2: C2→C3-Step1 ← 新規ノードがスケジュールに配置
  Day3: C2→C3-Step2
  Day4: C2→C3-Step3（必要に応じて日を追加）
```

### ✅ 修正適用完了

---

## 追加修正（2026-01-10 #3）

### 問題4: 完了済みノードが病名変更時に消えてしまう

**現象**: 治療済み（緑チェック）のノードが、病名変更時に一緒に削除されてしまう。

**原因**: 削除対象の特定時に`completed`フラグをチェックしていなかった。

**修正箇所**:
```javascript
// 修正前
allGroupNodes.forEach(w => {
    if (w.cardNumber >= cardNumber) {
        idsToRemove.add(w.id);
    }
});

// 修正後
allGroupNodes.forEach(w => {
    if (w.cardNumber >= cardNumber && !w.completed) {
        idsToRemove.add(w.id);
    }
});
```

**修正後の動作**:
```
【変更前】Step2で完了済み、Step3で「C3に変更」
  Day1: C2-Step1
  Day2: C2-Step2 (completed: true) ← 完了済み
  Day3: C2-Step3 ← ここで変更実行

【変更後】
  Day1: C2-Step1 (completed: true)
  Day2: C2-Step2 (completed: true) ← 保持される
  Day3: C2→C3-Step1
  Day4: C2→C3-Step2
```

### ✅ 修正適用完了
