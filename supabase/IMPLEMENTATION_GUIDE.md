# DENTALFLOW DB移行 実装ガイド

## セットアップ手順

### Step 1: Supabaseプロジェクト作成

1. [Supabase Dashboard](https://app.supabase.com) にアクセス
2. 新しいプロジェクトを作成
   - Organization: 任意
   - Project name: `dentalflow`
   - Database Password: 安全なパスワードを設定
   - Region: `Southeast Asia (Singapore)` または最適な地域
3. プロジェクト作成完了まで待機（3-5分）

### Step 2: 環境変数設定

1. Supabase Dashboard で以下を確認：
   - Project Settings → API
   - `Project URL` と `anon` キーをコピー

2. `.env.local` ファイルを作成：
```bash
cp .env.example .env.local
```

3. `.env.local` に値を設定：
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...xxxxx
```

### Step 3: マイグレーション実行

#### Option A: Supabase CLI使用（推奨）

```bash
# Supabase CLIをインストール（初回のみ）
npm install -g supabase

# ログイン
supabase login

# リンク
supabase link --project-ref your-project-ref

# マイグレーション実行
supabase db push
```

#### Option B: SQL Editor手動実行

1. Supabase Dashboard → SQL Editor
2. 以下のファイルの内容をコピー&ペーストして実行：
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rpc_functions.sql`
   - `supabase/migrations/003_seed_data.sql`

### Step 4: インストール＆確認

```bash
# 依存関係インストール（未実施の場合）
npm install @supabase/supabase-js

# 開発サーバー起動
npm run dev

# ブラウザで http://localhost:5173 を開く
```

---

## マイグレーション詳細

### ファイル構成

```
supabase/migrations/
├── 001_initial_schema.sql      # テーブル・ビュー・RLS定義
├── 002_rpc_functions.sql       # PostgreSQL RPC関数
└── 003_seed_data.sql           # マスタデータ
```

### 各マイグレーションの内容

#### 001_initial_schema.sql
- **作成テーブル**:
  - マスタ: `conditions`, `steps`, `treatment_rules`, `treatment_rule_steps`
  - トランザクション: `patients`, `tooth_conditions`, `treatment_groups`, `treatment_group_teeth`, `treatment_nodes`
  - 設定: `scheduling_rules`, `exclusive_rules`
- **作成ビュー**:
  - `treatment_nodes_view`: 治療ノード詳細ビュー
  - `daily_schedule_view`: 日別スケジュールビュー
- **RLS**: すべてのテーブルで全アクセス許可（将来的にマルチユーザー対応時に制限予定）

#### 002_rpc_functions.sql
- `generate_treatment_nodes(p_patient_id, p_grouping_mode)`: 治療ノード生成
- `execute_auto_scheduling(p_patient_id, p_from_date)`: 自動スケジューリング
- `split_tooth_from_node(p_node_id, p_teeth_to_split, p_target_date)`: 歯の分離
- `merge_nodes(p_source_group_id, p_target_group_id)`: ノード合体
- `check_exclusive_rules(p_condition_code, p_current_conditions)`: 排他ルールチェック

#### 003_seed_data.sql
- デフォルト病名: 9種類（C1-C4, pul, per, P1, P2, 欠損）
- デフォルトステップ: 16個
- デフォルト治療ルール: 各病名に対する治療法
- デフォルト排他ルール: C-groupとP-group
- グローバルスケジューリングルール

---

## フロントエンド統合

### 既存コードの置き換え（段階的）

#### Phase 1: 並行運用（推奨）

1. **新フックを並行して使用**:
```javascript
// 旧フック
import { useTreatmentWorkflow } from '../hooks/useTreatmentWorkflow';

// 新フック
import { useTreatmentWorkflowV2 } from '../hooks/useTreatmentWorkflowV2';

// App.jsで選択
const useNewDB = true; // falseで旧フックに切り替え可能
```

2. **データ検証ロジック**:
```javascript
// localStorageとDBの同期チェック
if (useNewDB) {
  const newData = await useTreatmentWorkflowV2(patientId);
  const oldData = useTreatmentWorkflow();
  // 差分ログ
  console.log('DB vs localStorage:', { newData, oldData });
}
```

#### Phase 2: DB優先（テスト後）

```javascript
// App.jsのフック呼び出しを置き換え
const workflow = useTreatmentWorkflowV2(patientId);

// コンポーネントのプロップを変更
// workflow → treatmentNodes
// treatmentSchedule → schedule
```

#### Phase 3: localStorageの廃止

```javascript
// useLocalStorage呼び出しをすべて削除
// 削除ファイル: src/hooks/useLocalStorage.js
```

---

## データマイグレーション（既存データの移行）

### localStorageからのインポート

```javascript
// src/utils/migrateToSupabase.js
import { supabase } from '../lib/supabase';

export async function migrateFromLocalStorage() {
  const toothConditions = JSON.parse(
    localStorage.getItem('toothConditions') || '{}'
  );
  const treatmentSchedule = JSON.parse(
    localStorage.getItem('treatmentSchedule') || '[]'
  );

  // 1. 患者作成
  const { data: patient } = await supabase
    .from('patients')
    .insert({ name: 'インポート患者' })
    .select()
    .single();

  // 2. 歯の状態をインポート
  for (const [tooth, conditionCodes] of Object.entries(toothConditions)) {
    for (const code of conditionCodes) {
      const { data: condition } = await supabase
        .from('conditions')
        .select('id')
        .eq('code', code)
        .single();

      if (condition) {
        await supabase.from('tooth_conditions').insert({
          patient_id: patient.id,
          tooth_number: tooth,
          condition_id: condition.id
        });
      }
    }
  }

  // 3. 治療ノード生成
  await supabase.rpc('generate_treatment_nodes', {
    p_patient_id: patient.id,
    p_grouping_mode: 'individual'
  });

  // 4. スケジュール復元
  // ... (treatmentScheduleから配置情報を復元)

  return { success: true, patientId: patient.id };
}
```

使用方法：
```javascript
// App.jsで1回だけ実行
import { migrateFromLocalStorage } from './utils/migrateToSupabase';

const handleMigrate = async () => {
  try {
    const result = await migrateFromLocalStorage();
    console.log('Migration successful:', result);
  } catch (error) {
    console.error('Migration failed:', error);
  }
};
```

---

## テスト手順

### ユニットテスト（RPC関数）

Supabase SQL Editorで各関数をテスト：

```sql
-- テスト患者作成
INSERT INTO patients (name) VALUES ('テスト患者')
RETURNING id;

-- 歯の状態を追加
INSERT INTO tooth_conditions (patient_id, tooth_number, condition_id)
SELECT 'patient-uuid', '11', id FROM conditions WHERE code = 'C2';

-- 治療ノード生成
SELECT * FROM generate_treatment_nodes('patient-uuid', 'individual');

-- 自動スケジューリング
SELECT * FROM execute_auto_scheduling('patient-uuid');
```

### E2Eテスト

1. **フロントエンド操作テスト**:
   - 患者作成
   - 歯の状態設定
   - 治療ノード生成確認
   - ドラッグ&ドロップ操作
   - スケジュール変更

2. **データ整合性テスト**:
   - split_tooth後のノード同期確認
   - merge_nodes後の重複排除確認
   - 排他ルール違反チェック

---

## トラブルシューティング

### Issue: RPC関数が見つからない

**原因**: マイグレーション未実行
**解決策**:
```bash
# SQL Editorで以下を実行
\i supabase/migrations/002_rpc_functions.sql
```

### Issue: 権限エラー（permission denied）

**原因**: RLSポリシーが制限的
**解決策**:
```sql
-- RLSを一時的に無効化（テスト目的のみ）
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
```

### Issue: Supabase接続エラー

**原因**: 環境変数が未設定
**解決策**:
```bash
# .env.localを確認
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# ない場合は設定
# Supabase Dashboard → Settings → API から値をコピー
```

### Issue: パフォーマンス低下

**原因**: インデックス未作成
**解決策**:
```bash
# インデックス確認
SELECT * FROM pg_indexes WHERE tablename LIKE 'treatment%';

# 不足していれば再実行
\i supabase/migrations/001_initial_schema.sql
```

---

## 実装チェックリスト

- [ ] Supabaseプロジェクト作成
- [ ] 環境変数設定（.env.local）
- [ ] マイグレーション実行（3ファイル）
- [ ] マスタデータ確認（conditions等が追加されたか）
- [ ] RPC関数確認（SQL Editorで実行確認）
- [ ] `useTreatmentWorkflowV2.js` インポート確認
- [ ] App.jsで新フック使用
- [ ] ブラウザコンソールでエラー確認
- [ ] 基本操作テスト（患者作成→ノード生成→スケジューリング）
- [ ] localStorageデータマイグレーション（既存データ）

---

## 次のステップ

1. **Phase 3**: コンポーネント更新
   - `WorkflowBoard.jsx` の `workflow` → `treatmentNodes`
   - `ScheduleCalendar.jsx` の `treatmentSchedule` → `schedule`
   - ドラッグ&ドロップの DB連携

2. **Phase 4**: テスト・最適化
   - Realtime subscription対応
   - キャッシング戦略
   - エラーハンドリング改善

3. **Phase 5**: 本番デプロイ
   - セキュリティ監査（RLS）
   - パフォーマンステスト
   - バックアップ設定

---

## 質問・問題報告

各フェーズの実装中に問題が発生した場合、以下を確認してください：

1. SQL Editorでマイグレーションが正常に実行されたか
2. `.env.local` に正しい認証情報が設定されているか
3. ブラウザの開発者ツール（Network/Console）にエラーが表示されていないか
4. Supabaseダッシュボードのログ（Logs）を確認
