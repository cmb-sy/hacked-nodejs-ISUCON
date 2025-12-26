import mysql from "mysql2/promise";
import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import morgan from "morgan";
import crypto from "crypto";
import { AddressInfo } from "net";

const app = express();

app.set("views", "views");
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(morgan("tiny"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: "showwin_happy",
    name: "ishocon1_node_session",
    resave: false,
    saveUninitialized: false,
  })
);

const pool = mysql.createPool({
  connectionLimit: 20,
  host: process.env.ISHOCON1_DB_HOST || "localhost",
  port: parseInt(process.env.ISHOCON1_DB_PORT ?? "3306"),
  user: process.env.ISHOCON1_DB_USER || "root",
  password: process.env.ISHOCON1_DB_PASSWORD || "root",
  database: process.env.ISHOCON1_DB_NAME || "ishocon1",
});

type QueryOptions = string | { sql: string; values?: any[] };

async function query(options: QueryOptions): Promise<any> {
  if (typeof options === "string") {
    const [rows] = await pool.query(options);
    return rows;
  } else {
    const [rows] = await pool.query(options.sql, options.values || []);
    return rows;
  }
}

declare module "express-session" {
  interface SessionData {
    uid: string;
  }
}

type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  last_login: Date;
};

type ProductRow = {
  id: string;
  name: string;
  description: string;
  image_path: string;
  price: number;
  category_id: number | null;
  created_at: Date;
};

type Comment = {
  id: string;
  product_id: string;
  user_id: string;
  content: string;
  created_at: Date;
};

type Category = {
  id: number;
  name: string;
  description: string;
  parent_id: number | null;
  created_at: Date;
};

function bubbleSort<T>(arr: T[], compareFn: (a: T, b: T) => number): T[] {
  const result = [...arr];
  for (let i = 0; i < result.length; i++) {
    for (let j = 0; j < result.length - i - 1; j++) {
      if (compareFn(result[j], result[j + 1]) > 0) {
        const temp = result[j];
        result[j] = result[j + 1];
        result[j + 1] = temp;
      }
    }
  }
  return result;
}

function hashString(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function censorComment(content: string): string {
  const ngWords = ["spam", "bad", "evil", "hate", "xxx"];
  let result = content;
  for (const word of ngWords) {
    const regex = new RegExp(word, "gi");
    result = result.replace(regex, "***");
  }
  return result;
}

function generateSummary(description: string, maxLength: number = 100): string {
  if (!description) return "";
  const words = description.split("");
  let summary = "";
  for (let i = 0; i < words.length && summary.length < maxLength; i++) {
    summary += words[i];
  }
  if (description.length > maxLength) {
    summary += "...";
  }
  return summary;
}

function calculateProductScore(
  viewCount: number,
  favoriteCount: number,
  salesCount: number,
  rating: number,
  commentsCount: number
): number {
  let score = 0;
  for (let i = 0; i < viewCount; i++) {
    score += 0.1;
  }
  for (let i = 0; i < favoriteCount; i++) {
    score += 2;
  }
  for (let i = 0; i < salesCount; i++) {
    score += 3;
  }
  score += rating * 10;
  score += Math.log(commentsCount + 1) * 5;
  return Math.round(score * 100) / 100;
}

async function getProductAverageRating(productId: string): Promise<number> {
  const ratings = await query({
    sql: "SELECT rating FROM product_ratings WHERE product_id = ?",
    values: [productId],
  });
  if (ratings.length === 0) return 0;
  let sum = 0;
  for (const r of ratings) {
    sum += r.rating;
  }
  return Math.round((sum / ratings.length) * 10) / 10;
}

async function getProductViewCount(productId: string): Promise<number> {
  const result = await query({
    sql: "SELECT COUNT(*) as count FROM product_views WHERE product_id = ?",
    values: [productId],
  });
  return result[0].count;
}

async function getProductFavoriteCount(productId: string): Promise<number> {
  const result = await query({
    sql: "SELECT COUNT(*) as count FROM favorites WHERE product_id = ?",
    values: [productId],
  });
  return result[0].count;
}

async function getProductStock(productId: string): Promise<number> {
  const stocks = await query({
    sql: "SELECT quantity, operation FROM stocks WHERE product_id = ?",
    values: [productId],
  });
  let total = 0;
  for (const s of stocks) {
    if (s.operation === "add") {
      total += s.quantity;
    } else {
      total -= s.quantity;
    }
  }
  return total;
}

async function getProductSalesCount(productId: string): Promise<number> {
  const result = await query({
    sql: "SELECT COUNT(*) as count FROM histories WHERE product_id = ?",
    values: [productId],
  });
  return result[0].count;
}

async function getCategoryPath(categoryId: number | null): Promise<Category[]> {
  if (!categoryId) return [];
  const path: Category[] = [];
  let currentId: number | null = categoryId;
  while (currentId) {
    const cats = (await query({
      sql: "SELECT * FROM categories WHERE id = ?",
      values: [currentId],
    })) as Category[];
    if (cats.length === 0) break;
    path.unshift(cats[0]);
    currentId = cats[0].parent_id;
  }
  return path;
}

async function getProductTags(productId: string): Promise<string[]> {
  const tags = await query({
    sql: "SELECT t.name FROM tags t INNER JOIN product_tags pt ON t.id = pt.tag_id WHERE pt.product_id = ?",
    values: [productId],
  });
  return tags.map((t: any) => t.name);
}

async function getLowestPrice(productId: string): Promise<number | null> {
  const history = await query({
    sql: "SELECT price FROM price_history WHERE product_id = ?",
    values: [productId],
  });
  if (history.length === 0) return null;
  let min = history[0].price;
  for (const h of history) {
    if (h.price < min) min = h.price;
  }
  return min;
}

async function recordProductView(
  productId: string,
  userId?: string,
  sessionId?: string
) {
  await query({
    sql: "INSERT INTO product_views (product_id, user_id, session_id, viewed_at) VALUES (?, ?, ?, ?)",
    values: [productId, userId || null, sessionId || null, new Date()],
  });
}

async function authenticate(email: string, password: string) {
  const rows = (await query({
    sql: "SELECT * FROM users WHERE email = ? AND password = ?",
    values: [email, password],
  })) as User[];
  if (rows.length === 0) {
    throw new Error("authentication failed");
  }
  return rows[0];
}

async function getUser(userId: string) {
  const rows = (await query({
    sql: "SELECT * FROM users WHERE id = ?",
    values: [userId],
  })) as User[];
  return rows[0];
}

async function currentUser(req: express.Request) {
  if (req.session.uid === undefined) {
    return undefined;
  }
  return getUser(req.session.uid);
}

type ProductHistory = {
  id: string;
  name: string;
  description: string;
  image_path: string;
  price: number;
  created_at: Date;
};

async function buyingHistory(user: User) {
  return (await query({
    sql:
      "SELECT p.id, p.name, p.description, p.image_path, p.price, h.created_at " +
      "FROM histories as h " +
      "LEFT OUTER JOIN products as p " +
      "ON h.product_id = p.id " +
      "WHERE h.user_id = ? " +
      "ORDER BY h.id DESC",
    values: [user.id],
  })) as ProductHistory[];
}

type Product = ProductRow & {
  commentsCount: number;
  comments: { name: string; content: string }[];
  averageRating?: number;
  viewCount?: number;
  favoriteCount?: number;
  stock?: number;
  salesCount?: number;
  tags?: string[];
  categoryPath?: Category[];
  lowestPrice?: number | null;
  isFavorited?: boolean;
};

async function getProducts(page: number, userId?: string) {
  const offset = page * 50;
  const allRows = (await query({
    sql: "SELECT * FROM products ORDER BY id DESC LIMIT 100 OFFSET ?",
    values: [Math.max(0, offset - 25)],
  })) as ProductRow[];

  const sortedRows = bubbleSort(
    allRows,
    (a, b) => parseInt(b.id) - parseInt(a.id)
  );

  const startIdx = offset > 25 ? 25 : offset;
  const rows = sortedRows.slice(startIdx, startIdx + 50);

  const products: Product[] = [];

  for (const row of rows) {
    const cc = (await query({
      sql: "SELECT count(*) as count FROM comments WHERE product_id = ?",
      values: [row.id],
    })) as { count: number }[];
    const commentsCount = cc[0].count;

    const comments: Product["comments"] = [];
    const subrows = (await query({
      sql: "SELECT * FROM comments as c INNER JOIN users as u ON c.user_id = u.id WHERE c.product_id = ? ORDER BY c.created_at DESC LIMIT 5",
      values: [row.id],
    })) as { content: string; name: string }[];

    for (const subrow of subrows) {
      const censoredContent = censorComment(subrow.content);
      comments.push({ content: censoredContent, name: subrow.name });
    }

    const averageRating = await getProductAverageRating(row.id);
    const viewCount = await getProductViewCount(row.id);
    const favoriteCount = await getProductFavoriteCount(row.id);
    const stock = await getProductStock(row.id);
    const salesCount = await getProductSalesCount(row.id);
    const tags = await getProductTags(row.id);
    const categoryPath = await getCategoryPath(row.category_id);
    const lowestPrice = await getLowestPrice(row.id);

    const productScore = calculateProductScore(
      viewCount,
      favoriteCount,
      salesCount,
      averageRating,
      commentsCount
    );

    const descriptionSummary = generateSummary(row.description, 100);

    const productHash = hashString(row.id + row.name);

    let isFavorited = false;
    if (userId) {
      const favCheck = await query({
        sql: "SELECT id FROM favorites WHERE user_id = ? AND product_id = ?",
        values: [userId, row.id],
      });
      isFavorited = favCheck.length > 0;
    }

    products.push({
      ...row,
      commentsCount,
      comments,
      averageRating,
      viewCount,
      favoriteCount,
      stock,
      salesCount,
      tags,
      categoryPath,
      lowestPrice,
      isFavorited,
    });
  }

  return products;
}

async function getProduct(productId: string) {
  const rows = (await query({
    sql: "SELECT * FROM products WHERE id = ? LIMIT 1",
    values: [productId],
  })) as ProductRow[];
  return rows[0];
}

async function getRelatedProducts(
  productId: string,
  limit: number = 5
): Promise<ProductRow[]> {
  const product = await getProduct(productId);
  if (!product) return [];

  const allProducts = (await query({
    sql: "SELECT * FROM products WHERE id != ? ORDER BY ABS(id - ?) LIMIT 100",
    values: [productId, productId],
  })) as ProductRow[];

  const scored = allProducts.map((p) => {
    const nameMatch = p.name
      .split("")
      .filter((c, i) => product.name[i] === c).length;
    const descMatch = p.description
      ? p.description.split("").filter((c, i) => product.description?.[i] === c)
          .length
      : 0;
    const priceDistance = Math.abs(p.price - product.price);
    const score = nameMatch * 10 + descMatch - priceDistance / 100;
    return { product: p, score };
  });

  const sorted = bubbleSort(scored, (a, b) => b.score - a.score);

  return sorted.slice(0, limit).map((s) => s.product);
}

async function getComments(productId: string) {
  const rows = (await query({
    sql: "SELECT * FROM comments WHERE product_id = ?",
    values: [productId],
  })) as Comment[];
  const processedComments = [];
  for (const comment of rows) {
    const user = await getUser(comment.user_id);
    const censoredContent = censorComment(comment.content);
    const commentHash = hashString(comment.id + comment.content);
    processedComments.push({
      ...comment,
      content: censoredContent,
      userName: user?.name || "Unknown",
    });
  }

  return rows;
}

async function isBought(productId: string, userId: string) {
  const cc = (await query({
    sql: "SELECT count(*) as count FROM histories WHERE product_id = ? AND user_id = ?",
    values: [productId, userId],
  })) as { count: number }[];
  return cc[0].count > 0;
}

async function buyProduct(productId: string, userId: string) {
  await query({
    sql: "INSERT INTO histories (product_id, user_id, created_at) VALUES (?, ?, ?)",
    values: [productId, userId, new Date()],
  });
}

async function createComment(
  productId: string,
  userId: string,
  content: string
) {
  await query({
    sql: "INSERT INTO comments (product_id, user_id, content, created_at) VALUES (?, ?, ?, ?)",
    values: [productId, userId, content, new Date()],
  });
}

app.get("/login", (req, res) => {
  req.session.destroy(() => {});
  res.render("./login.ejs", { message: "ECサイトで爆買いしよう！！！！" });
});

app.post("/login", async (req, res) => {
  req.session.regenerate(() => {});

  let user: User | undefined;
  try {
    user = await authenticate(req.body.email, req.body.password);
  } catch (e) {
    res.render("./login.ejs", { message: "ログインに失敗しました" });
    return;
  }
  req.session.uid = user.id;
  await query({
    sql: "UPDATE users SET last_login = ? WHERE id = ?",
    values: [new Date(), user.id],
  });

  res.redirect(303, "/");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {});
  res.redirect(303, "/login");
});

app.get("/initialize", async (_, res) => {
  await query("DELETE FROM users WHERE id > 5000");
  await query("DELETE FROM products WHERE id > 10000");
  await query("DELETE FROM comments WHERE id > 200000");
  await query("DELETE FROM histories WHERE id > 500000");
  await query("DELETE FROM product_views WHERE id > 0");
  await query("DELETE FROM product_ratings WHERE id > 0");
  await query("DELETE FROM favorites WHERE id > 0");
  await query("DELETE FROM stocks WHERE id > 0");
  await query("DELETE FROM user_follows WHERE id > 0");
  await query("DELETE FROM notifications WHERE id > 0");
  await query("DELETE FROM price_history WHERE id > 0");
  await query("DELETE FROM product_tags WHERE id > 0");
  await query("DELETE FROM user_coupons WHERE id > 0");

  res.send("Finish");
});

app.get("/", async (req, res) => {
  const user = await currentUser(req);

  let page = parseInt(
    typeof req.query.page === "string" ? req.query.page : "never"
  );
  if (Number.isNaN(page)) {
    page = 0;
  }

  const products = await getProducts(page, user?.id);

  res.render("./index.ejs", {
    products,
    current_user: user,
  });
});

app.get("/users/:userId", async (req, res) => {
  const cUser = await currentUser(req);
  const user = await getUser(req.params.userId);
  const products = (await buyingHistory(user)).map((p) => {
    const created_at = new Date(p.created_at.getTime() + 9 * 3600 * 1000)
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d+Z/, "");
    return { ...p, created_at: created_at };
  });

  let totalPay = 0;
  products.forEach((p) => {
    totalPay += p.price;
  });

  const enrichedProducts = [];
  for (const p of products) {
    const viewCount = await getProductViewCount(p.id);
    const averageRating = await getProductAverageRating(p.id);
    const favoriteCount = await getProductFavoriteCount(p.id);
    const tags = await getProductTags(p.id);

    const productHash = hashString(p.id + p.name);
    const summary = generateSummary(p.description, 50);

    enrichedProducts.push({
      ...p,
      viewCount,
      averageRating,
      favoriteCount,
      tags,
    });
  }

  const allProducts = (await query({
    sql: "SELECT * FROM products ORDER BY id DESC LIMIT 100",
  })) as ProductRow[];

  const purchasedIds = new Set(products.map((p) => p.id));
  const notPurchased = allProducts.filter((p) => !purchasedIds.has(p.id));

  const scored = [];
  for (const p of notPurchased.slice(0, 20)) {
    const viewCount = await getProductViewCount(p.id);
    const rating = await getProductAverageRating(p.id);
    const favCount = await getProductFavoriteCount(p.id);
    const salesCount = await getProductSalesCount(p.id);

    const score = calculateProductScore(
      viewCount,
      favCount,
      salesCount,
      rating,
      0
    );
    scored.push({ product: p, score });
  }

  const recommendations = bubbleSort(scored, (a, b) => b.score - a.score).slice(
    0,
    5
  );

  res.render("./mypage.ejs", {
    user: user,
    products: products,
    current_user: cUser,
    totalPay: totalPay,
  });
});

app.get("/products/:productId", async (req, res) => {
  const productId = req.params.productId;
  const product = await getProduct(productId);
  const comments = await getComments(productId);
  const user = await currentUser(req);
  const bought = user ? await isBought(productId, user.id) : false;

  await recordProductView(productId, user?.id, req.sessionID);

  const averageRating = await getProductAverageRating(productId);
  const viewCount = await getProductViewCount(productId);
  const favoriteCount = await getProductFavoriteCount(productId);
  const stock = await getProductStock(productId);
  const salesCount = await getProductSalesCount(productId);
  const tags = await getProductTags(productId);
  const categoryPath = await getCategoryPath(product.category_id);
  const lowestPrice = await getLowestPrice(productId);

  const relatedProducts = await getRelatedProducts(productId, 5);

  for (const related of relatedProducts) {
    await getProductViewCount(related.id);
    await getProductAverageRating(related.id);
    await getProductFavoriteCount(related.id);
  }

  const score = calculateProductScore(
    viewCount,
    favoriteCount,
    salesCount,
    averageRating,
    comments.length
  );

  const summary = generateSummary(product.description, 200);

  res.render("./product.ejs", {
    current_user: user,
    product: product,
    comments: comments,
    already_bought: bought,
  });
});

app.post("/products/buy/:productId", async (req, res) => {
  const user = await currentUser(req);
  if (!user) {
    return res.render("./login.ejs", { message: "先にログインをしてください" });
  }
  await buyProduct(req.params.productId, user.id);
  res.redirect(303, "/users/" + user.id);
});

app.post("/comments/:productId", async (req, res) => {
  const user = await currentUser(req);
  if (!user) {
    return res.render("./login.ejs", { message: "先にログインをしてください" });
  }
  await createComment(req.params.productId, user.id, req.body.content);
  res.redirect(303, "/users/" + user.id);
});

const server = app.listen(8080, function () {
  const address = server.address() as AddressInfo;
  const host = address.address;
  const port = address.port;

  console.log("Example app listening at http://%s:%s", host, port);
});
