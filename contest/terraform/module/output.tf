output "ip_addr" {
  value = {
    for team in local.team_list :
    team => aws_instance.main[team]["public_ip"]
  }
}

output "scoreboard_url" {
  value = "http://${aws_s3_bucket_website_configuration.scoreboard.website_endpoint}"
}

output "apigateway_url" {
  value = aws_apigatewayv2_stage.scoreboard.invoke_url
}
