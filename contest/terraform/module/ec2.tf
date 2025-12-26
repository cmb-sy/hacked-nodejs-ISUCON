resource "aws_instance" "main" {
  for_each = { for idx, team in local.team_list : team => team }

  ami           = var.ami_id != "" ? var.ami_id : data.aws_ami.ubuntu[0].id
  instance_type = var.instance_type

  subnet_id                   = module.vpc.public_subnets[0]
  associate_public_ip_address = true

  vpc_security_group_ids = [
    aws_security_group.main.id
  ]

  iam_instance_profile = aws_iam_instance_profile.ec2_webapp.name

  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    team_name      = each.value
    scoreboard_url = aws_apigatewayv2_stage.scoreboard.invoke_url
    s3_bucket      = aws_s3_bucket.webapp_code.bucket
    team_players   = var.teams[each.value]
    admins         = var.admins
  })

  root_block_device {
    volume_size = 8
  }
}



resource "aws_ec2_tag" "instance_name" {
  for_each = aws_instance.main

  resource_id = each.value.id
  key         = "Name"
  value       = "${var.name} - ${each.key}"
}

resource "aws_ec2_tag" "instance_team_name" {
  for_each = aws_instance.main

  resource_id = each.value.id
  key         = "team_name"
  value       = each.key
}

resource "aws_ec2_tag" "instance_players" {
  for_each = aws_instance.main

  resource_id = each.value.id
  key         = "players"
  value       = join(",", var.teams[each.key])
}
