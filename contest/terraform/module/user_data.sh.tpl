#!/bin/bash
exec > >(tee /var/log/user-data.log) 2>&1

# SSH鍵
mkdir -p /home/ishocon/.ssh
%{ for player_in_team in team_players ~}
curl -fs https://github.com/${player_in_team}.keys >> /home/ishocon/.ssh/authorized_keys || true
%{ endfor ~}
%{ for admin in admins ~}
curl -fs https://github.com/${admin}.keys >> /home/ishocon/.ssh/authorized_keys || true
%{ endfor ~}
chmod 700 /home/ishocon/.ssh; chmod 600 /home/ishocon/.ssh/authorized_keys 2>/dev/null || true

# 環境変数
cat >> /etc/environment << 'EOF'
BENCH_TEAM_NAME=${team_name}
BENCH_SCOREBOARD_APIGW_URL=${scoreboard_url}
BENCH_WORKLOAD=5
S3_BUCKET=${s3_bucket}
ISHOCON1_DB_HOST=localhost
ISHOCON1_DB_PORT=3306
ISHOCON1_DB_USER=root
ISHOCON1_DB_PASSWORD=root
ISHOCON1_DB_NAME=ishocon1
EOF

# パッケージ
apt-get update -qq && apt-get install -y -qq awscli unzip nginx mysql-server nodejs npm golang-go >/dev/null 2>&1

# S3からsetup.shをダウンロードして実行
aws s3 cp s3://${s3_bucket}/admin/setup.sh /tmp/setup.sh && chmod +x /tmp/setup.sh && S3_BUCKET=${s3_bucket} /tmp/setup.sh

