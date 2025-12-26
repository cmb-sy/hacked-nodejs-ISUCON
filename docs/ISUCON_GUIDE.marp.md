---
marp: true
---

# ISHOCON ガイド

---

## 目次

1. [ISUCON とは](#isuconとは)
2. [システム全体構成](#システム全体構成)
3. [コンポーネント詳細](#コンポーネント詳細)
4. [データベース設計](#データベース設計)
5. [アプリケーション構造](#アプリケーション構造)
6. [ベンチマーカーの仕組み](#ベンチマーカーの仕組み)
7. [Validation 詳細](#validation詳細)
8. [スコア計算](#スコア計算)
9. [Docker 構成](#docker構成)
10. [SSH 鍵について](#ssh鍵について)

---

## ISUCON とは

ISUCON は "Iikanjini Speed Up Contest" の略で、与えられた Web アプリケーションのパフォーマンスを限界まで引き上げる競技プログラミングです。チーム間で競い合い、ベンチマークツールで測定される「スコア」を最大化することを目指します。

コンテスト当日、お題となる Web アプリケーションが動くサーバーが何台か与えられ、それを制限時間内でどこまでチューニングできるのかを競います。

ベンチマーカーというツールが、ユーザーシナリオに沿った負荷試験を 1 分間実行し、その結果をスコアとして算出します。負荷試験中に捌けたリクエストの数によってスコアは変動し、Web サービスとして致命的なバグや、API の整合性が損なわれていれば Fail（0 点）となります。

---

## システム全体構成

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Docker Compose 環境                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────┐                                              │
│  │                      │                                              │
│  │   Benchmarker        │                                              │
│  │   (Go 1.13)          │                                              │
│  │                      │                                              │
│  └──────────┬───────────┘                                              │
│             │                                                           │
│             │ HTTP Request                                              │
│             │ webapp:8080                                               │
│             │                                                           │
│             ▼                                                           │
│  ┌──────────────────────┐                                              │
│  │                      │                                              │
│  │   Webapp             │                                              │
│  │   (Node.js/Express)  │                                              │
│  │   Port: 8080         │                                              │
│  │                      │                                              │
│  └──────────┬───────────┘                                              │
│             │                                                           │
│             │ MySQL Protocol                                            │
│             │ mysql:3306                                                │
│             │ DB: ishocon1                                              │
│             │                                                           │
│             ▼                                                           │
│  ┌──────────────────────┐                                              │
│  │                      │                                              │
│  │   MySQL 8.0          │                                              │
│  │   Port: 3306         │                                              │
│  │                      │                                              │
│  │   - ishocon1         │ (Webapp用データベース)                       │
│  │                      │                                              │
│  └──────────▲───────────┘                                              │
│             │                                                           │
│             │ MySQL Protocol                                            │
│             │ mysql:3306                                                │
│             │ DB: ishocon1                                              │
│             │                                                           │
│             │                                                           │
│  ┌──────────┴───────────┐                                              │
│  │                      │                                              │
│  │   Benchmarker        │                                              │
│  │   (データ検証用)      │                                              │
│  │                      │                                              │
│  └──────────────────────┘                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## コンポーネント詳細

### 1. Webapp（アプリケーション）

**技術スタック:**

- **言語**: TypeScript (Node.js 18)
- **フレームワーク**: Express.js
- **データベース**: MySQL 2 (mysql2/promise)
- **セッション管理**: express-session

**ディレクトリ構造:**

```
webapp/
├── src/
│   └── index.ts          # メインアプリケーション
├── views/                # EJSテンプレート
│   ├── index.ejs
│   ├── login.ejs
│   ├── product.ejs
│   └── mypage.ejs
├── public/               # 静的ファイル
│   ├── css/
│   └── images/
├── package.json
├── tsconfig.json
└── Dockerfile
```

### 2. MySQL（データベース）

**バージョン:** MySQL 8.0

**初期化プロセス:**

```
1. MySQLコンテナ起動
2. /docker-entrypoint-initdb.d/ のスクリプト実行
   ├── init.sql        → テーブル作成
   ├── ishocon1.dump   → 初期データ投入
   └── init_db.sh      → 追加データ生成
3. ヘルスチェック完了後、他コンテナが接続可能に
```

**データベース名:** `ishocon1`（単一データベース）

### 3. Benchmarker（ベンチマーカー）

**技術スタック:**

- **言語**: Go 1.13
- **HTTP クライアント**: 標準ライブラリ

**ディレクトリ構造:**

```
admin/benchmarker/
├── main.go           # エントリーポイント、メイン処理
├── validator.go      # バリデーション（データ整合性チェック）
├── scenario.go       # シナリオ実行（ユーザー行動シミュレーション）
├── request.go        # HTTPリクエスト送信
├── support.go        # ユーティリティ関数
├── go.mod            # Go モジュール定義
└── Dockerfile        # コンテナビルド定義
```

**環境変数:**

- `ISHOCON1_DB_HOST`: MySQL ホスト（デフォルト: `localhost`）
- `ISHOCON1_DB_PORT`: MySQL ポート（デフォルト: `3306`）
- `ISHOCON1_DB_USER`: MySQL ユーザー名（デフォルト: `ishocon`）
- `ISHOCON1_DB_PASSWORD`: MySQL パスワード（デフォルト: `ishocon`）
- `ISHOCON1_DB_NAME`: データベース名（デフォルト: `ishocon1`）

---

## データベース設計

### ER 図

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │       │  products   │       │ categories  │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │
│ name        │       │ name        │       │ name        │
│ email       │       │ description │       │ description │
│ password    │       │ image_path  │       │ parent_id   │
│ last_login  │       │ price       │       │ created_at  │
└──────┬──────┘       │ category_id │───────└─────────────┘
       │              │ created_at  │
       │              └──────┬──────┘
       │                     │
       │    ┌────────────────┼────────────────┐
       │    │                │                │
       ▼    ▼                ▼                ▼
┌─────────────┐       ┌─────────────┐  ┌─────────────┐
│  comments   │       │  histories  │  │   stocks    │
├─────────────┤       ├─────────────┤  ├─────────────┤
│ id (PK)     │       │ id (PK)     │  │ id (PK)     │
│ product_id  │       │ product_id  │  │ product_id  │
│ user_id     │       │ user_id     │  │ quantity    │
│ content     │       │ created_at  │  │ operation   │
│ created_at  │       └─────────────┘  │ created_at  │
└─────────────┘                        └─────────────┘
```

### テーブル一覧と件数

| テーブル名      | 用途             | 概算レコード数 |
| --------------- | ---------------- | -------------- |
| users           | ユーザー情報     | 5,000 件       |
| products        | 商品情報         | 10,000 件      |
| comments        | 商品コメント     | 200,000 件     |
| histories       | 購入履歴         | 500,000 件     |
| categories      | 商品カテゴリ     | 7 件           |
| stocks          | 在庫変動履歴     | 1,500 件       |
| favorites       | お気に入り       | 3,000 件       |
| product_views   | 閲覧履歴         | 5,000 件       |
| product_ratings | 商品評価         | 2,000 件       |
| tags            | タグマスタ       | 8 件           |
| product_tags    | 商品タグ紐付け   | 4,000 件       |
| user_follows    | フォロー関係     | 1,000 件       |
| notifications   | 通知             | 2,000 件       |
| price_history   | 価格変動履歴     | 3,000 件       |
| coupons         | クーポンマスタ   | 3 件           |
| user_coupons    | クーポン使用履歴 | 少量           |

---

## アプリケーション構造

### エンドポイント一覧

| メソッド | パス                | 説明                     | 認証 |
| -------- | ------------------- | ------------------------ | ---- |
| GET      | `/initialize`       | データ初期化             | 不要 |
| GET      | `/`                 | 商品一覧（トップページ） | 不要 |
| GET      | `/login`            | ログインページ表示       | 不要 |
| POST     | `/login`            | ログイン処理             | 不要 |
| GET      | `/logout`           | ログアウト処理           | 必要 |
| GET      | `/products/:id`     | 商品詳細ページ           | 不要 |
| POST     | `/products/buy/:id` | 商品購入処理             | 必要 |
| POST     | `/comments/:id`     | コメント投稿             | 必要 |
| GET      | `/users/:userId`    | ユーザーページ           | 不要 |

### リクエストフロー（商品購入）

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Client  │    │  Webapp  │    │  MySQL   │    │  Session │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │               │
     │ POST /login   │               │               │
     │──────────────▶│               │               │
     │               │ SELECT user   │               │
     │               │──────────────▶│               │
     │               │◀──────────────│               │
     │               │               │  Set Session  │
     │               │──────────────────────────────▶│
     │◀──────────────│               │               │
     │  Set-Cookie   │               │               │
     │               │               │               │
     │ POST /buy/123 │               │               │
     │──────────────▶│               │               │
     │               │  Get Session  │               │
     │               │◀──────────────────────────────│
     │               │               │               │
     │               │ SELECT product│               │
     │               │──────────────▶│               │
     │               │◀──────────────│               │
     │               │               │               │
     │               │ INSERT history│               │
     │               │──────────────▶│               │
     │               │◀──────────────│               │
     │               │               │               │
     │◀──────────────│               │               │
     │   Redirect    │               │               │
```

---

## ベンチマーカーの仕組み

### 実行フロー

ベンチマーカーは以下の順序で処理を実行します：

```
┌─────────────────────────────────────────────────────────────────┐
│                    ベンチマーク実行フロー                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 初期化フェーズ                                              │
│     └── GET /initialize を呼び出し                              │
│         └── アプリケーションがDBを初期状態にリセット            │
│                                                                 │
│  2. バリデーションフェーズ (約15秒)                             │
│     ├── データ初期化確認                                        │
│     ├── GET /index (page=10) チェック                           │
│     ├── GET /products/:id チェック                              │
│     ├── GET /users/:userId チェック                             │
│     ├── ログイン・購入テスト                                    │
│     ├── コメント投稿テスト                                      │
│     └── GET /index (page=0, ログイン後) チェック                │
│                                                                 │
│  3. シナリオ実行フェーズ (約45秒)                               │
│     ├── 複数の仮想ユーザーが並列でアクセス                      │
│     ├── 商品閲覧 → ログイン → 購入 → コメント                   │
│     └── 成功したリクエストをカウント                            │
│                                                                 │
│  4. スコア計算                                                  │
│     └── Score = 成功リクエスト数 - エラーペナルティ             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### コマンド

```bash
# ローカル環境（Docker Compose）
docker compose run --rm benchmarker

# または、すべてのサービスを起動してから実行
docker compose up -d
docker compose restart benchmarker

# EC2環境
cd /home/ishocon/benchmarker
./benchmark --ip 127.0.0.1
```

**オプション:**

- `--ip IP`: ターゲットのIPアドレスとポートを指定（デフォルト: `127.0.0.1:80`）
- **注意**: `--workload`オプションは使用できません。workloadは常に最大値（5）で固定されています。

**実行例:**

```bash
# Docker Compose環境
docker compose run --rm benchmarker

# EC2環境（ポート8080で実行）
./benchmark --ip 127.0.0.1:8080
```

---

## Validation 詳細

Validation はベンチマーク実行前にアプリケーションが正しく動作しているかを検証するフェーズです。**Validation に失敗するとスコアは 0 点**となります。

### Validation 項目一覧

| #   | 項目名            | チェック内容                     | エラー時のメッセージ                           |
| --- | ----------------- | -------------------------------- | ---------------------------------------------- |
| 1   | データ初期化      | `/initialize`が正常に完了する    | `Initialize failed`                            |
| 2   | 商品一覧(page=10) | 50 件の商品が返される            | `商品数が正しくありません`                     |
| 3   | 商品 ID 範囲      | 全商品の ID が 1〜10000 の範囲内 | `商品IDが範囲外です`                           |
| 4   | 商品詳細          | 商品 10000 のコメントが 20 件    | `コメント数が正しくありません`                 |
| 5   | ユーザーページ    | `/users/1500`が正常に表示        | `ユーザーページの取得に失敗`                   |
| 6   | ログイン          | 正しい認証情報でログイン可能     | `ログインに失敗しました`                       |
| 7   | 購入処理          | 商品購入後、履歴に反映される     | `購入履歴が正しくありません`                   |
| 8   | コメント投稿      | 投稿後、コメント数が 21 件になる | `コメント投稿後のコメント数が正しくありません` |
| 9   | ログイン後一覧    | ログイン状態で商品一覧が表示     | `ログイン後の商品一覧取得に失敗`               |

### 各 Validation 項目の詳細

#### 1. データ初期化チェック

```go
// GET /initialize を呼び出し
// タイムアウト: 10分
// 期待: HTTPステータス200
```

**よくある失敗原因:**

- `/initialize`エンドポイントが未実装
- 初期化処理がタイムアウト（10 分超過）
- 初期化中に DB エラーが発生

#### 2. 商品一覧チェック (page=10)

```go
// GET /?page=10 を呼び出し
// 期待: 商品が正確に50件返される
// 期待: 各商品のIDが1〜10000の範囲内
```

**よくある失敗原因:**

- ページングの計算ミス（0-indexed vs 1-indexed）
- OFFSET 計算のバグ
- 商品データの破損

#### 3. 商品詳細・コメント数チェック

```go
// GET /products/10000 を呼び出し
// 期待: コメント数が正確に20件

// ログイン後、コメント投稿
// POST /comments/10000
// 期待: コメント数が21件に増加
```

**よくある失敗原因:**

- コメントのカウントロジックのバグ
- コメント投稿後のキャッシュ問題
- `id > 200000`のコメントが削除されていない

#### 4. ログイン・購入テスト

```go
// 1. POST /login でログイン
//    ユーザー: ランダムに選択されたユーザー
//
// 2. POST /products/buy/10000 で商品購入
//
// 3. GET /users/{userId} で履歴確認
//    期待: 購入した商品が履歴に含まれる
```

**よくある失敗原因:**

- セッション管理のバグ
- 購入処理の DB 書き込み失敗
- 履歴取得クエリのバグ

#### 5. タイムアウトによる失敗

各リクエストには**30 秒のタイムアウト**が設定されています。

```
Validation: GET /users/1500 チェック中...
ERROR: timeout waiting for response
```

**よくある原因:**

- N+1 クエリによる大量の DB アクセス
- 重い計算処理（全商品スキャン等）
- データベース接続プールの枯渇

### Validation 成功時のログ

```
2025/12/24 02:55:36 Start GET /initialize
2025/12/24 02:55:36 GET /initialize completed in 35.268208ms
2025/12/24 02:55:36 Benchmark Start!  Workload: 5
2025/12/24 02:55:36 Validation: データ初期化中...
2025/12/24 02:55:36 Validation: GET /index (page=10) チェック中...
2025/12/24 02:55:41 Validation: GET /products/:id チェック中...
2025/12/24 02:55:41 Validation: GET /users/1500 チェック中...
2025/12/24 02:55:42 Validation: ユーザー 3966 でログイン・購入テスト実行中...
2025/12/24 02:55:48 Validation: GET /users/3966 (ログイン後) チェック中...
2025/12/24 02:55:49 Validation: コメント投稿テスト実行中...
2025/12/24 02:55:50 Validation: GET /index (page=0, ログイン後) チェック中...
2025/12/24 02:55:55 Validation: 全チェック完了
```

### Validation 失敗時のトラブルシューティング

| エラーメッセージ               | 原因                             | 対処法                    |
| ------------------------------ | -------------------------------- | ------------------------- |
| `timeout waiting for response` | レスポンスが 30 秒以内に返らない | 重い処理の特定と最適化    |
| `商品数が正しくありません`     | ページングのバグ                 | LIMIT/OFFSET の計算を確認 |
| `コメント数が正しくありません` | コメントカウントのバグ           | WHERE 条件を確認          |
| `購入履歴が正しくありません`   | 履歴の保存/取得のバグ            | INSERT/SELECT を確認      |
| `Initialize failed`            | /initialize のエラー             | 初期化処理のログを確認    |

---

## スコア計算

### 計算式

```
スコア = (成功リクエスト数 × 1) - (4xxエラー数 × 20) - (その他エラー数 × 50)
```

### スコア詳細

| 判定     | ステータスコード      | スコア変動 | 備考                                    |
| :------- | :-------------------- | :--------- | :-------------------------------------- |
| **成功** | 200 OK                | **+1 点**  | 全ての操作（購入、閲覧等）で一律        |
| **失敗** | 4xx (Client Error)    | **-20 点** | 404 Not Found, 403 Forbidden 等         |
| **失敗** | その他 (5xx, Timeout) | **-50 点** | 500 Internal Server Error, 通信エラー等 |

### シナリオ実行

ベンチマーカーは「性格の異なる複数のユーザーが、同時に、大量に押し寄せてくる状況」をシミュレートします：

- **閲覧ユーザー**: ログインして商品一覧や画像を大量に見るが、買わずにログアウト
- **ストーカーユーザー**: ログインせずに、他人の購入履歴ページ（マイページ）を執拗に閲覧
- **購入ユーザー**: ログインして商品を大量に購入し、コメントを投稿

**Workload:** 常に最大値（5）で固定されています。複数の仮想ユーザーが並列でアクセスします。

---

## Docker 構成

### docker-compose.yml

```yaml
services:
  webapp:
    build: ./webapp
    ports:
      - "8080:8080"
    environment:
      - ISHOCON1_DB_HOST=mysql
      - ISHOCON1_DB_PORT=3306
      - ISHOCON1_DB_USER=root
      - ISHOCON1_DB_PASSWORD=root
      - ISHOCON1_DB_NAME=ishocon1
    depends_on:
      mysql:
        condition: service_healthy

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=root
    ports:
      - "3306:3306"
    volumes:
      - ./admin/init_db.sh:/docker-entrypoint-initdb.d/00_init_db.sh
      - ./admin/init.sql:/data/init.sql
      - ./admin/ishocon1.dump:/data/ishocon1.dump
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-proot"]
      interval: 5s
      timeout: 3s
      retries: 30

  benchmarker:
    build: ./admin/benchmarker
    environment:
      - ISHOCON1_DB_HOST=mysql
      - ISHOCON1_DB_PORT=3306
      - ISHOCON1_DB_USER=root
      - ISHOCON1_DB_PASSWORD=root
      - ISHOCON1_DB_NAME=ishocon1
    depends_on:
      webapp:
        condition: service_started
      mysql:
        condition: service_healthy
    command: ["./benchmark", "--ip", "webapp:8080"]
```

### 起動方法

```bash
# すべてのサービスを起動
docker compose up -d

# ベンチマーカーを実行
docker compose run --rm benchmarker

# または、既存のコンテナで再実行
docker compose restart benchmarker
docker compose logs -f benchmarker
```

---

## SSH 鍵について

Ed25519 というアルゴリズムを使用します。

### 鍵の生成

```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
```

| ファイル名       | 種類   | 役割           |
| :--------------- | :----- | :------------- |
| `id_ed25519`     | 秘密鍵 | 認証用         |
| `id_ed25519.pub` | 公開鍵 | サーバーに登録 |

### ローカル → EC2 への接続

Terraform が EC2 構築時に GitHub からあなたの公開鍵を取得し、サーバーの `authorized_keys` に自動登録します。

- **使う鍵**: ローカルで生成した鍵
- **登録先**: GitHub Settings > SSH and GPG keys

### EC2 → GitHub への接続

サーバーからコードを `git push` / `git pull` するため、EC2 用の鍵が必要です。

- **使う鍵**: EC2 の中で生成した鍵 (`/home/ishocon/.ssh/id_ed25519`)
- **登録先**: GitHub の「個人の設定」または「Deploy Keys」

---

## スコアボードシステム

### スコア送信の経路（書き込み）

```
[EC2 インスタンス]
│
│ admin/benchmarker/scenario.go
│ postScore() 実行
│
│ PUT /teams
│ {team: "team1", score: 1234, timestamp: "..."}
│
▼
[API Gateway] (AWS)
│
│ PUT /teams ルート
│
▼
[Lambda 関数] (AWS)
│
│ Python 3.12
│ scoreboard_lambda.py.tpl
│
│ table.put_item()
│
▼
[DynamoDB] (AWS)
│
│ {team: "team1", score: 1234, timestamp: "..."}
│ 永続保存
│
└─ 保存完了
```

### スコア表示の実行場所（読み取り）

```
[ユーザーのブラウザ]
│
│ 1. S3 の静的ウェブサイトにアクセス
│ http://scoreboard-bucket.s3-website-region.amazonaws.com
│
│ 2. index.html を読み込む
│
│ 3. dist/main.js を読み込む（TypeScript からコンパイル済み）
│
│ 4. fetchData() が実行される
│
│ GET /teams
│ ────────────────────────────────────────┐
│ │
▼ │
[API Gateway] (AWS) │
│ │
│ GET /teams ルート │
│ │
▼ │
[Lambda 関数] (AWS) │
│ │
│ table.scan() │
│ │
▼ │
[DynamoDB] (AWS) │
│ │
│ 全チームのスコアを取得 │
│ │
└────────────────────────────────────────────┘
│
│ JSON 形式で返却
│ [{team: "team1", score: 1234, ...}, ...]
│
▼
[ブラウザ]
│
│ renderRankingTable() → ランキング表を描画
│ renderTimeline() → タイムライングラフを描画
│ renderBarChart() → バーチャートを描画
│
│ 30 秒後に再実行（setInterval）
```

---

## 参考資料

- [Express.js 公式ドキュメント](https://expressjs.com/)
- [MySQL 8.0 リファレンス](https://dev.mysql.com/doc/refman/8.0/en/)
- [Docker Compose ドキュメント](https://docs.docker.com/compose/)
- [Go 公式ドキュメント](https://golang.org/doc/)
