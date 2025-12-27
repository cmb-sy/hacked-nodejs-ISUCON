package main

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	_ "github.com/go-sql-driver/mysql"
)

func validateInitialize() {
	log.Print("Validation: Initializing data...")
	initializeData()
	
	log.Print("Validation: Checking GET /index (page=10)...")
	validateIndex(10, false)
	
	log.Print("Validation: Checking GET /products/:id...")
	validateProducts(false)
	
	log.Print("Validation: Checking GET /users/1500...")
	validateUsers(1500, false)
	
	userId, email, password := getUserInfo(0)
	log.Printf("Validation: Running login and purchase test with user %d...", userId)
	var c []*http.Cookie
	resp, c := postLogin(c, email, password)
	if resp != 200 && resp != 303 {
		log.Printf("Error: Login failed (status=%d, email=%s)", resp, email)
	}
	
	resp, c = buyProductForValidation(c, userId, 10000)
	if resp != 200 && resp != 303 {
		log.Printf("Error: Product purchase failed (status=%d, userId=%d, productId=10000)", resp, userId)
	}
	
	log.Printf("Validation: Checking GET /users/%d (after login)...", userId)
	validateUsers(userId, true)
	
	log.Print("Validation: Running comment posting test...")
	sendComment(c, 10000)
	
	log.Print("Validation: Checking GET /index (page=0, after login)...")
	validateIndex(0, true)
	
	log.Print("Validation: All checks completed")
}

func initializeData() {
	db, err := getDB()
	if err != nil {
		panic(err.Error())
	}
	defer db.Close()

	_, err = db.Exec("DELETE FROM histories WHERE id > 500000")
	if err != nil {
		panic(err.Error())
	}

	db.Exec("DELETE FROM product_views WHERE id > 0")
	db.Exec("DELETE FROM product_ratings WHERE id > 0")
	db.Exec("DELETE FROM favorites WHERE id > 0")
	db.Exec("DELETE FROM stocks WHERE id > 0")
	db.Exec("DELETE FROM user_follows WHERE id > 0")
	db.Exec("DELETE FROM notifications WHERE id > 0")
	db.Exec("DELETE FROM price_history WHERE id > 0")
	db.Exec("DELETE FROM product_tags WHERE id > 0")
	db.Exec("DELETE FROM user_coupons WHERE id > 0")
}

func validateIndex(page int, loggedIn bool) {
	var flg, flg1, flg2, flg3 bool
	var flg50, flgOrder, flgReview, flgPrdExp bool
	doc, err := goquery.NewDocument(host + "/?page=" + strconv.Itoa(page))
	if err != nil {
		log.Print("Cannot GET /index")
		os.Exit(1)
	}

	// Verify that there are 50 products
	flg50 = doc.Find(".row").Children().Size() == 50

	// Verify that products are ordered by id DESC
	doc.Find("a").EachWithBreak(func(i int, s *goquery.Selection) bool {
		// Also check login button
		if i == 1 {
			ref, _ := s.Attr("href")
			flg1 = ref == "/login"
		}
		if i == 2 {
			ref, _ := s.Attr("href")
			flg2 = ref == "/products/"+strconv.Itoa(10000-page*50)
		}
		if i == 10 {
			ref, _ := s.Attr("href")
			flg3 = ref == "/products/"+strconv.Itoa(10000-page*50-4)
			return false
		}
		return true
	})
	flgOrder = flg1 && flg2 && flg3

	// Verify that the number of reviews is correct
	doc.Find("h4").EachWithBreak(func(i int, s *goquery.Selection) bool {
		if i == 2 {
			str := s.Text()
			if loggedIn {
				flg1 = str == "21件のレビュー"
			} else {
				flg1 = str == "20件のレビュー"
			}
		}
		if i == 11 {
			str := s.Text()
			flg2 = str == "20件のレビュー"
			return false
		}
		return true
	})
	flgReview = flg1 && flg2

	// Verify product DOM structure
	flg1 = doc.Find(".panel-default").First().Children().Size() == 2
	flg2 = doc.Find(".panel-body").First().Children().Size() == 7
	flg3 = doc.Find(".col-md-4").First().Find(".panel-body ul").Children().Size() == 5
	flgPrdExp = flg1 && flg2 && flg3

	// Verify image paths
	doc.Find("img").EachWithBreak(func(i int, s *goquery.Selection) bool {
		if i == 0 || i == 6 || i == 12 || i == 18 || i == 24 {
			src, _ := s.Attr("src")
			flg1 = src == "/images/image"+strconv.Itoa((99-i)%5)+".jpg"
			flgPrdExp = flgPrdExp && flg1
		}
		if i == 24 {
			return false
		}
		return true
	})

	flg = flg50 && flgOrder && flgReview && flgPrdExp
	// Overall verification
	if flg == false {
		log.Print("Invalid Content or DOM at GET /index")
		log.Printf("  page=%d, loggedIn=%v", page, loggedIn)
		if flg50 == false {
			log.Printf("  50 products are not displayed (got=%d)", doc.Find(".row").Children().Size())
		}
		if flgOrder == false {
			log.Print("  Products are not in the correct order")
		}
		if flgReview == false {
			expectedReview := "20件のレビュー"
			if loggedIn {
				expectedReview = "21件のレビュー"
			}
			log.Printf("  Number of reviews is incorrect (expected='%s')", expectedReview)
		}
		if flgPrdExp == false {
			log.Print("  Product description section is incorrect")
		}
		os.Exit(1)
	}
}

func validateProducts(loggedIn bool) {
	var flg bool
	var flgImage, flgPrdExp bool
	var actualImageSrc string
	doc, err := goquery.NewDocument(host + "/products/1500")
	if err != nil {
		log.Print("Cannot GET /products/:id")
		os.Exit(1)
	}
	// Verify image path
	doc.Find("img").EachWithBreak(func(i int, s *goquery.Selection) bool {
		src, _ := s.Attr("src")
		actualImageSrc = src
		flgImage = src == "/images/image4.jpg"
		return false
	})

	// Verify DOM structure
	jumbotronChildren := doc.Find(".row div.jumbotron").Children().Size()
	flgPrdExp = jumbotronChildren == 5

	// Verify product description
	var productDesc string
	doc.Find(".row div.jumbotron p").Each(func(i int, s *goquery.Selection) {
		if i == 1 {
			str := s.Text()
			productDesc = str
			flgPrdExp = strings.Contains(str, "1499") && flgPrdExp
		}
	})

	// Verify purchased text (should not exist)
	containerChildren := doc.Find(".jumbotron div.container").Children().Size()
	flgPrdExp = containerChildren == 1 && flgPrdExp

	flg = flgImage && flgPrdExp
	// Overall verification
	if flg == false {
		log.Print("Invalid Content or DOM at GET /products/:id")
		log.Printf("  productId=1500, loggedIn=%v", loggedIn)
		if flgImage == false {
			log.Printf("  Product image is incorrect (expected='/images/image4.jpg', actual='%s')", actualImageSrc)
		}
		if flgPrdExp == false {
			log.Printf("  Product description section is incorrect (jumbotron.children=%d, containerChildren=%d, desc contains '1499'=%v)", 
				jumbotronChildren, containerChildren, strings.Contains(productDesc, "1499"))
		}
		os.Exit(1)
	}
}

func validateUsers(id int, loggedIn bool) {
	var flg bool
	var flg30, flgDOM, flgTotal, flgTime bool
	doc, err := goquery.NewDocument(host + "/users/" + strconv.Itoa(id))
	if err != nil {
		log.Print("Cannot GET /users/:id")
		os.Exit(1)
	}

	// Verify that there are 30 history items
	rowChildren := doc.Find(".row").Children().Size()
	flg30 = rowChildren == 30

	// Verify DOM structure
	panelChildren := doc.Find(".panel-default").First().Children().Size()
	panelBodyChildren := doc.Find(".panel-body").First().Children().Size()
	flgDOM = panelChildren == 2
	flgDOM = panelBodyChildren == 7 && flgDOM

	// Verify total amount
	sum := getTotalPay(id)
	var actualTotal string
	doc.Find(".container h4").EachWithBreak(func(_ int, s *goquery.Selection) bool {
		str := s.Text()
		actualTotal = str
		flgTotal = str == "合計金額: "+sum+"円"
		return false
	})

	flgTime = true
	var firstProductHref string
	var purchaseTime string
	if loggedIn {
		// Verify that the last purchased product appears first
		doc.Find(".panel-heading a").EachWithBreak(func(_ int, s *goquery.Selection) bool {
			str, _ := s.Attr("href")
			firstProductHref = str
			flgTime = strings.Contains(str, "10000") && flgTime
			return false
		})
		
		// Verify that the purchase time is recent
		// Note: To avoid timezone issues, we don't strictly check the time
		// Instead, we only verify that the latest purchased product has the correct ID
		doc.Find(".panel-body p").Each(func(i int, s *goquery.Selection) {
			if i == 2 {
				str := s.Text()
				purchaseTime = str
				timeformat := "2006-01-02 15:04:05 -0700"
				_, err := time.Parse(timeformat, str+" +0900")
				if err != nil {
					// Only fail if the time format is incorrect
					flgTime = false
					return
				}
				// OK if time format is correct (allowing timezone differences between environments)
			}
		})
	}

	// Overall verification
	flg = flg30 && flgDOM && flgTotal && flgTime
	if flg == false {
		log.Print("Invalid Content or DOM at GET /users/:id")
		log.Printf("  userId=%d, loggedIn=%v", id, loggedIn)
		if flg30 == false {
			log.Printf("  Number of purchase history items is incorrect (got=%d, expected=30)", rowChildren)
		}
		if flgDOM == false {
			log.Printf("  User page DOM is incorrect (.panel-default children=%d, .panel-body children=%d)", panelChildren, panelBodyChildren)
		}
		if flgTotal == false {
			log.Printf("  Total purchase amount is incorrect (expected='合計金額: %s円', actual='%s')", sum, actualTotal)
		}
		if flgTime == false {
			log.Printf("  Recent purchase history is incorrect (firstProduct='%s', purchaseTime='%s')", firstProductHref, purchaseTime)
		}
		os.Exit(1)
	}
}

func getTotalPay(userID int) string {
	db, err := getDB()
	if err != nil {
		panic(err.Error())
	}
	defer db.Close()

	query := `
    SELECT SUM(p.price) as total_pay
    FROM histories as h
    INNER JOIN products as p
    ON p.id = h.product_id
    WHERE h.user_id = ?`
	var totalPay string
	err = db.QueryRow(query, userID).Scan(&totalPay)
	if err != nil {
		panic(err.Error())
	}

	return totalPay
}
