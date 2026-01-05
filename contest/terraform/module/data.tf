data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Get the latest Ubuntu 22.04 LTS AMI (if ami_id is an empty string)
data "aws_ami" "ubuntu" {
  count       = var.ami_id == "" ? 1 : 0
  most_recent = true
  owners      = ["099720109477"] # Amazon Linux 2

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}
