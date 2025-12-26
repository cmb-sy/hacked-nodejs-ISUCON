#!/bin/bash
set -e

MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root}"
DATA_DIR="/data"
DB_HOST="${DB_HOST:-localhost}"

echo "=== ISHOCON1 Database Initialization ==="

mysql -h "$DB_HOST" -u root -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS ishocon1;" 2>/dev/null || true

if [ -f "$DATA_DIR/init.sql" ]; then
  echo "Importing init.sql..."
  mysql -h "$DB_HOST" -u root -p"$MYSQL_ROOT_PASSWORD" ishocon1 < "$DATA_DIR/init.sql" 2>/dev/null || true
fi

if [ -f "$DATA_DIR/ishocon1.dump" ]; then
  echo "Importing ishocon1.dump..."
  mysql -h "$DB_HOST" -u root -p"$MYSQL_ROOT_PASSWORD" ishocon1 < "$DATA_DIR/ishocon1.dump" 2>/dev/null || true
fi

echo "Cleaning up extra comments (keeping first 200000)..."
mysql -h "$DB_HOST" -u root -p"$MYSQL_ROOT_PASSWORD" -e "DELETE FROM ishocon1.comments WHERE id > 200000;" 2>/dev/null || true

echo "Generating additional data..."
mysql -h "$DB_HOST" -u root -p"$MYSQL_ROOT_PASSWORD" ishocon1 << 'EOSQL'

INSERT INTO stocks (product_id, quantity, operation, created_at)
SELECT id, FLOOR(RAND() * 50) + 10, 'add', DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 30) DAY)
FROM products WHERE id <= 1000;

INSERT INTO stocks (product_id, quantity, operation, created_at)
SELECT id, FLOOR(RAND() * 20) + 5, 'subtract', DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 15) DAY)
FROM products WHERE id <= 500;

INSERT INTO favorites (user_id, product_id, created_at)
SELECT 
  FLOOR(RAND() * 5000) + 1,
  FLOOR(RAND() * 10000) + 1,
  DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 90) DAY)
FROM products WHERE id <= 3000;

INSERT INTO product_views (product_id, user_id, session_id, viewed_at)
SELECT 
  FLOOR(RAND() * 10000) + 1,
  FLOOR(RAND() * 5000) + 1,
  CONCAT('sess_', FLOOR(RAND() * 100000)),
  DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 30) DAY)
FROM products WHERE id <= 5000;

INSERT INTO product_ratings (product_id, user_id, rating, created_at)
SELECT 
  FLOOR(RAND() * 10000) + 1,
  FLOOR(RAND() * 5000) + 1,
  FLOOR(RAND() * 5) + 1,
  DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 180) DAY)
FROM products WHERE id <= 2000;

INSERT INTO product_tags (product_id, tag_id)
SELECT 
  FLOOR(RAND() * 10000) + 1,
  FLOOR(RAND() * 8) + 1
FROM products WHERE id <= 4000;

INSERT INTO user_follows (follower_id, following_id, created_at)
SELECT 
  FLOOR(RAND() * 5000) + 1,
  FLOOR(RAND() * 5000) + 1,
  DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 365) DAY)
FROM products WHERE id <= 1000;

INSERT INTO notifications (user_id, type, message, is_read, related_id, created_at)
SELECT 
  FLOOR(RAND() * 5000) + 1,
  ELT(FLOOR(RAND() * 4) + 1, 'comment', 'favorite', 'follow', 'system'),
  CONCAT('Notification #', id),
  FLOOR(RAND() * 2),
  FLOOR(RAND() * 10000) + 1,
  DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 30) DAY)
FROM products WHERE id <= 2000;

INSERT INTO price_history (product_id, price, changed_at)
SELECT 
  id,
  FLOOR(price * (0.8 + RAND() * 0.4)),
  DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 365) DAY)
FROM products WHERE id <= 3000;

EOSQL

echo "=== Database initialization completed ==="


