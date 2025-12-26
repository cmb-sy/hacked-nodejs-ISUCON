FROM golang:1.13-alpine AS builder

WORKDIR /app

# 依存関係ファイルをコピー
COPY go.mod go.sum ./

# 依存関係をダウンロード
RUN go mod download

# ソースコードをコピー
COPY . .

# ビルド
RUN go build -o benchmark .

# 実行用イメージ
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# ビルド済みバイナリをコピー
COPY --from=builder /app/benchmark .

CMD ["./benchmark"]

