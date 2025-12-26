interface TeamScore {
  team: string;
  score: number;
  timestamp: string;
}

const apiUrl = "<<API_GATEWAY_DOMAIN_URL>>teams";

// ダミーデータ生成関数
function generateDummyData(): TeamScore[] {
  const teams = ["team1", "team2", "team3", "team4", "team5"];
  const data: TeamScore[] = [];
  const now = new Date();

  const initialScores: { [key: string]: number } = {
    team1: 0,
    team2: 0,
    team3: 0,
    team4: 0,
    team5: 0,
  };

  teams.forEach((team) => {
    let currentScore = initialScores[team] || 0;

    for (let i = 0; i < 10; i++) {
      const timestamp = new Date(now.getTime() - (10 - i) * 6 * 60 * 1000);
      const change = Math.floor(Math.random() * 200) - 100; // -100〜+100の変動
      currentScore = currentScore + change;

      data.push({
        team: team,
        score: currentScore,
        timestamp: timestamp.toISOString(),
      });
    }
  });

  return data;
}

// URLパラメータでダミーデータモードを切り替え
const urlParams = new URLSearchParams(window.location.search);
const useDummyData =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// Function to fetch the latest data
async function fetchData() {
  if (useDummyData) {
    console.log("Using dummy data for development");
    return generateDummyData();
  }

  // 本番モード（APIから取得）
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
    // エラー時はダミーデータを返す（開発用）
    return generateDummyData();
  }
}

// Define color scale globally to use across both graphs
const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

// Store previous scores to calculate changes
let previousScores: Map<string, number> = new Map();

// Common chart configuration - グラフ共通設定
const CHART_CONFIG = {
  margin: { top: 40, right: 30, bottom: 50, left: 80 },
  widthRatio: 0.95, // 画面幅に対するグラフの幅の比率（大きくする）
  baseHeight: 500, // Timelineグラフの基本高さ（大きくする）
};

// レスポンシブ設定を取得する関数
function getResponsiveConfig() {
  const width = window.innerWidth;
  const isMobile = width < 480;
  const isSmallTablet = width >= 480 && width < 768;
  const isTablet = width >= 768 && width < 1024;

  if (isMobile) {
    return {
      margin: { top: 25, right: 15, bottom: 35, left: 40 },
      widthRatio: 0.99,
      baseHeight: 300,
      padding: 8,
    };
  } else if (isSmallTablet) {
    return {
      margin: { top: 30, right: 20, bottom: 40, left: 50 },
      widthRatio: 0.98,
      baseHeight: 350,
      padding: 10,
    };
  } else if (isTablet) {
    return {
      margin: { top: 35, right: 25, bottom: 45, left: 65 },
      widthRatio: 0.96,
      baseHeight: 425,
      padding: 15,
    };
  } else {
    return {
      margin: CHART_CONFIG.margin,
      widthRatio: CHART_CONFIG.widthRatio,
      baseHeight: CHART_CONFIG.baseHeight,
      padding: 20,
    };
  }
}

// Common function to calculate chart width - グラフ幅計算の共通関数（レスポンシブ対応）
function calculateChartWidth(containerId?: string): number {
  const responsiveConfig = getResponsiveConfig();
  let containerWidth: number;
  if (containerId) {
    const container = d3.select(containerId).node() as HTMLElement;
    if (container) {
      containerWidth = container.clientWidth - responsiveConfig.padding * 2;
    } else {
      containerWidth =
        document.body.clientWidth * responsiveConfig.widthRatio -
        responsiveConfig.padding * 2;
    }
  } else {
    containerWidth =
      document.body.clientWidth * responsiveConfig.widthRatio -
      responsiveConfig.padding * 2;
  }

  return (
    containerWidth -
    responsiveConfig.margin.left -
    responsiveConfig.margin.right
  );
}

interface TeamRanking {
  rank: number;
  team: string;
  score: number;
  change: number | null;
  changePercent: number | null;
}

function renderTimeline(data: TeamScore[]) {
  const responsiveConfig = getResponsiveConfig();
  const margin = responsiveConfig.margin;

  // Create a title for the graph first
  d3.select("#timeline-chart")
    .append("h2")
    .style("text-align", "center")
    .style("font-size", window.innerWidth < 768 ? "18px" : "24px")
    .text("Timeline");

  // Calculate width after container is created
  const width = calculateChartWidth("#timeline-chart");
  const height = responsiveConfig.baseHeight - margin.top - margin.bottom;
  const svgWidth = width + margin.left + margin.right;
  const svgHeight = height + margin.top + margin.bottom;

  const svg = d3
    .select("#timeline-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "auto")
    .style("max-width", `${svgWidth}px`)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // ISO形式のタイムスタンプを直接Dateオブジェクトに変換
  data = data.filter((d) => {
    const date = new Date(d.timestamp);
    return !isNaN(d.score) && !isNaN(date.getTime());
  });

  // 各チームの最高スコア更新ポイントのみを抽出
  const teams = d3.group(data, (d) => d.team);
  const bestScoreUpdates: TeamScore[] = [];

  teams.forEach((teamData, teamName) => {
    // 時系列でソート
    const sortedData = Array.from(teamData).sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let currentBestScore = -Infinity;

    // 最高スコアを更新したポイントのみを抽出
    sortedData.forEach((point) => {
      if (point.score > currentBestScore) {
        currentBestScore = point.score;
        bestScoreUpdates.push(point);
      }
    });
  });

  // 全チームの最高スコア更新を時系列でソート
  bestScoreUpdates.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const dates = bestScoreUpdates.map((d) => new Date(d.timestamp));

  const x = d3
    .scaleTime()
    .domain([d3.min(dates)!, d3.max(dates) || new Date()])
    .range([0, width]);

  // Calculate min and max values including negative scores (using all data for consistent scale)
  const minYValue = d3.min(data, (d) => d.score) || 0;
  const maxYValue = d3.max(data, (d) => d.score) || 0;
  const yPadding = Math.max(Math.abs(minYValue), Math.abs(maxYValue)) * 0.1;
  const y = d3
    .scaleLinear()
    .domain([minYValue - yPadding, maxYValue + yPadding]) // Include negative values with padding
    .range([height, 0]);

  // X-axis with date and time format (1 day = 2 ticks)
  const minDate = d3.min(dates)!;
  const maxDate = d3.max(dates) || new Date();
  const timeRange = maxDate.getTime() - minDate.getTime();
  const days = timeRange / (1000 * 60 * 60 * 24); // Number of days in range

  // Calculate tick interval: approximately 2 ticks per day (12 hours)
  let tickCount: number;
  if (days <= 1) {
    tickCount = 2; // 2 ticks for 1 day or less
  } else {
    tickCount = Math.ceil(days * 2); // 2 ticks per day
  }

  const timeFormat = d3.timeFormat("%m/%d %H:%M"); // "12/24 14:30"
  const isMobile = window.innerWidth < 768;
  const tickFontSize = isMobile ? "10px" : "12px";

  const xAxis = d3
    .axisBottom(x)
    .tickSize(-height)
    .tickPadding(isMobile ? 5 : 10)
    .tickFormat((d) => timeFormat(d as Date))
    .ticks(tickCount);

  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis)
    .selectAll("text")
    .style("display", "none")
    .style("font-size", tickFontSize);

  // Y-axis with full numbers (no abbreviation)
  const yAxis = svg.append("g").call(
    d3
      .axisLeft(y)
      .tickSize(-width)
      .tickPadding(isMobile ? 5 : 10)
  );

  yAxis.selectAll("text").style("font-size", tickFontSize);

  // Lighter grid lines (excluding y=0)
  svg
    .selectAll(".tick line")
    .attr("stroke", "#ddd")
    .attr("stroke-opacity", 0.3)
    .each(function (d) {
      const tickValue = d as number;
      if (tickValue === 0) {
        d3.select(this).style("display", "none"); // 0の位置の線を非表示
      }
    });

  // Line path for each team (using only best score updates)
  const line = d3
    .line<TeamScore>()
    .x((d) => x(new Date(d.timestamp)))
    .y((d) => y(d.score))
    .curve(d3.curveLinear);

  // Group best score updates by team
  const teamsBestScores = d3.group(bestScoreUpdates, (d) => d.team);

  teamsBestScores.forEach((teamData, teamName) => {
    // Draw the line for each team
    svg
      .append("path")
      .datum(teamData)
      .attr("fill", "none")
      .attr("stroke", colorScale(teamName)!)
      .attr("stroke-width", 2)
      .attr("d", line);

    // Find the last data point for the team
    const lastDataPoint = teamData.reduce((latest, current) =>
      new Date(current.timestamp) > new Date(latest.timestamp)
        ? current
        : latest
    );

    // Draw a horizontal line extending from the last data point to the right edge of the graph
    svg
      .append("line")
      .attr("x1", x(new Date(lastDataPoint.timestamp))) // Start at the last data point
      .attr("x2", width) // Extend to the right edge of the graph
      .attr("y1", y(lastDataPoint.score)) // Y position based on the last score
      .attr("y2", y(lastDataPoint.score)) // Keep Y constant to form a horizontal line
      .attr("stroke", colorScale(teamName)!) // Use the team's color for the line
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.3) // Lighter line using reduced opacity
      .attr("stroke-dasharray", "4,4"); // Dashed line for differentiation
  });

  // Tooltip container
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip-modern")
    .style("display", "none");

  // Circles at data points and mouseover event for tooltip (showing date and time)
  const timeTooltipFormat = d3.timeFormat("%Y-%m-%d %H:%M:%S"); // "2025-12-24 14:30:00"

  // Circles at best score update points only
  svg
    .selectAll("dot")
    .data(bestScoreUpdates)
    .enter()
    .append("circle")
    .attr("cx", (d) => x(new Date(d.timestamp)))
    .attr("cy", (d) => y(d.score))
    .attr("r", 5)
    .attr("fill", (d) => colorScale(d.team)!)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .on("mouseover", function (event, d) {
      tooltip
        .style("display", "block")
        .html(
          `Team: ${
            d.team
          }<br>Best Score: ${d.score.toLocaleString()}<br>Updated: ${timeTooltipFormat(
            new Date(d.timestamp)
          )}`
        )
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 20 + "px");
    })
    .on("mouseout", function () {
      tooltip.style("display", "none");
    });
}

function renderBarChart(data: TeamScore[]) {
  // Sort by timestamp first, then filter out old scores, keeping only the latest for each team
  const latestScores = Array.from(d3.group(data, (d) => d.team).values()).map(
    (teamScores) => {
      return teamScores.reduce((latest, current) => {
        return new Date(current.timestamp) > new Date(latest.timestamp)
          ? current
          : latest;
      });
    }
  );

  // Sort the latest scores by score in descending order
  latestScores.sort((a, b) => b.score - a.score);

  // Get responsive configuration - レスポンシブ設定を取得
  const responsiveConfig = getResponsiveConfig();
  const isMobile = window.innerWidth < 768;
  const margin = responsiveConfig.margin;

  // Dynamic height calculation based on number of teams
  const minBarHeight = isMobile ? 25 : 30; // Minimum height per bar
  const maxBarHeight = isMobile ? 40 : 50; // Maximum height per bar
  const baseHeight = responsiveConfig.baseHeight; // Use responsive base height - レスポンシブ基本高さを使用
  const teamCount = latestScores.length;

  // Calculate optimal bar height (between min and max)
  const barHeight = Math.max(
    minBarHeight,
    Math.min(maxBarHeight, Math.floor(baseHeight / teamCount))
  );

  // Calculate total height needed
  const calculatedHeight = Math.max(baseHeight, teamCount * barHeight + 100); // +100 for margins/padding
  const maxHeight = Math.min(window.innerHeight * 0.7, calculatedHeight); // Max 70% of viewport height

  // Create a title for the graph with team count first
  d3.select("#bar-chart")
    .append("h2")
    .style("text-align", "center")
    .style("font-size", isMobile ? "18px" : "24px")
    .html(
      `Latest Score <span style="font-size: 0.7em; color: #666; font-weight: normal;">(${teamCount} teams)</span>`
    );

  // Calculate width after container is created
  const width = calculateChartWidth("#bar-chart");
  const height = maxHeight - margin.top - margin.bottom;
  const svgWidth = width + margin.left + margin.right;
  const svgHeight = height + margin.top + margin.bottom;

  // Use common SVG width calculation with viewBox for responsiveness
  const svg = d3
    .select("#bar-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "auto")
    .style("max-width", `${svgWidth}px`)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // actualWidth is same as width for consistency - 一貫性のためactualWidthはwidthと同じ
  const actualWidth = width;

  const y = d3
    .scaleBand()
    .domain(latestScores.map((d) => d.team))
    .range([0, height])
    .padding(teamCount > 20 ? 0.05 : 0.1); // Less padding when many teams

  // Calculate min and max values including negative scores
  const minXValue = -500;
  const maxXValue = 5000;

  const x = d3
    .scaleLinear()
    .domain([minXValue, maxXValue])
    .range([0, actualWidth]);

  // Calculate zero position for reference line
  const zeroX = x(0);

  // X-axis with responsive font size
  const xAxisFontSize = isMobile ? "9px" : teamCount > 20 ? "10px" : "12px";
  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3
        .axisBottom(x)
        .tickSize(-height)
        .tickPadding(isMobile ? 5 : 10)
    )
    .selectAll("text")
    .style("font-size", xAxisFontSize);

  // Y-axis with adjusted font size for many teams
  const yAxisFontSize = isMobile ? "9px" : teamCount > 20 ? "10px" : "12px";
  const yAxis = svg.append("g").call(
    d3
      .axisLeft(y)
      .tickSize(-actualWidth)
      .tickPadding(isMobile ? 5 : 10)
  );

  // Truncate long team names on Y-axis
  yAxis
    .selectAll("text")
    .style("font-size", yAxisFontSize)
    .text(function (d) {
      const teamName = d as string;
      const maxLength = teamCount > 20 ? 15 : 20;
      return teamName.length > maxLength
        ? teamName.substring(0, maxLength) + "..."
        : teamName;
    })
    .append("title")
    .text((d) => d as string);

  svg
    .selectAll(".tick line")
    .attr("stroke", "#ddd")
    .attr("stroke-opacity", teamCount > 20 ? 0.2 : 0.3); // Lighter grid for many teams

  // Add zero reference line
  if (minXValue < 0 && maxXValue > 0) {
    svg
      .append("line")
      .attr("x1", zeroX)
      .attr("x2", zeroX)
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#666")
      .attr("stroke-width", teamCount > 20 ? 1.5 : 2)
      .attr("stroke-dasharray", "3,3");
  }

  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip-modern")
    .style("display", "none");

  svg
    .selectAll(".bar")
    .data(latestScores)
    .enter()
    .append("rect")
    .attr("x", (d) => (d.score >= 0 ? zeroX : x(d.score))) // Start from zero for positive, from score for negative
    .attr("y", (d) => y(d.team)!)
    .attr("width", (d) => Math.abs(x(d.score) - zeroX)) // Width is distance from zero
    .attr("height", Math.max(2, y.bandwidth())) // Minimum height of 2px
    .attr("fill", (d) => colorScale(d.team)!)
    .attr("opacity", teamCount > 20 ? 0.85 : 0.8) // Slightly more opaque for many teams
    .on("mouseover", function (event, d) {
      tooltip
        .style("display", "block")
        .html(`Team: ${d.team}<br>Score: ${d.score.toLocaleString()}`)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 20 + "px");
    })
    .on("mouseout", function () {
      tooltip.style("display", "none");
    });

  // Add score labels on bars (only if bar is wide enough)
  const labelFontSize = isMobile ? "9px" : teamCount > 20 ? "10px" : "12px";
  svg
    .selectAll(".score-label")
    .data(latestScores)
    .enter()
    .append("text")
    .attr("class", "score-label")
    .attr("x", (d) => {
      if (d.score >= 0) {
        // Positive scores: show label on the right side of the bar
        return x(d.score) + 5;
      } else {
        // Negative scores: show label on the right side (zero side) of the bar to avoid overflow
        // Position it just to the right of the bar end (which is at zeroX)
        return Math.max(0, zeroX - 5);
      }
    })
    .attr("y", (d) => y(d.team)! + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", (d) => (d.score >= 0 ? "start" : "end"))
    .attr("fill", "#333")
    .attr("font-size", labelFontSize)
    .attr("font-weight", "bold")
    .text((d) => {
      // Only show label if bar is wide enough
      const barWidth = Math.abs(x(d.score) - zeroX);
      return barWidth > 50 ? d.score.toLocaleString() : "";
    });
}

function renderRankingTable(data: TeamScore[]) {
  // Get latest scores for each team
  const latestScores = Array.from(d3.group(data, (d) => d.team).values()).map(
    (teamScores) => {
      return teamScores.reduce((latest, current) => {
        return new Date(current.timestamp) > new Date(latest.timestamp)
          ? current
          : latest;
      });
    }
  );

  // Sort by score descending
  latestScores.sort((a, b) => b.score - a.score);

  const rankings: TeamRanking[] = latestScores.map((teamScore, index) => {
    return {
      rank: index + 1,
      team: teamScore.team,
      score: teamScore.score,
      change: null,
      changePercent: null,
    };
  });

  // Update previous scores
  previousScores.clear();
  latestScores.forEach((ts) => previousScores.set(ts.team, ts.score));

  // Clear existing table
  d3.select("#ranking-table").selectAll("*").remove();

  // Create title
  d3.select("#ranking-table")
    .append("h2")
    .style("text-align", "center")
    .html(
      `Ranking <span style="font-size: 0.7em; color: #666; font-weight: normal;">(${rankings.length} teams)</span>`
    );

  // Create table
  const table = d3
    .select("#ranking-table")
    .append("table")
    .attr("class", "ranking-table")
    .style("table-layout", "fixed")
    .style("width", "100%");

  // Create header
  const thead = table.append("thead");
  const headerRow = thead.append("tr");
  headerRow
    .append("th")
    .text("Rank")
    .style("padding", "12px 16px")
    .style("background-color", "#667eea")
    .style("color", "#fff")
    .style("font-weight", "bold")
    .style("text-align", "center")
    .style("position", "sticky")
    .style("top", "0")
    .style("z-index", "5")
    .style("width", window.innerWidth < 480 ? "40px" : "60px");
  headerRow
    .append("th")
    .text("Team")
    .style("padding", "12px 16px")
    .style("background-color", "#667eea")
    .style("color", "#fff")
    .style("font-weight", "bold")
    .style("text-align", "center")
    .style("position", "sticky")
    .style("top", "0")
    .style("z-index", "5")
    .style("width", "auto")
    .style("min-width", window.innerWidth < 480 ? "80px" : "120px");
  headerRow
    .append("th")
    .text("Score")
    .style("padding", "12px 16px")
    .style("background-color", "#667eea")
    .style("color", "#fff")
    .style("font-weight", "bold")
    .style("text-align", "center")
    .style("position", "sticky")
    .style("top", "0")
    .style("z-index", "5")
    .style("width", window.innerWidth < 480 ? "80px" : "150px");

  // Create tbody
  const tbody = table.append("tbody");

  // Responsive padding
  const cellPadding = window.innerWidth < 480 ? "8px 6px" : "12px 16px";

  const rows = tbody
    .selectAll("tr")
    .data(rankings)
    .enter()
    .append("tr")
    .attr("class", (d) => `rank-${d.rank}`)
    .style("transition", "all 0.3s ease");

  // Rank column
  rows
    .append("td")
    .style("padding", cellPadding)
    .style("font-weight", "bold")
    .style("text-align", "center")
    .style("width", window.innerWidth < 480 ? "40px" : "60px")
    .html((d) => {
      if (d.rank === 1) return "🥇";
      if (d.rank === 2) return "🥈";
      if (d.rank === 3) return "🥉";
      return `#${d.rank}`;
    })
    .style("color", (d) => {
      if (d.rank === 1) return "#FFD700";
      if (d.rank === 2) return "#C0C0C0";
      if (d.rank === 3) return "#CD7F32";
      return "#666";
    });

  // Team name column
  rows
    .append("td")
    .style("padding", cellPadding)
    .style("font-weight", "500")
    .style("text-align", "center")
    .style("width", "auto")
    .style("max-width", window.innerWidth < 480 ? "100px" : "200px")
    .style("overflow", "hidden")
    .style("text-overflow", "ellipsis")
    .style("white-space", "nowrap")
    .text((d) => d.team)
    .attr("title", (d) => d.team);

  // Score column
  rows
    .append("td")
    .style("padding", cellPadding)
    .style("font-weight", "bold")
    .style("text-align", "center")
    .style("font-family", "monospace")
    .style("width", window.innerWidth < 480 ? "80px" : "150px")
    .style("font-size", window.innerWidth < 480 ? "12px" : "14px")
    .html((d) => {
      return `<span>${d.score.toLocaleString()}</span>`;
    });

  // Add hover effects
  rows
    .style("background-color", "#fff")
    .on("mouseenter", function (event, d) {
      d3.select(this)
        .style("background-color", "#f0f0f0")
        .style("transform", "scale(1.01)")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)");
    })
    .on("mouseleave", function (event, d) {
      const bgColor =
        d.rank === 1
          ? "#fff9e6"
          : d.rank === 2
          ? "#f5f5f5"
          : d.rank === 3
          ? "#faf5f0"
          : "#fff";
      d3.select(this)
        .style("background-color", bgColor)
        .style("transform", "scale(1)")
        .style("box-shadow", "none");
    });

  // Highlight top 3
  rows
    .filter((d) => d.rank <= 3)
    .style("background-color", (d) => {
      if (d.rank === 1) return "#fff9e6";
      if (d.rank === 2) return "#f5f5f5";
      return "#faf5f0";
    })
    .style("border-left", (d) => {
      if (d.rank === 1) return "#FFD700";
      if (d.rank === 2) return "#C0C0C0";
      return "#CD7F32";
    });

  // Highlight rows with significant score changes
  rows
    .filter((d) => d.change !== null && Math.abs(d.change) > 100)
    .style("animation", "pulse 0.5s ease-in-out")
    .style("background-color", (d) => {
      if (d.change! > 0) return "#e8f5e9";
      return "#ffebee";
    });
}

// Function to update the graph
function updateGraph() {
  fetchData().then((data) => {
    // Clear existing graphs
    d3.select("#timeline-chart").selectAll("*").remove();
    d3.select("#bar-chart").selectAll("*").remove();

    // Re-render the graphs with the latest data
    renderRankingTable(data);
    renderTimeline(data);
    renderBarChart(data);
  });
}

// リサイズ時の処理（デバウンス付き）
let resizeTimeout: number;
function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = window.setTimeout(() => {
    updateGraph();
  }, 250); // 250ms待ってから再描画
}

// Initial graph rendering
updateGraph();

// ウィンドウリサイズイベントリスナーを追加
window.addEventListener("resize", handleResize);

// Fetch and refresh the graph every 30 seconds (30,000 ms)
setInterval(updateGraph, 30000);
