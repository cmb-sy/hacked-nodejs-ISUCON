## 対象

ISUCON 準備（運営）係

## システムの構成要素

- **EC2 インスタンス**: 各チーム用のベンチマーカー実行環境
- **DynamoDB**: スコアデータの保存先
- **Lambda 関数**: スコアデータの取得・追加・削除を処理
- **API Gateway**: Lambda 関数への HTTP API エンドポイント
- **S3 バケット**: スコアボードの静的サイトホスティング

## 前提条件

### 必要なツール

以下のツールがインストールされている必要があります：

- **AWS CLI**: AWS リソースの操作
- **Terraform**: インフラのコード化
- **Node.js**: スコアボードのビルド
- **Git**: コード管理

### AWS アカウントの準備

1. AWS アカウントを作成（支払い情報を登録）
2. IAM ユーザーを作成し、以下の権限を付与：
   - EC2（インスタンス作成・削除）
   - VPC（ネットワーク作成）
   - DynamoDB（テーブル作成・操作）
   - Lambda（関数作成・実行）
   - API Gateway（API 作成・管理）
   - S3（バケット作成・オブジェクトアップロード）
   - IAM（ロール作成・ポリシー付与）

### AWS CLI の設定

```bash
aws configure
```

以下の情報を入力：

- **AWS Access Key ID**: IAM ユーザーのアクセスキー
- **AWS Secret Access Key**: IAM ユーザーのシークレットキー
- **Default region name**: `ap-northeast-1`（東京リージョン）
- **Default output format**: `json`

## AWS 環境デプロイ手順

### ステップ 1: Terraform 設定の編集

`contest/terraform/main/main.tf`を編集して、管理者とチーム情報を設定します：

```hcl
locals {
  admins = [
    "your_github_username",  // 管理者のGitHubユーザー名
  ]

  teams = {
    "team1" = [
      "member1_github_username",
      "member2_github_username",
      "member3_github_username",
    ],
    "team2" = [
      "member4_github_username",
      "member5_github_username",
    ],
  }
}

module "main" {
  source = "../module"

  admins = local.admins
  teams  = local.teams

  use_spot_instance = false  // コスト削減のためtrueにすることも可能
}
```

### ステップ 2: スコアボードのビルド

ローカルでビルドしたファイルを Terraform が読み込んで S3 にデプロイします。

#### 2.1 依存関係のインストール

```bash
cd contest/scoreboard
npm install
```

#### 2.2 TypeScript のコンパイル

```bash
npm run build
```

### ステップ 3: Terraform の初期化

```bash
cd contest/terraform/main
terraform init
```

### ステップ 4: 構築計画の確認

作成されるリソースを事前に確認します：

```bash
terraform plan
```

### ステップ 5: AWS リソースの作成

AWS リソースを構築します：

```bash
terraform apply
```

### ステップ 6: 構築結果の確認

```bash
terraform output
```

## リソースの削除

### 1. 削除されるリソースを確認

```bash
cd contest/terraform/main

# 削除されるリソースの一覧を確認（実際には削除しない）
terraform plan -destroy
```

### 2. すべてのリソースを削除

```bash
terraform destroy
```

確認プロンプトが表示されます：

```
Do you really want to destroy all resources?
  Terraform will destroy all your managed infrastructure, as shown above.
  There is no undo. Only 'yes' will be accepted to confirm.

  Enter a value:
```

`yes` と入力して Enter キーを押すと削除が開始されます。

**自動承認で削除する場合**:

```bash
terraform destroy -auto-approve
```

### 3. 削除の完了を確認

```bash
terraform show
# 出力: No resources found
```
