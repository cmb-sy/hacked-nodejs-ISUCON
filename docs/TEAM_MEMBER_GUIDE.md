# 開発環境構築ガイド

ISUCON の開発環境を整えるための手順書

## 開発環境構築の流れ

1. GitHub リポジトリの作成
2. ローカルマシンの SSH 鍵設定
3. EC2 への接続
4. EC2 内での SSH 鍵設定
5. EC2 で既存コードを GitHub に push
6. ローカルマシンでリポジトリをクローン
7. ローカルマシンで開発
8. EC2 で取得して反映

## ステップ 1: GitHub リポジトリの作成

1. GitHub にログイン
2. 右上の「+」ボタン → 「New repository」をクリック
3. 以下の情報を入力：
   - **Repository name**: your_team_name
   - **Owner**: github_name_user
   - **Visibility**: private
   - **Initialize this repository with**: すべてチェックを外す
4. 「Create repository」をクリック

## ステップ 2: ローカルマシンの SSH 鍵設定

ローカルマシンから GitHub にアクセスできるように SSH 鍵を設定します。

### 2.1 SSH 鍵の生成

```bash
# ローカルで実行
ssh-keygen -t ed25519 -C "your_email@example.com"
```

### 2.2 GitHub に SSH 鍵を登録

1. GitHub にログイン
2. **Settings** → **SSH and GPG keys** → **New SSH key**
3. 生成した公開鍵（`~/.ssh/id_ed25519.pub`）の内容をコピーして登録

### 2.3 GitHub への接続確認

```bash
ssh -T git@github.com
```

**成功メッセージ**:

```
Hi <username>! You've successfully authenticated, but GitHub does not provide shell access.
```

## ステップ 3: EC2 への接続

EC2 インスタンスに接続する方法は 3 つあります。ネットワーク環境や好みに応じて選択してください。

**注意**: ISP/ファイアウォールにより SSH 接続（ポート 22）がブロックされている場合があります。その場合は、Session Manager または GUI を使用してください。

### 3.1 方法 1: SSH で接続

**前提条件**:

- SSH クライアントがインストールされている（macOS/Linux には標準でインストール済み）
- インスタンスの IP アドレスが分かっている
- セキュリティグループで SSH（ポート 22）が許可されている

**手順**:

```bash
ssh ishocon@<IPアドレス>
```

### 3.2 方法 2: Session Manager Plugin で接続

**前提条件**:

- AWS CLI がインストール・設定されている
- Session Manager Plugin がインストールされている
- SSM Agent がインスタンス上でオンラインになっている
- IAM ロールに SSM 権限が付与されている

**Session Manager Plugin のインストール**:

```bash
# macOS の場合（Homebrew）
brew install --cask session-manager-plugin

# インストール確認
which session-manager-plugin
session-manager-plugin --version
```

**接続手順**:

```bash
cd contest/terraform/main
aws ssm start-session --target $INSTANCE_ID
```

### 3.3 方法 3: AWS コンソールで接続

1. **AWS コンソールにアクセス**

   - https://console.aws.amazon.com/ にログイン

2. **EC2 コンソールを開く**

   - サービス検索で「EC2」を検索して開く

3. **インスタンスを選択**

   - 左メニューから「インスタンス」を選択
   - インスタンス一覧から対象インスタンスを選択
   - インスタンス ID や IP アドレスで検索可能

4. **接続ボタンをクリック**

   - 上部の「接続」ボタンをクリック

5. **Session Manager タブを選択**

   - 「接続」ダイアログで「Session Manager」タブを選択
   - 「接続」ボタンをクリック

6. **ブラウザ内ターミナルが開く**
   - ブラウザ内のターミナルが開き、インスタンスに接続されます

**接続後の操作**:

```bash
# デフォルトでは ssm-user ユーザーで接続されます
whoami
# 出力: ssm-user

# ishocon ユーザーに切り替え
sudo su - ishocon

# ホームディレクトリに移動
cd ~
```

## ステップ 4: EC2 内での SSH 鍵設定

EC2 から GitHub に `git push/pull` するために、EC2 内で SSH 鍵を生成します。

### 4.1 EC2 内で SSH 鍵を生成

```bash
# EC2内で実行
ssh-keygen -t ed25519 -C "your-email@example.com"
cat ~/.ssh/id_ed25519.pub
```

### 4.2 GitHub に公開鍵を登録

1. https://github.com/settings/keys にアクセス
2. 「New SSH key」をクリック
3. 以下を入力：
   - **Title**: `ISUCON EC2` など任意の名前
   - **Key type**: `Authentication Key`
   - **Key**: ステップ 4.2 でコピーした公開鍵を貼り付け
4. 「Add SSH key」をクリック

### 4.4 GitHub への接続確認

```bash
# EC2内で実行
ssh -T git@github.com
```

**成功メッセージ**:

```
Hi <username>! You've successfully authenticated, but GitHub does not provide shell access.
```

## ステップ 5: EC2 で既存コードを GitHub に push（初回のみ）

EC2 上の既存コードを GitHub リポジトリに push します。

```bash
sudo su -
cd /home/ishocon

# 1. Git リポジトリを初期化
git init -b main

# 2. Git 管理に含めるディレクトリを追加
git add .

# 3. コミット用のユーザー情報を設定
git config user.name "your-name"

# 4. 初回コミットを作成
git commit -m "Initial commit: ISUCON EC2 environment"

# 5. remote 設定
git remote remove origin 2>/dev/null || true
git remote add origin git@github.com:your-username/team_name.git

# 6. GitHub に push
git push -u origin main
```

## ステップ 6: ローカルマシンでリポジトリをクローン

ローカルマシンで開発を開始するために、GitHub リポジトリをクローンします。

```bash
git clone git@github.com:your-username/isucon-team-name.git
```

## ステップ 7: ローカルマシンで開発

ローカルマシンでコードを編集し、GitHub に push します。

```bash
# 1. 変更をコミット
git add .
git commit -m "Your commit message"

# 2. GitHub に push
git push origin main
```

## ステップ 8: EC2 で取得して反映

EC2 にコードを反映する方法は 2 つあります。チームの好みに合わせて選択してください。

### 8.1 方法 1: EC2 で手動で pull

**手順**:

```bash
# SSH で EC2 に接続してから実行してください

# 1. 作業ディレクトリに移動
cd /home/ishocon

# 2. 最新のコードを取得
git pull

# 3. アプリケーションコードのディレクトリに移動
cd /home/ishocon/webapp

# 4. 依存パッケージをインストール（package.json が変更された場合）
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
npm install

# 5. ビルド（TypeScript を JavaScript に変換など）
npm run build

# 6. サービスを再起動
systemctl restart ishocon-nodejs.service

# 7. ログでエラーがないか確認
journalctl -u ishocon-nodejs.service -n 50 --no-pager
```

### 8.2 方法 2: GitHub Actions で自動 deploy

**手順**:

1. **GitHub Actions ワークフローファイルを作成**

`.github/workflows/deploy.yml` を作成：

```yaml
on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER || 'root' }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ishocon
            git pull
            cd /home/ishocon/webapp
            export NVM_DIR="/root/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
            npm install
            npm run build
            systemctl restart ishocon-nodejs.service
```

2. **GitHub Secrets を設定**

GitHub リポジトリの Settings > Secrets and variables > Actions で以下を設定:

- `EC2_HOST`: EC2 の IP アドレス（例: `18.183.173.25`）
- `EC2_SSH_KEY`: EC2 に接続するための SSH 秘密鍵（ローカルマシン用の鍵）
- `EC2_USER`: `root` または `ssm-user`（Session Manager 経由の場合）

**動作確認方法**:

1. **ブラウザでアクセス**: EC2 の IP アドレスにアクセス（例: `http://18.183.173.25`）
2. **ログで確認**: `journalctl -u ishocon-nodejs.service -f` でリアルタイムログを確認（root ユーザーで実行）
3. **ベンチマーク実行**: ベンチマーカーを実行してスコアが上がるか確認

## ベンチマークの実行

### EC2 環境で実行の場合

EC2 インスタンスに SSH 接続してベンチマークを実行します。実行は `root` ユーザーで行う必要があります：

```bash
# EC2で実行
cd /home/ishocon/benchmarker
# ベンチマークを実行
./benchmark --ip 127.0.0.1
```

### ローカル環境（Docker）で実行

ローカル環境で開発・テストする場合は、Docker Compose を使用してベンチマークを実行できます。

**手順**:

```bash
# コンテナのビルドと起動
docker compose up -d --build

# ベンチマーカーの実行
docker compose run --rm benchmarker

# コンテナの停止
docker compose down -v
```
