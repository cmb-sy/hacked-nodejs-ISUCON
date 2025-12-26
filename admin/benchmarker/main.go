package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"strconv"
	"sync"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

func loopJustLookingScenario(wg *sync.WaitGroup, m *sync.Mutex, finishTime time.Time) {
	for {
		if justLookingScenario(wg, m, finishTime) {
			return
		}
	}
}

func loopStalkerScenario(wg *sync.WaitGroup, m *sync.Mutex, finishTime time.Time) {
	for {
		if stalkerScenario(wg, m, finishTime) {
			return
		}
	}
}

func loopBakugaiScenario(wg *sync.WaitGroup, m *sync.Mutex, finishTime time.Time) {
	for {
		if bakugaiScenario(wg, m, finishTime) {
			return
		}
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// 環境変数を整数として取得するヘルパー関数
func getEnvInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
		log.Printf("Warning: Invalid %s value '%s', using fallback: %d", key, value, fallback)
	}
	return fallback
}

func getDB() (*sql.DB, error) {
	user := getEnv("ISHOCON1_DB_USER", "ishocon")
	pass := getEnv("ISHOCON1_DB_PASSWORD", "ishocon")
	host := getEnv("ISHOCON1_DB_HOST", "localhost")
	port := getEnv("ISHOCON1_DB_PORT", "3306")
	dbname := getEnv("ISHOCON1_DB_NAME", "ishocon1")
	db, err := sql.Open("mysql", user+":"+pass+"@tcp("+host+":"+port+")/"+dbname)
	return db, err
}

func startBenchmark(workload int) {
	getInitialize()
	log.Print("Benchmark Start!  Workload: " + strconv.Itoa(workload))
	finishTime := time.Now().Add(1 * time.Minute)
	validateInitialize()
	wg := new(sync.WaitGroup)
	m := new(sync.Mutex)
	for i := 0; i < workload; i++ {
		wg.Add(1)
		if i%3 == 0 {
			go loopJustLookingScenario(wg, m, finishTime)
		} else if i%3 == 1 {
			go loopStalkerScenario(wg, m, finishTime)
		} else {
			go loopBakugaiScenario(wg, m, finishTime)
		}
	}
	wg.Wait()
}

var host = "http://127.0.0.1"
var totalScore = 0
var finished = false

func main() {
	flag.Usage = func() {
		fmt.Println(`Usage: ./benchmark [option]
Options:
  --ip IP	specify target ip (default: 127.0.0.1:80)
Note: workload is fixed to maximum value (5)`)
	}

	var (
		ip = flag.String("ip", "127.0.0.1", "")
	)
	flag.Parse()
	host = "http://" + *ip

	// workloadは常に最大値を使用
	workload := 5
	log.Printf("Using maximum workload: %d", workload)

	startBenchmark(workload)
}
