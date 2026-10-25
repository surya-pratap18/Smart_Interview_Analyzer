import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LineChart,
  Line,
} from "recharts";
import axios from "axios";
import toast from "react-hot-toast";

const EMOTIONS = [
  { key: "happy", label: "Happy", emoji: "😊", color: "#00e5c3" },
  { key: "neutral", label: "Neutral", emoji: "😐", color: "#4f8eff" },
  { key: "surprised", label: "Surprised", emoji: "😮", color: "#ffb347" },
  { key: "fearful", label: "Nervous", emoji: "😰", color: "#ff9d6b" },
  { key: "angry", label: "Tense", emoji: "😤", color: "#ff5f7e" },
  { key: "disgusted", label: "Discomfort", emoji: "😬", color: "#b06aff" },
];

function ScoreRing({ score, size = 100, stroke = 8 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 75 ? "#00e5c3" : score >= 55 ? "#4f8eff" : "#ff5f7e";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{
          transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </svg>
  );
}

export default function ResultsPage() {
  const { sessionId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(state?.data || null);
  const [loading, setLoading] = useState(!state?.data);
  const [activeTab, setTab] = useState("overview");

  useEffect(() => {
    if (!data && sessionId) {
      axios
        .get(`/api/interview/${sessionId}`)
        .then((r) => setData(r.data))
        .catch(() => {
          toast.error("Session not found");
          navigate("/history");
        })
        .finally(() => setLoading(false));
    }
  }, [sessionId, data, navigate]);

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          gap: 12,
        }}
      >
        <svg width="32" height="32" style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx="16"
            cy="16"
            r="12"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="3"
            strokeDasharray="75"
            style={{ animation: "spin 1s linear infinite" }}
          />
        </svg>
        <span style={{ color: "var(--tx2)" }}>Loading results...</span>
      </div>
    );

  if (!data) return null;

  const bd = data.score?.breakdown || {};
  const scoreColor =
    data.overall_score >= 75
      ? "var(--acc)"
      : data.overall_score >= 55
        ? "var(--brand)"
        : "var(--danger)";
  const scoreLabel =
    data.overall_score >= 80
      ? "Excellent"
      : data.overall_score >= 65
        ? "Good"
        : data.overall_score >= 50
          ? "Fair"
          : "Needs Work";
  const fillerFound = data.fillers?.found || {};
  const maxFiller = Math.max(...Object.values(fillerFound), 1);
  const fillerSet = new Set(Object.keys(fillerFound));

  const radarData = [
    { subject: "Sentiment", value: bd.sentiment || 0 },
    { subject: "Clarity", value: bd.clarity || 0 },
    { subject: "Pace", value: bd.pace || 0 },
    { subject: "Fillers", value: bd.filler_usage || 0 },
    { subject: "Emotion", value: bd.emotion || 0 },
    { subject: "Eye Contact", value: bd.eye_contact || 0 },
  ];

  const barData = Object.entries(fillerFound)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w, c]) => ({ word: `"${w}"`, count: c }));

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: "overview", label: "📊 Overview" },
    { id: "emotion", label: "😊 Emotions" },
    { id: "transcript", label: "📝 Transcript" },
    { id: "feedback", label: "💡 Feedback" },
  ];

  return (
    <div
      style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px 60px" }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <h1
              style={{
                fontFamily: "var(--fd)",
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: "-0.5px",
              }}
            >
              Analysis Results
            </h1>
            <span className="badge bp">✓ Complete</span>
          </div>
          <p style={{ color: "var(--tx2)", fontSize: 12 }}>
            {data.filename} · {data.language_name} ·{" "}
            {Math.floor(data.duration / 60)}m {Math.round(data.duration % 60)}s
            {data.target_language_name &&
              ` · Translated → ${data.target_language_name}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          {data.subtitles?.srt && (
            <button
              className="btn btng"
              style={{ fontSize: 12, padding: "6px 13px" }}
              onClick={() =>
                downloadFile(
                  data.subtitles.srt,
                  `${data.filename}.srt`,
                  "text/plain",
                )
              }
            >
              ⬇ SRT
            </button>
          )}
          {data.subtitles?.vtt && (
            <button
              className="btn btng"
              style={{ fontSize: 12, padding: "6px 13px" }}
              onClick={() =>
                downloadFile(
                  data.subtitles.vtt,
                  `${data.filename}.vtt`,
                  "text/vtt",
                )
              }
            >
              ⬇ VTT
            </button>
          )}
        </div>
      </div>

      {/* Score hero */}
      <div
        className="card"
        style={{
          padding: 22,
          marginBottom: 14,
          background:
            "linear-gradient(135deg,rgba(79,142,255,0.07),rgba(0,229,195,0.04))",
          border: "1px solid var(--bord2)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 22,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 96,
              height: 96,
              flexShrink: 0,
            }}
          >
            <ScoreRing score={data.overall_score} size={96} stroke={8} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--fd)",
                  fontSize: 24,
                  fontWeight: 800,
                  color: scoreColor,
                  lineHeight: 1,
                }}
              >
                {data.overall_score}
              </span>
              <span
                style={{ fontSize: 9, color: "var(--tx3)", fontWeight: 600 }}
              >
                /100
              </span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div
              style={{
                fontFamily: "var(--fd)",
                fontSize: 20,
                fontWeight: 800,
                color: scoreColor,
                marginBottom: 6,
              }}
            >
              {scoreLabel}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span
                className={`badge ${data.sentiment?.label === "positive" ? "bp" : "bn"}`}
              >
                {data.sentiment?.label === "positive" ? "😊" : "😐"}{" "}
                {data.sentiment?.label}
              </span>
              <span className="badge bn">⚡ {data.score?.wpm} wpm</span>
              <span
                className={`badge ${data.fillers?.filler_rate_percent < 3 ? "bp" : data.fillers?.filler_rate_percent < 6 ? "bw" : "bd"}`}
              >
                💬 {data.fillers?.filler_rate_percent}% fillers
              </span>
              {data.score?.grade && (
                <span
                  className="badge"
                  style={{
                    background: "rgba(176,106,255,0.1)",
                    color: "var(--purple)",
                    border: "1px solid rgba(176,106,255,0.2)",
                  }}
                >
                  Grade {data.score.grade}
                </span>
              )}
            </div>
          </div>
          <div style={{ minWidth: 170 }}>
            {Object.entries(bd).map(([k, v]) => (
              <div key={k} style={{ marginBottom: 5 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--tx2)",
                      textTransform: "capitalize",
                    }}
                  >
                    {k.replace("_", " ")}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{v}</span>
                </div>
                <div
                  style={{
                    height: 3,
                    background: "var(--bg3)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${v}%`,
                      background:
                        v >= 75
                          ? "var(--acc)"
                          : v >= 55
                            ? "var(--brand)"
                            : "var(--danger)",
                      transition: "width 1s ease",
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 3,
          background: "var(--bg2)",
          border: "1px solid var(--bord)",
          padding: 3,
          borderRadius: 10,
          width: "fit-content",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              border: "none",
              fontFamily: "var(--fb)",
              transition: "all 0.2s",
              background: activeTab === t.id ? "var(--surf)" : "transparent",
              color: activeTab === t.id ? "var(--tx)" : "var(--tx2)",
              boxShadow:
                activeTab === t.id ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === "overview" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div className="card">
            <h3
              style={{
                fontFamily: "var(--fd)",
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              Performance Radar
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.06)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{
                    fill: "var(--tx2)",
                    fontSize: 10,
                    fontFamily: "var(--fb)",
                  }}
                />
                <Radar
                  dataKey="value"
                  stroke="var(--brand)"
                  fill="var(--brand)"
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3
              style={{
                fontFamily: "var(--fd)",
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              Filler Words · {data.fillers?.total_count || 0} total
            </h3>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} layout="vertical" barCategoryGap="25%">
                  <XAxis
                    type="number"
                    tick={{ fill: "var(--tx3)", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="word"
                    tick={{ fill: "var(--tx2)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surf)",
                      border: "1px solid var(--bord)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {barData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={
                          i === 0
                            ? "var(--danger)"
                            : i === 1
                              ? "var(--warn)"
                              : "var(--brand)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: 40,
                  color: "var(--tx3)",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
                <p>No filler words detected!</p>
              </div>
            )}
          </div>

          <div className="card">
            <h3
              style={{
                fontFamily: "var(--fd)",
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              Keywords Detected
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {(data.keywords || []).map((kw) => (
                <div
                  key={kw.word}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 100,
                    background: "rgba(79,142,255,0.08)",
                    border: "1px solid rgba(79,142,255,0.2)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--brand)",
                  }}
                >
                  {kw.word}{" "}
                  <span style={{ opacity: 0.5, fontWeight: 400 }}>
                    ×{kw.count}
                  </span>
                  {kw.is_power_word && (
                    <span style={{ color: "var(--acc)", marginLeft: 3 }}>
                      ⚡
                    </span>
                  )}
                </div>
              ))}
              {(!data.keywords || data.keywords.length === 0) && (
                <p style={{ color: "var(--tx3)", fontSize: 13 }}>
                  No keywords extracted
                </p>
              )}
            </div>
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "var(--bg2)",
                borderRadius: "var(--rsm)",
                fontSize: 12,
                color: "var(--tx2)",
              }}
            >
              📈 {data.fillers?.word_count || 0} words ·{" "}
              {data.clarity?.sentence_count || 0} sentences · avg{" "}
              {data.clarity?.avg_sentence_length || 0} words/sentence
            </div>
          </div>

          <div className="card">
            <h3
              style={{
                fontFamily: "var(--fd)",
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              Session Stats
            </h3>
            {[
              ["🗣️", "Total Words", `${data.fillers?.word_count || 0} words`],
              [
                "⚡",
                "Speaking Pace",
                `${data.score?.wpm || 0} words per minute`,
              ],
              [
                "💬",
                "Filler Rate",
                `${data.fillers?.filler_rate_percent || 0}% of speech`,
              ],
              [
                "📝",
                "Sentences",
                `${data.clarity?.sentence_count || 0} sentences`,
              ],
              [
                "📏",
                "Avg Sentence",
                `${data.clarity?.avg_sentence_length || 0} words`,
              ],
              [
                "💪",
                "Power Words",
                `${data.clarity?.power_word_count || 0} found`,
              ],
            ].map(([ic, l, v]) => (
              <div
                key={l}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  marginBottom: 9,
                }}
              >
                <span style={{ fontSize: 14, width: 18 }}>{ic}</span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--tx2)",
                      marginBottom: 1,
                    }}
                  >
                    {l}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Emotions ── */}
      {activeTab === "emotion" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.emotion_timeline?.length > 0 ? (
            <div className="card">
              <h3
                style={{
                  fontFamily: "var(--fd)",
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                Emotion Timeline
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.emotion_timeline}>
                  <XAxis
                    dataKey="t"
                    tick={{ fill: "var(--tx3)", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}s`}
                  />
                  <YAxis
                    tick={{ fill: "var(--tx3)", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surf)",
                      border: "1px solid var(--bord)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  {EMOTIONS.map((em) => (
                    <Line
                      key={em.key}
                      type="monotone"
                      dataKey={em.key}
                      stroke={em.color}
                      strokeWidth={1.5}
                      dot={false}
                      name={em.label}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 8,
                }}
              >
                {EMOTIONS.map((em) => (
                  <div
                    key={em.key}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 2,
                        background: em.color,
                        borderRadius: 1,
                      }}
                    />
                    <span style={{ fontSize: 10, color: "var(--tx2)" }}>
                      {em.emoji} {em.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="card"
              style={{ textAlign: "center", padding: 40, color: "var(--tx3)" }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>📹</div>
              <p
                style={{
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "var(--tx2)",
                }}
              >
                No emotion data
              </p>
              <p style={{ fontSize: 13 }}>
                Emotion detection requires a video file with a visible face.
              </p>
            </div>
          )}

          {data.emotion_summary &&
            Object.values(data.emotion_summary).some((v) => v > 0) && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 10,
                }}
              >
                {EMOTIONS.map((em) => {
                  const val = data.emotion_summary?.[em.key] || 0;
                  return (
                    <div
                      key={em.key}
                      className="card"
                      style={{
                        textAlign: "center",
                        padding: 16,
                        border: `1px solid ${em.color}22`,
                      }}
                    >
                      <div style={{ fontSize: 22, marginBottom: 5 }}>
                        {em.emoji}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--fd)",
                          fontSize: 22,
                          fontWeight: 800,
                          color: em.color,
                          marginBottom: 2,
                        }}
                      >
                        {val}%
                      </div>
                      <div style={{ fontSize: 11, color: "var(--tx2)" }}>
                        {em.label}
                      </div>
                      <div
                        style={{
                          height: 3,
                          background: "var(--bg3)",
                          borderRadius: 2,
                          overflow: "hidden",
                          marginTop: 7,
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${val}%`,
                            background: em.color,
                            borderRadius: 2,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          {data.posture_summary && (
            <div className="card">
              <h3
                style={{
                  fontFamily: "var(--fd)",
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                Posture Breakdown
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 10,
                }}
              >
                {[
                  [
                    "✅",
                    "Good Posture",
                    `${data.posture_summary.good || 0}%`,
                    "var(--acc)",
                  ],
                  [
                    "↗️",
                    "Leaning",
                    `${data.posture_summary.leaning || 0}%`,
                    "var(--warn)",
                  ],
                  [
                    "👀",
                    "Looking Away",
                    `${data.posture_summary.slouching || 0}%`,
                    "var(--danger)",
                  ],
                ].map(([ic, l, v, col]) => (
                  <div
                    key={l}
                    style={{
                      padding: 14,
                      background: "var(--bg3)",
                      borderRadius: "var(--rsm)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 5 }}>{ic}</div>
                    <div
                      style={{
                        fontFamily: "var(--fd)",
                        fontSize: 20,
                        fontWeight: 800,
                        color: col,
                        marginBottom: 2,
                      }}
                    >
                      {v}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--tx2)" }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Transcript ── */}
      {activeTab === "transcript" && (
        <div className="card" style={{ padding: 22 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <h3
              style={{ fontFamily: "var(--fd)", fontSize: 14, fontWeight: 700 }}
            >
              Transcript
            </h3>
            <span className="badge bn" style={{ fontSize: 10 }}>
              🟡 = filler word
            </span>
          </div>

          {data.translated_transcript && (
            <div
              style={{
                padding: "12px 14px",
                background: "rgba(0,229,195,0.05)",
                border: "1px solid rgba(0,229,195,0.15)",
                borderRadius: "var(--rsm)",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--acc)",
                  fontWeight: 600,
                  marginBottom: 5,
                }}
              >
                🌍 Translated ({data.target_language_name})
              </div>
              <p style={{ fontSize: 13, color: "var(--tx2)", lineHeight: 1.7 }}>
                {data.translated_transcript}
              </p>
            </div>
          )}

          {(data.segments || []).map((seg) => {
            const fmtT = (s) =>
              `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
            return (
              <div
                key={seg.id}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--bord)",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--brand)",
                    fontWeight: 700,
                    minWidth: 36,
                    paddingTop: 3,
                  }}
                >
                  {fmtT(seg.start)}
                </span>
                <p
                  style={{ fontSize: 13, lineHeight: 1.7, color: "var(--tx2)" }}
                >
                  {seg.text.split(" ").map((w, i) => {
                    const clean = w.toLowerCase().replace(/[^a-z\s]/g, "");
                    const isFiller = fillerSet.has(clean);
                    return (
                      <span
                        key={i}
                        style={{
                          color: isFiller ? "var(--warn)" : "var(--tx)",
                          background: isFiller
                            ? "rgba(255,179,71,0.1)"
                            : "transparent",
                          borderRadius: 3,
                          padding: isFiller ? "0 2px" : 0,
                          fontWeight: isFiller ? 600 : 400,
                        }}
                      >
                        {w}{" "}
                      </span>
                    );
                  })}
                </p>
              </div>
            );
          })}

          {(!data.segments || data.segments.length === 0) && (
            <p
              style={{ color: "var(--tx3)", textAlign: "center", padding: 30 }}
            >
              No transcript segments available
            </p>
          )}
        </div>
      )}

      {/* ── Feedback ── */}
      {activeTab === "feedback" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(data.feedback || []).map((fb, i) => (
            <div
              key={i}
              className="card"
              style={{
                borderColor:
                  fb.priority === "high"
                    ? "rgba(255,95,126,0.25)"
                    : fb.priority === "medium"
                      ? "rgba(255,179,71,0.2)"
                      : "rgba(0,229,195,0.2)",
                background:
                  fb.priority === "high"
                    ? "rgba(255,95,126,0.04)"
                    : fb.priority === "medium"
                      ? "rgba(255,179,71,0.03)"
                      : "rgba(0,229,195,0.03)",
              }}
            >
              <div
                style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{fb.icon}</span>
                <div>
                  <div
                    style={{
                      display: "flex",
                      gap: 7,
                      alignItems: "center",
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--fd)",
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {fb.category}
                    </span>
                    <span
                      className={`badge ${fb.priority === "high" ? "bd" : fb.priority === "medium" ? "bw" : "bp"}`}
                    >
                      {fb.priority}
                    </span>
                  </div>
                  <p
                    style={{
                      color: "var(--tx2)",
                      fontSize: 13,
                      lineHeight: 1.6,
                      marginBottom: fb.tip ? 6 : 0,
                    }}
                  >
                    {fb.message}
                  </p>
                  {fb.tip && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--brand)",
                        fontStyle: "italic",
                      }}
                    >
                      💡 {fb.tip}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {(!data.feedback || data.feedback.length === 0) && (
            <div
              className="card"
              style={{ textAlign: "center", padding: 40, color: "var(--tx3)" }}
            >
              <p>No feedback generated</p>
            </div>
          )}

          {/* Improvement roadmap */}
          <div className="card" style={{ background: "var(--bg2)" }}>
            <h3
              style={{
                fontFamily: "var(--fd)",
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              📈 Improvement Roadmap
            </h3>
            {[
              [
                "Week 1",
                'Record daily 2-min responses. Focus only on eliminating "um" and "uh".',
              ],
              [
                "Week 2",
                "Practice maintaining eye contact with camera. Review recordings for gaze consistency.",
              ],
              [
                "Week 3",
                "Smile at the start of each answer. Practice confident facial expressions in a mirror.",
              ],
            ].map(([w, g]) => (
              <div
                key={w}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  marginBottom: 8,
                }}
              >
                <span
                  className="badge bn"
                  style={{ minWidth: 54, justifyContent: "center" }}
                >
                  {w}
                </span>
                <p
                  style={{ fontSize: 12, color: "var(--tx2)", lineHeight: 1.5 }}
                >
                  {g}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
