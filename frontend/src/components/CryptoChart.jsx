import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  TimeScale,
  Tooltip,
  CategoryScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  Legend
} from "chart.js";

import {
  CandlestickController,
  CandlestickElement
} from "chartjs-chart-financial";
import zoomPlugin from "chartjs-plugin-zoom";
import { Chart } from "react-chartjs-2";
import "chartjs-adapter-date-fns";


ChartJS.register(
  LinearScale,
  TimeScale,
  CategoryScale,
  Tooltip,
  Legend,
  BarController,
  zoomPlugin,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CandlestickController,
  CandlestickElement
);

const API_BASE =
  "https://super-invention-qvp46rrwg67cxjvj-3000.app.github.dev";

export default function CryptoChart({ coin }) {
  

  /* ======================
     State
  ====================== */
  const COLORS = {
  bg: "#020617",
  panel: "#020617",
  grid: "rgba(255,255,255,0.06)",
  text: "#cbd5f5",
  muted: "#64748b",
  green: "#16c784",
  red: "#ea3943",
  cyan: "#22d3ee",
  yellow: "#facc15",
  purple: "#a855f7"
};
  const [candles, setCandles] = useState([]);
  const [ema20, setEma20] = useState([]);
  const [ema50, setEma50] = useState([]);
  const [rsi, setRsi] = useState([]);

  const [showEMA, setShowEMA] = useState(true);
  const [showRSI, setShowRSI] = useState(true);

  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange24h, setPriceChange24h] = useState(null);
  const [timeframe, setTimeframe] = useState("1h");
  
  /* ======================
     Load chart data
  ====================== */
  async function load() {
    try {
      const res = await fetch(
        `${API_BASE}/crypto/chart?coin=${coin}&tf=${timeframe}`
      );
      const data = await res.json();

      const cleanCandles = Array.isArray(data.candles)
        ? data.candles.filter(
            c =>
              c &&
              typeof c.x === "number" &&
              typeof c.o === "number" &&
              typeof c.h === "number" &&
              typeof c.l === "number" &&
              typeof c.c === "number"
          )
        : [];

      setCandles(cleanCandles);
      setEma20(data.ema20 || []);
      setEma50(data.ema50 || []);
      setRsi(data.rsi || []);

      if (cleanCandles.length > 0) {
        const last = cleanCandles[cleanCandles.length - 1];
        setCurrentPrice(last.c);

        if (cleanCandles.length > 1) {
          const target = last.x - 24 * 60 * 60 * 1000;
          let prev = cleanCandles[0].c;

          for (let i = cleanCandles.length - 1; i >= 0; i--) {
            if (cleanCandles[i].x <= target) {
              prev = cleanCandles[i].c;
              break;
            }
          }

          setPriceChange24h(((last.c - prev) / prev) * 100);
        }
      }
    } catch (err) {
      console.error("Chart load failed", err);
    }
  }

  useEffect(() => {
    load();
  }, [coin, timeframe]);

  // Auto refresh
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [coin, timeframe]);

  if (!candles.length) {
    return <div className="glass-card">Loading chart…</div>;
  }

  /* ======================
     Datasets
  ====================== */
  const candleDataset = {
  type: "candlestick",
  data: candles,
  parsing: false,
  yAxisID: "price",
  barThickness: 6,
  maxBarThickness: 8,
  color: {
    up: COLORS.green,
    down: COLORS.red,
    unchanged: COLORS.muted
  }
};


  const volumeDataset = {
  type: "bar",
  data: candles.map(c => ({ x: c.x, y: c.v || 0 })),
  yAxisID: "volume",
  backgroundColor: "rgba(148,163,184,0.18)", // slate tone
  barThickness: 6,
  borderRadius: 2
};

  const ema20Dataset = {
  type: "line",
  data: ema20
    .map((v, i) =>
      typeof v === "number" && candles[i]
        ? { x: candles[i].x, y: v }
        : null
    )
    .filter(Boolean),
  borderColor: COLORS.cyan,
  borderWidth: 1.2,
  pointRadius: 0,
  tension: 0.3,
  yAxisID: "price"
};

const ema50Dataset = {
  type: "line",
  data: ema50
    .map((v, i) =>
      typeof v === "number" && candles[i]
        ? { x: candles[i].x, y: v }
        : null
    )
    .filter(Boolean),
  borderColor: COLORS.yellow,
  borderWidth: 1.2,
  pointRadius: 0,
  tension: 0.3,
  yAxisID: "price"
};

const rsiChartData = {
  datasets: [
    {
      type: "line",
      data: rsi
        .map((v, i) =>
          typeof v === "number" && candles[i]
            ? { x: candles[i].x, y: v }
            : null
        )
        .filter(Boolean),
      borderColor: COLORS.purple,
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.35
    }
  ]
};

const rsiOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  },
  scales: {
    x: {
      type: "time",
      display: false
    },
    y: {
      min: 0,
      max: 100,
      grid: {
        color: COLORS.grid
      },
      ticks: {
        color: COLORS.purple,
        callback: v => (v === 30 || v === 50 || v === 70 ? v : "")
      },
      afterBuildTicks: scale => {
        scale.ticks = [
          { value: 30 },
          { value: 50 },
          { value: 70 }
        ];
      }
    }
  }
};


  const chartData = {
    datasets: [
      candleDataset,
      ...(showEMA ? [ema20Dataset, ema50Dataset] : []),
      volumeDataset,
      
    ]
  };

  const options = {
  responsive: true,
  maintainAspectRatio: false,
  normalized: true,

  plugins: {
    legend: { display: false },

    zoom: {
      pan: {
        enabled: true,
        mode: "x",
        modifierKey: "shift"
      },

      zoom: {
        wheel: { enabled: true },
        pinch: { enabled: true },
        mode: "x",
        limits: {
          x: {
            minRange: 60 * 60 * 1000 // ⏱️ 1 hour minimum
          }
        }
      }
    }
  },

  scales: {
    x: {
      type: "time",
      grid: { color: COLORS.grid },
      ticks: {
        autoSkip: true,
        maxTicksLimit: 12
      }
    },

    price: {
      position: "left",
      weight: 3,
      grid: {
        color: COLORS.grid
      }
    },
        
    volume: {
      display: false,
      position: "right",
      beginAtZero: true,
      weight: 0.2,
      stacked: true,
  min: 0,
  max: Math.max(...candles.map(c => c.v || 0)) * 3
    },

     
      
   }
};

  /* ======================
     Render
  ====================== */
 return (
  <div className="glass-card" style={{ height: 620 }}>

    {/* TradingView style toolbar */}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.08)"
      }}
    >
      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <strong>{coin.toUpperCase()}/USD</strong>

        <span style={{ color: "#16c784", fontWeight: "bold" }}>
          ${currentPrice?.toLocaleString()}
        </span>

        {priceChange24h !== null && (
          <span
            style={{
              color: priceChange24h >= 0 ? "#16c784" : "#ea3943",
              fontWeight: "bold"
            }}
          >
            {priceChange24h >= 0 ? "▲" : "▼"}{" "}
            {priceChange24h.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Center */}
      <div style={{ display: "flex", gap: 6 }}>
        {["1h", "1d", "7d"].map(tf => (
  <button
  onClick={() => setTimeframe(tf)}
  style={{
    padding: "4px 10px",
    borderRadius: 6,
    background: timeframe === tf ? "#22d3ee" : "#0f172a",
    color: timeframe === tf ? "#000" : "#9ca3af",
    border: "1px solid rgba(255,255,255,0.1)",
    fontSize: 12,
    cursor: "pointer"
  }}
>
  {tf.toUpperCase()}
</button>
))}
      </div>

      {/* Right */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setShowEMA(v => !v)}>EMA</button>
        <button onClick={load}>⟳</button>
      </div>
    </div>

    {/* Chart */}
    <div style={{ height: 400 }}>
  <Chart
    data={chartData}
    options={options}
  />
  

</div>

  {/* RSI CHART */}
  <div style={{ height: 120, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
    <Chart data={rsiChartData} options={rsiOptions} />
  </div>

</div>
);

}
