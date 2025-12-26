package main

import (
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

func getInitialize() {
	log.Print("Start GET /initialize")
	startTime := time.Now()
	httpRequest("GET", "/initialize", nil, nil)
	elapsed := time.Now().Sub(startTime)
	if elapsed > 10*time.Minute {
		log.Printf("Timeover at GET /initialize (took %v)", elapsed)
		os.Exit(1)
	}
	log.Printf("GET /initialize completed in %v", elapsed)
}

// 基本アクセス
func getIndex(c []*http.Cookie, page int) (int, []*http.Cookie) {
	return httpRequest("GET", "/?page="+strconv.Itoa(page), nil, c)
}

func getImage(c []*http.Cookie, id int) (int, []*http.Cookie) {
	return httpRequest("GET", "/images/image"+strconv.Itoa(id)+".jpg", nil, c)
}

func getProduct(c []*http.Cookie, id int) (int, []*http.Cookie) {
	if id == 0 {
		id = getRand(1, 10000)
	}
	return httpRequest("GET", "/products/"+strconv.Itoa(id), nil, c)
}

func getUserPage(c []*http.Cookie, id int) (int, []*http.Cookie) {
	if id == 0 {
		id = getRand(1, 5000)
	}
	return httpRequest("GET", "/users/"+strconv.Itoa(id), nil, c)
}

func postLogin(c []*http.Cookie, email string, password string) (int, []*http.Cookie) {
	v := url.Values{}
	v.Add("email", email)
	v.Add("password", password)
	return httpRequest("POST", "/login", v, c)
}

func getLogout(c []*http.Cookie) (int, []*http.Cookie) {
	return httpRequest("GET", "/logout", nil, c)
}

func buyProduct(c []*http.Cookie, productID int) (int, []*http.Cookie) {
	if productID == 0 {
		productID = getRand(1, 10000)
	}

	return httpRequest("POST", "/products/buy/"+strconv.Itoa(productID), nil, c)
}

func buyProductForValidation(c []*http.Cookie, userId int, productID int) (int, []*http.Cookie) {
	if productID == 0 {
		productID = getRand(1, 10000)
	}

	// アプリケーションのエンドポイントを通じて購入処理を実行
	return httpRequest("POST", "/products/buy/"+strconv.Itoa(productID), nil, c)
}

func sendComment(c []*http.Cookie, productID int) (int, []*http.Cookie) {
	if productID == 0 {
		productID = getRand(1, 10000)
	}
	v := url.Values{}
	opt := []string{"爆買いしてよかった。", "二度と買わない。", "友達にも勧めます。"}
	v.Add("content", strings.Repeat("この商品は"+choice(opt), 5))
	return httpRequest("POST", "/comments/"+strconv.Itoa(productID), v, c)
}

func httpRequest(method string, path string, params url.Values, cookies []*http.Cookie) (int, []*http.Cookie) {
	req, _ := http.NewRequest(method, host+path, strings.NewReader(params.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	jar, _ := cookiejar.New(nil)
	CookieURL, _ := url.Parse(host + path)
	jar.SetCookies(CookieURL, cookies)
	
	// /initialize用に長めのタイムアウトを設定
	timeout := 30 * time.Second
	if path == "/initialize" {
		timeout = 12 * time.Minute
	}
	client := http.Client{
		Jar:     jar,
		Timeout: timeout,
	}

	resp, err := client.Do(req)
	if err != nil {
		return 500, cookies
	}
	defer resp.Body.Close()

	return resp.StatusCode, jar.Cookies(CookieURL)
}
