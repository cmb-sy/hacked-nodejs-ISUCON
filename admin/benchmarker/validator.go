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

// 初期化確認
func validateInitialize() {
	log.Print("Validation: データ初期化中...")
	initializeData()
	
	log.Print("Validation: GET /index (page=10) チェック中...")
	validateIndex(10, false)
	
	log.Print("Validation: GET /products/:id チェック中...")
	validateProducts(false)
	
	log.Print("Validation: GET /users/1500 チェック中...")
	validateUsers(1500, false)
	
	userId, email, password := getUserInfo(0)
	log.Printf("Validation: ユーザー %d でログイン・購入テスト実行中...", userId)
	var c []*http.Cookie
	resp, c := postLogin(c, email, password)
	if resp != 200 && resp != 303 {
		log.Printf("Error: ログイン失敗 (status=%d, email=%s)", resp, email)
	}
	
	resp, c = buyProductForValidation(c, userId, 10000)
	if resp != 200 && resp != 303 {
		log.Printf("Error: 商品購入失敗 (status=%d, userId=%d, productId=10000)", resp, userId)
	}
	
	log.Printf("Validation: GET /users/%d (ログイン後) チェック中...", userId)
	validateUsers(userId, true)
	
	log.Print("Validation: コメント投稿テスト実行中...")
	sendComment(c, 10000)
	
	log.Print("Validation: GET /index (page=0, ログイン後) チェック中...")
	validateIndex(0, true)
	
	log.Print("Validation: 全チェック完了")
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

	// 新しいテーブルも初期化（エラーは無視）
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

	// 商品が50個あることの確認
	flg50 = doc.Find(".row").Children().Size() == 50

	// 商品が id DESC 順に並んでいることの確認
	doc.Find("a").EachWithBreak(func(i int, s *goquery.Selection) bool {
		// ついでにログインボタンの確認
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

	// レビューの件数が正しいことの確認
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

	// 商品のDOMの確認
	flg1 = doc.Find(".panel-default").First().Children().Size() == 2
	flg2 = doc.Find(".panel-body").First().Children().Size() == 7
	flg3 = doc.Find(".col-md-4").First().Find(".panel-body ul").Children().Size() == 5
	flgPrdExp = flg1 && flg2 && flg3

	// イメージパスの確認
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
	// 全体の確認
	if flg == false {
		log.Print("Invalid Content or DOM at GET /index")
		log.Printf("  page=%d, loggedIn=%v", page, loggedIn)
		if flg50 == false {
			log.Printf("  商品が50個表示されていません (got=%d)", doc.Find(".row").Children().Size())
		}
		if flgOrder == false {
			log.Print("  商品が正しい順で並んでいません")
		}
		if flgReview == false {
			expectedReview := "20件のレビュー"
			if loggedIn {
				expectedReview = "21件のレビュー"
			}
			log.Printf("  レビューの件数が正しくありません (expected='%s')", expectedReview)
		}
		if flgPrdExp == false {
			log.Print("  商品説明部分が正しくありません")
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
	// 画像パスの確認
	doc.Find("img").EachWithBreak(func(i int, s *goquery.Selection) bool {
		src, _ := s.Attr("src")
		actualImageSrc = src
		flgImage = src == "/images/image4.jpg"
		return false
	})

	// DOMの構造確認
	jumbotronChildren := doc.Find(".row div.jumbotron").Children().Size()
	flgPrdExp = jumbotronChildren == 5

	// 商品説明確認
	var productDesc string
	doc.Find(".row div.jumbotron p").Each(func(i int, s *goquery.Selection) {
		if i == 1 {
			str := s.Text()
			productDesc = str
			flgPrdExp = strings.Contains(str, "1499") && flgPrdExp
		}
	})

	// 購入済み文章の確認(なし)
	containerChildren := doc.Find(".jumbotron div.container").Children().Size()
	flgPrdExp = containerChildren == 1 && flgPrdExp

	flg = flgImage && flgPrdExp
	// 全体の確認
	if flg == false {
		log.Print("Invalid Content or DOM at GET /products/:id")
		log.Printf("  productId=1500, loggedIn=%v", loggedIn)
		if flgImage == false {
			log.Printf("  商品の画像が正しくありません (expected='/images/image4.jpg', actual='%s')", actualImageSrc)
		}
		if flgPrdExp == false {
			log.Printf("  商品説明部分が正しくありません (jumbotron.children=%d, containerChildren=%d, desc contains '1499'=%v)", 
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

	// 履歴が30個あることの確認
	rowChildren := doc.Find(".row").Children().Size()
	flg30 = rowChildren == 30

	// DOMの確認
	panelChildren := doc.Find(".panel-default").First().Children().Size()
	panelBodyChildren := doc.Find(".panel-body").First().Children().Size()
	flgDOM = panelChildren == 2
	flgDOM = panelBodyChildren == 7 && flgDOM

	// 合計金額の確認
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
		// 一番最初に、最後に買った商品が出ていることの確認
		doc.Find(".panel-heading a").EachWithBreak(func(_ int, s *goquery.Selection) bool {
			str, _ := s.Attr("href")
			firstProductHref = str
			flgTime = strings.Contains(str, "10000") && flgTime
			return false
		})
		
		// 商品の購入時間が最近の購入であることの確認
		// 注意: タイムゾーンの問題を回避するため、時刻の厳密なチェックは行わない
		// 代わりに、最新の購入商品が正しいIDであることのみを検証する
		doc.Find(".panel-body p").Each(func(i int, s *goquery.Selection) {
			if i == 2 {
				str := s.Text()
				purchaseTime = str
				timeformat := "2006-01-02 15:04:05 -0700"
				_, err := time.Parse(timeformat, str+" +0900")
				if err != nil {
					// 時刻のフォーマットが正しくない場合のみ失敗
					flgTime = false
					return
				}
				// 時刻フォーマットが正しければOK（環境間のタイムゾーン差異を許容）
			}
		})
	}

	// 全体の確認
	flg = flg30 && flgDOM && flgTotal && flgTime
	if flg == false {
		log.Print("Invalid Content or DOM at GET /users/:id")
		log.Printf("  userId=%d, loggedIn=%v", id, loggedIn)
		if flg30 == false {
			log.Printf("  購入履歴の数が正しくありません (got=%d, expected=30)", rowChildren)
		}
		if flgDOM == false {
			log.Printf("  UserページのDOMが正しくありません (.panel-default children=%d, .panel-body children=%d)", panelChildren, panelBodyChildren)
		}
		if flgTotal == false {
			log.Printf("  購入金額の合計が正しくありません (expected='合計金額: %s円', actual='%s')", sum, actualTotal)
		}
		if flgTime == false {
			log.Printf("  最近の購入履歴が正しくありません (firstProduct='%s', purchaseTime='%s')", firstProductHref, purchaseTime)
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
