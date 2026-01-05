locals {
  admins = [
    "cmb-sy", # GitHub ID of the administrator
  ]

  teams = {
    "team1" = [
      "cmb-sy",
    ],
    "team2" = [
      "cmb-sy",
    ],
    "team3" = [
      "cmb-sy",
    ],
  }
}

module "main" {
  source = "../module"

  admins = local.admins
  teams  = local.teams

  instance_type = "t3.medium"
}
