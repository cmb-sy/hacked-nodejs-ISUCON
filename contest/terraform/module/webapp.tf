# webapp のコードとデータをS3にアップロードしてEC2に配布

# webappコード用のS3バケット
resource "aws_s3_bucket" "webapp_code" {
  bucket_prefix = "${var.name}-webapp-code-"
}

resource "aws_s3_bucket_public_access_block" "webapp_code" {
  bucket = aws_s3_bucket.webapp_code.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# webapp をzip化
data "archive_file" "webapp_nodejs" {
  type        = "zip"
  output_path = "${path.module}/webapp_nodejs.zip"
  source_dir  = "${path.module}/../../../webapp"
  excludes    = ["node_modules", "dist", ".git"]
}

# S3にアップロード
resource "aws_s3_object" "webapp_nodejs" {
  bucket = aws_s3_bucket.webapp_code.id
  key    = "webapp_nodejs.zip"
  source = data.archive_file.webapp_nodejs.output_path

  depends_on = [data.archive_file.webapp_nodejs]
}

# データベースダンプファイルをS3にアップロード
resource "aws_s3_object" "ishocon1_dump" {
  bucket = aws_s3_bucket.webapp_code.id
  key    = "ishocon1.dump.tar.gz"
  source = "${path.module}/../../../admin/ishocon1.dump.tar.gz"
}

# init.sqlをS3にアップロード
resource "aws_s3_object" "init_sql" {
  bucket = aws_s3_bucket.webapp_code.id
  key    = "admin/init.sql"
  source = "${path.module}/../../../admin/init.sql"
}

# setup.shをS3にアップロード
resource "aws_s3_object" "setup_sh" {
  bucket = aws_s3_bucket.webapp_code.id
  key    = "admin/setup.sh"
  source = "${path.module}/../../../admin/setup.sh"
}

# ベンチマーカーをzip化してS3にアップロード
data "archive_file" "benchmarker" {
  type        = "zip"
  output_path = "${path.module}/benchmarker.zip"
  source_dir  = "${path.module}/../../../admin/benchmarker"
  excludes    = [".git"]
}

resource "aws_s3_object" "benchmarker" {
  bucket = aws_s3_bucket.webapp_code.id
  key    = "benchmarker.zip"
  source = data.archive_file.benchmarker.output_path

  depends_on = [data.archive_file.benchmarker]
}

# EC2インスタンスがS3からダウンロードできるようにIAMロールを作成
resource "aws_iam_role" "ec2_webapp" {
  name = "${var.name}-ec2-webapp"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "ec2_webapp_s3" {
  name = "${var.name}-ec2-webapp-s3"
  role = aws_iam_role.ec2_webapp.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject"
      ]
      Resource = "${aws_s3_bucket.webapp_code.arn}/*"
    }]
  })
}

resource "aws_iam_instance_profile" "ec2_webapp" {
  name = "${var.name}-ec2-webapp"
  role = aws_iam_role.ec2_webapp.name
}


