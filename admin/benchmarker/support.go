package main

import (
	"math/rand"

	_ "github.com/go-sql-driver/mysql"
)

func choice(s []string) string {
	i := rand.Intn(len(s))
	return s[i]
}

// Get user information randomly
func getUserInfo(id int) (int, string, string) {
	if id == 0 {
		id = getRand(1, 5000)
	}
	var email, password string
	db, err := getDB()
	if err != nil {
		panic(err.Error())
	}
	defer db.Close()

	err = db.QueryRow("SELECT email, password FROM users WHERE id = ? LIMIT 1", id).Scan(&email, &password)
	if err != nil {
		panic(err.Error())
	}

	return id, email, password
}

// Get a random value from from to to
func getRand(from int, to int) int {
	return rand.Intn(to+1-from) + from
}
