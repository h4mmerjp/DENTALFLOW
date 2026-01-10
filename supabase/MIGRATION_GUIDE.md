# Supabase Migration Guide

このガイドでは、DentalFlowアプリケーションのSupabaseマイグレーションを実行する手順を説明します。

## 前提条件

- Supabaseプロジェクトが作成済み
- `.env.local`にSupabase URLとAnon Keyが設定済み

## マイグレーション実行手順

### 方法1: Supabase Dashboardを使用（推奨）

1. **Supabase Dashboardにログイン**
   - https://supabase.com/dashboard にアクセス
   - プロジェクト `bywowhmbnxshmwloedle` を開く

2. **SQL Editorを開く**
   - 左メニューから「SQL Editor」を選択
   - 「New query」をクリック

3. **マイグレーション実行**

   #### Step 1: スキーマ作成
   ```
   - migrations/001_schema.sql の内容をコピー
   - SQL Editorに貼り付け
   - 「Run」をクリック
   - ✅ 成功を確認
   ```

   #### Step 2: RPC関数作成
   ```
   - migrations/002_rpc.sql の内容をコピー
   - 新しいクエリを作成
   - 貼り付けて「Run」
   - ✅ 成功を確認
   ```

   #### Step 3: マスターデータ投入
   ```
   - migrations/003_seed.sql の内容をコピー
   - 新しいクエリを作成
   - 貼り付けて「Run」
   - ✅ 成功を確認
   ```

4. **検証**
   - 左メニュー「Table Editor」を開く
   - 以下のテーブルが作成されていることを確認:
     - ✅ conditions (9行)
     - ✅ treatment_templates
     - ✅ step_templates
     - ✅ exclusive_rules
     - ✅ patients
     - ✅ tooth_conditions
     - ✅ treatment_nodes
     - ✅ treatment_schedule
     - ✅ user_settings

### 方法2: Supabase CLI を使用（上級者向け）

1. **Supabase CLIをインストール**
   ```bash
   npm install -g supabase
   ```

2. **プロジェクトにログイン**
   ```bash
   supabase login
   supabase link --project-ref bywowhmbnxshmwloedle
   ```

3. **マイグレーション実行**
   ```bash
   supabase db push
   ```

## トラブルシューティング

### エラー: "extension uuid-ossp does not exist"
→ 001_schema.sql の最初に `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` が含まれていることを確認

### エラー: "relation does not exist"
→ マイグレーションを順番通り（001 → 002 → 003）に実行してください

### エラー: "duplicate key value violates unique constraint"
→ シードデータが既に存在します。問題ありません（ON CONFLICT句で対応済み）

## 次のステップ

マイグレーション完了後:

1. ✅ Task 2完了を確認
2. 📝 Task 3に進む: `useTreatmentWorkflowV2.js` の作成
3. 🧪 接続テストの実行

## ロールバック手順

万が一問題が発生した場合:

```sql
-- テーブルを全削除（注意: データも削除されます）
DROP TABLE IF EXISTS treatment_schedule CASCADE;
DROP TABLE IF EXISTS treatment_nodes CASCADE;
DROP TABLE IF EXISTS tooth_conditions CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS step_templates CASCADE;
DROP TABLE IF EXISTS treatment_templates CASCADE;
DROP TABLE IF EXISTS exclusive_rules CASCADE;
DROP TABLE IF EXISTS conditions CASCADE;

-- RPC関数を削除
DROP FUNCTION IF EXISTS diverge_treatment_plan;
DROP FUNCTION IF EXISTS auto_schedule_treatments;
DROP FUNCTION IF EXISTS clear_schedule;
DROP FUNCTION IF EXISTS get_patient_summary;
```

その後、再度001から実行してください。
