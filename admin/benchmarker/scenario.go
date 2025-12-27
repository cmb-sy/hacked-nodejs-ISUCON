package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

/*
Logs in and frequently accesses the product list page (including image loading).
A user who puts load on the site but doesn't buy any products.
*/
func justLookingScenario(wg *sync.WaitGroup, m *sync.Mutex, finishTime time.Time) bool {
	score := 0
	resp := 200  //200 OK
	var c []*http.Cookie  //HTTP request cookie

	_, email, password := getUserInfo(0)
	resp, c = postLogin(c, email, password)
	score = calcScore(score, resp)

	resp, c = getIndex(c, 0)
	score = calcScore(score, resp)

	for i := 0; i < 50; i++ {
		resp, c = getImage(c, i%5)
		score = calcScore(score, resp)
	}
	if updateScore(score, wg, m, finishTime) {
		return true
	}
	score = 0

	resp, c = getIndex(c, getRand(50, 99))
	score = calcScore(score, resp)

	resp, c = getIndex(c, getRand(100, 149))
	score = calcScore(score, resp)

	for i := 0; i < 50; i++ {
		resp, c = getImage(c, i%5)
		score = calcScore(score, resp)
	}
	if updateScore(score, wg, m, finishTime) {
		return true
	}
	score = 0

	// The reason getProduct(c, 0) is called three times in a row is to simulate real user behavior
	resp, c = getIndex(c, getRand(150, 199))
	score = calcScore(score, resp)

	resp, c = getProduct(c, 0)
	score = calcScore(score, resp)

	resp, c = getProduct(c, 0)
	score = calcScore(score, resp)

	resp, c = getProduct(c, 0)
	score = calcScore(score, resp)

	resp, c = getLogout(c)
	score = calcScore(score, resp)

	return updateScore(score, wg, m, finishTime)
}

/*
Accesses user pages frequently without logging in.
A stalker who enjoys looking at other people's purchase history.
*/
func stalkerScenario(wg *sync.WaitGroup, m *sync.Mutex, finishTime time.Time) bool {
	score := 0
	resp := 200
	var c []*http.Cookie

	resp, c = getIndex(c, 0)
	score = calcScore(score, resp)

	// id:1234 A user who frequently buys products
	resp, c = getUserPage(c, 1234)
	score = calcScore(score, resp)

	resp, c = getUserPage(c, 0)
	score = calcScore(score, resp)

	resp, c = getUserPage(c, 0)
	score = calcScore(score, resp)

	resp, c = getUserPage(c, 0)
	score = calcScore(score, resp)

	return updateScore(score, wg, m, finishTime)
}

/*
Continuously buys products and leaves comments.
A person from a rapidly growing economy who wants to buy high-quality products from developed countries.
*/
func bakugaiScenario(wg *sync.WaitGroup, m *sync.Mutex, finishTime time.Time) bool {
	score := 0
	resp := 200
	var c []*http.Cookie

	// 1/3 chance that user id:1234 goes on a shopping spree
	uID := 0
	if getRand(1, 2) == 1 {
		uID = 1234
	}

	_, email, password := getUserInfo(uID)
	resp, c = postLogin(c, email, password)
	score = calcScore(score, resp)

	resp, c = getIndex(c, getRand(100, 199))
	score = calcScore(score, resp)

	for i := 0; i < 20; i++ {
		resp, c = buyProduct(c, 0)
		score = calcScore(score, resp)
	}
	if updateScore(score, wg, m, finishTime) {
		return true
	}
	score = 0

	for i := 0; i < 5; i++ {
		resp, c = sendComment(c, 0)
		score = calcScore(score, resp)
	}

	resp, c = getLogout(c)
	score = calcScore(score, resp)

	return updateScore(score, wg, m, finishTime)
}

// The following is for score calculation.
// Return value: Whether this goroutine should terminate.
func updateScore(score int, wg *sync.WaitGroup, m *sync.Mutex, finishTime time.Time) bool {
	m.Lock()
	defer m.Unlock()
	totalScore = totalScore + score
	if time.Now().After(finishTime) {
		wg.Done()
		if !finished {
			finished = true
			showScore()
			postScore()
		}
		return true
	}
	return false
}

func calcScore(score int, response int) int {
	if response == 200 {
		return score + 1
	} else if strings.Contains(strconv.Itoa(response), "4") {
		return score - 20
	} else {
		return score - 50
	}
}

func showScore() {
	log.Print("Benchmark Finish!")
	log.Print("Score: " + strconv.Itoa(totalScore))
	log.Print("Waiting for Stopping All Benchmarkers ...")
}

func postScore() {
	apiURL := os.Getenv("BENCH_SCOREBOARD_APIGW_URL")
	teamName := os.Getenv("BENCH_TEAM_NAME")
	
	// If either one is empty, do not send
	if apiURL == "" || teamName == "" {
		return
	}

	apiURL = strings.TrimSuffix(apiURL, "/")

	location, err := time.LoadLocation("Asia/Tokyo")
	if err != nil {
		log.Printf("Failed to load location: %v", err)
		return
	}
	now := time.Now().In(location)
	timestamp := now.Format(time.RFC3339)

	data := map[string]interface{}{
		"team":      teamName,
		"score":     totalScore,
		"timestamp": timestamp,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		log.Printf("Failed to marshal score: %v", err)
		return
	}

	// Build the correct URL
	req, err := http.NewRequest("PUT", apiURL+"/teams", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Failed to create request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")

	// Set a timeout of 10 seconds
	client := &http.Client{
		Timeout: 10 * time.Second,
	}
	
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to send score: %v", err)
		return
	}
	// Preventing Resource Leaks 
	// A resource leak occurs when a program uses resources (such as memory, files, or network connections) and does not release them.
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Printf("Sent score to scoreboard: %d (Team: %s, Score: %d)", resp.StatusCode, teamName, totalScore)
	} else {
		log.Printf("Failed to send score: status code %d", resp.StatusCode)
	}
}
