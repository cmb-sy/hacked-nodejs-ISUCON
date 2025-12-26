#!/bin/bash
# EC2セットアップスクリプト（S3からダウンロードして実行）
set -e
exec > >(tee -a /var/log/setup.log) 2>&1

echo "=== Setup started at $(date) ==="

# 環境変数を読み込み
source /etc/environment 2>/dev/null || true

S3_BUCKET="${S3_BUCKET:-}"
DATA_DIR="/home/ishocon/data"
WEBAPP_DIR="/home/ishocon/webapp"
BENCH_DIR="/home/ishocon/benchmarker"

# ディレクトリ作成
mkdir -p "$DATA_DIR" "$WEBAPP_DIR" "$BENCH_DIR" /tmp/webapp

# S3からファイルをダウンロード
echo "Downloading files from S3..."
aws s3 cp "s3://${S3_BUCKET}/ishocon1.dump.tar.gz" "$DATA_DIR/" || true
aws s3 cp "s3://${S3_BUCKET}/admin/init.sql" "$DATA_DIR/" || true
aws s3 cp "s3://${S3_BUCKET}/webapp_nodejs.zip" /tmp/webapp/ || true
aws s3 cp "s3://${S3_BUCKET}/benchmarker.zip" /tmp/ || true

# dumpを展開
[ -f "$DATA_DIR/ishocon1.dump.tar.gz" ] && tar -xzf "$DATA_DIR/ishocon1.dump.tar.gz" -C "$DATA_DIR" || true

# Webappをビルド
echo "Building webapp..."
cd /tmp/webapp
unzip -q webapp_nodejs.zip 2>/dev/null || true
rm -rf "$WEBAPP_DIR"/* 2>/dev/null || true
mv /tmp/webapp/* "$WEBAPP_DIR/" 2>/dev/null || true
cd "$WEBAPP_DIR"
[ -f package.json ] && npm install && npm run build
rm -rf /tmp/webapp

# ベンチマーカーをビルド
echo "Building benchmarker..."
cd /tmp && unzip -q benchmarker.zip -d /tmp/bench_tmp 2>/dev/null || true
mv /tmp/bench_tmp/* "$BENCH_DIR/" 2>/dev/null || true
cd "$BENCH_DIR"
export GOPATH=/root/go GOCACHE=/root/.cache/go-build
mkdir -p "$GOCACHE"
go mod download && go build -o benchmark .
chmod +x benchmark
rm -rf /tmp/bench_tmp /tmp/benchmarker.zip

# Nginx設定
cat > /etc/nginx/sites-available/ishocon << 'EOF'
server {
  listen 80 default_server;
  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
EOF
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/ishocon /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# MySQL設定
systemctl start mysql || service mysql start
for i in {1..30}; do mysqladmin ping --silent && break || sleep 1; done
mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root';" 2>/dev/null || \
mysql -u root -proot -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root';" || true

# データベース初期化
echo "Initializing database..."
mysql -u root -proot -e "CREATE DATABASE IF NOT EXISTS ishocon1;"
[ -f "$DATA_DIR/init.sql" ] && mysql -u root -proot ishocon1 < "$DATA_DIR/init.sql"
[ -f "$DATA_DIR/ishocon1.dump" ] && mysql -u root -proot ishocon1 < "$DATA_DIR/ishocon1.dump"

# コメント数を修正（オリジナルと同じ）
mysql -u root -proot -e "DELETE FROM ishocon1.comments WHERE id > 200000;"
echo "Comment counts fixed"

# systemdサービス設定
cat > /etc/systemd/system/ishocon-nodejs.service << 'EOF'
[Unit]
Description=ISHOCON1 Node.js
After=network.target mysql.service
[Service]
Type=simple
WorkingDirectory=/home/ishocon/webapp
Environment="ISHOCON1_DB_HOST=localhost"
Environment="ISHOCON1_DB_PORT=3306"
Environment="ISHOCON1_DB_USER=root"
Environment="ISHOCON1_DB_PASSWORD=root"
Environment="ISHOCON1_DB_NAME=ishocon1"
ExecStart=/usr/bin/npm start
Restart=always
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable ishocon-nodejs
systemctl start ishocon-nodejs

# 起動確認
for i in {1..30}; do curl -sf http://127.0.0.1:8080/ && break || sleep 2; done

echo "=== Setup completed at $(date) ==="
