## Required variables

variable "admins" {
  description = "Admins' GitHub IDs"
  type        = set(string)
}

variable "teams" {
  description = "List of teams and their members' GitHub IDs"
  type        = map(set(string))
  default = {
    "team1" = [
      "user1",
      "user2",
      "user3",
    ],
    "team2" = [
      "user4",
      "user5",
    ],
  }
}
# Example:
# teams = {
#   "team1" = [
#     "user1",
#     "user2",
#     "user3",
#   ],
#   "team2" = [
#     "user4",
#     "user5",
#   ],
# }

## Optional variables

variable "name" {
  description = "Name for the main resources. Useful for creating test resources avoiding name conflicts"
  type        = string
  default     = "ishocon1"
}

variable "ami_id" {
  description = "AMI ID for the ISHOCON EC2 instances. Default is Ubuntu 22.04 LTS in ap-northeast-1. You can override this in main.tf"
  type        = string
  # Ubuntu 22.04 LTS (ap-northeast-1) - 最新のAMI IDを取得するには: aws ec2 describe-images --owners 099720109477 --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' --output text
  default = "" # 空文字列の場合は、data sourceで最新のUbuntu AMIを自動取得
}

variable "instance_type" {
  description = "Instance type for the ISHOCON EC2 instances"
  type        = string
  default     = "c7i.xlarge"

}

variable "vpc_cidr_block" {
  description = "VPC CIDR block for the ISHOCON VPC"
  type        = string
  default     = "172.16.0.0/16"
}


