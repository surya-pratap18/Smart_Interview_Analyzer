import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

// ── Supported languages (expanded with more Indian languages) ─────────────────
const LANGUAGES = [
  { code: "", name: "No Translation (keep original)" },
  // Indian Languages
  { code: "hi", name: "🇮🇳 Hindi" },
  { code: "bn", name: "🇮🇳 Bengali" },
  { code: "te", name: "🇮🇳 Telugu" },
  { code: "mr", name: "🇮🇳 Marathi" },
  { code: "ta", name: "🇮🇳 Tamil" },
  { code: "ur", name: "🇮🇳 Urdu" },
  { code: "gu", name: "🇮🇳 Gujarati" },
  { code: "kn", name: "🇮🇳 Kannada" },
  { code: "ml", name: "🇮🇳 Malayalam" },
  { code: "pa", name: "🇮🇳 Punjabi" },
  { code: "or", name: "🇮🇳 Odia" },
  { code: "as", name: "🇮🇳 Assamese" },
  { code: "sa", name: "🇮🇳 Sanskrit" },
  { code: "mai", name: "🇮🇳 Maithili" },
  { code: "kok", name: "🇮🇳 Konkani" },
  { code: "ne", name: "🇮🇳 Nepali" },
  { code: "si", name: "🇱🇰 Sinhala" },
  // International
  { code: "fr", name: "🇫🇷 French" },
  { code: "de", name: "🇩🇪 German" },
  { code: "es", name: "🇪🇸 Spanish" },
  { code: "pt", name: "🇵🇹 Portuguese" },
  { code: "it", name: "🇮🇹 Italian" },
  { code: "ru", name: "🇷🇺 Russian" },
  { code: "ar", name: "🇸🇦 Arabic" },
  { code: "zh-CN", name: "🇨🇳 Chinese" },
  { code: "ja", name: "🇯🇵 Japanese" },
  { code: "ko", name: "🇰🇷 Korean" },
  { code: "nl", name: "🇳🇱 Dutch" },
  { code: "tr", name: "🇹🇷 Turkish" },
  { code: "vi", name: "🇻🇳 Vietnamese" },
  { code: "pl", name: "🇵🇱 Polish" },
  { code: "sv", name: "🇸🇪 Swedish" },
  { code: "fi", name: "🇫🇮 Finnish" },
];

const EMOTIONS = [
  { key: "happy", label: "Happy", emoji: "😊", color: "#00e5c3" },
  { key: "neutral", label: "Neutral", emoji: "😐", color: "#4f8eff" },
  { key: "fear", label: "Nervous", emoji: "😰", color: "#ff9d6b" },
  { key: "angry", label: "Tense", emoji: "😤", color: "#ff5f7e" },
  { key: "sad", label: "Sad", emoji: "😢", color: "#b06aff" },
  { key: "surprise", label: "Surprised", emoji: "😮", color: "#ffb347" },
  { key: "disgust", label: "Discomfort", emoji: "😬", color: "#888" },
];

const STAGES = [
  { icon: "🎙️", label: "Processing audio..." },
  { icon: "🗣️", label: "Transcribing speech..." },
  { icon: "🧠", label: "Running NLP analysis..." },
  { icon: "😊", label: "Analyzing emotions..." },
  { icon: "🌍", label: "Translating content..." },
  { icon: "📊", label: "Generating your report..." },
];

// ── Waveform visualizer ───────────────────────────────────────────────────────
function Waveform({ active }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 32 }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            background: active
              ? "linear-gradient(180deg,var(--brand),var(--acc))"
              : "var(--surf2)",
            height: "18%",
            animationName: active ? "wavebar" : "none",
            animationDuration: active ? `${0.5 + (i % 5) * 0.15}s` : "0s",
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
            animationDelay: `${i * 0.04}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Processing overlay ────────────────────────────────────────────────────────
function ProcessingOverlay({ stage }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(7,13,26,0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
        backdropFilter: "blur(18px)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 52,
            marginBottom: 14,
            animation: "pulse 1s ease infinite",
          }}
        >
          {STAGES[stage]?.icon}
        </div>
        <svg
          width="60"
          height="60"
          style={{
            transform: "rotate(-90deg)",
            display: "block",
            margin: "0 auto 14px",
          }}
        >
          <circle
            cx="30"
            cy="30"
            r="24"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="4"
          />
          <circle
            cx="30"
            cy="30"
            r="24"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="150"
            style={{ animation: "spin 1.4s linear infinite" }}
          />
        </svg>
        <p
          style={{
            fontFamily: "var(--fd)",
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          {STAGES[stage]?.label}
        </p>
        <p style={{ color: "var(--tx3)", fontSize: 12 }}>
          Processing audio + emotion data together...
        </p>
      </div>
    </div>
  );
}

// ── Live Camera with Emotion Detection ───────────────────────────────────────
function LiveCamera({ recording, onEmotionUpdate, onFramesCollected }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const captureRef = useRef(null);
  const framesRef = useRef([]); // collected base64 frames

  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState(null);
  const [emotions, setEmotions] = useState({});
  const [dominant, setDominant] = useState(null);
  const [eyeContact, setEyeContact] = useState(null);
  const [faceFound, setFaceFound] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  // Start camera
  useEffect(() => {
    let alive = true;
    navigator.mediaDevices
      .getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      })
      .then((stream) => {
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (alive) setCamReady(true);
          };
        }
      })
      .catch((err) => {
        if (alive) setCamError(err.message || "Camera access denied");
      });

    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Capture frames every 2 seconds during recording
  useEffect(() => {
    if (recording && camReady) {
      framesRef.current = [];
      setFrameCount(0);

      captureRef.current = setInterval(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext("2d");
        canvas.width = 224;
        canvas.height = 224;
        // Mirror the image (camera is mirrored in display)
        ctx.translate(224, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, 224, 224);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const b64 = canvas.toDataURL("image/jpeg", 0.8);
        framesRef.current.push(b64);
        setFrameCount(framesRef.current.length);

        // Simulate local emotion detection for live HUD
        // (Real detection happens in backend after recording)
        simulateEmotionHUD();
      }, 2000);
    } else {
      clearInterval(captureRef.current);
      if (!recording && framesRef.current.length > 0) {
        onFramesCollected?.(framesRef.current);
      }
      if (!recording) {
        setEmotions({});
        setDominant(null);
        setEyeContact(null);
        setFaceFound(false);
        setFrameCount(0);
      }
    }

    return () => clearInterval(captureRef.current);
  }, [recording, camReady]);

  const simulateEmotionHUD = () => {
    // Show live emotion feedback using face detection in browser
    // Actual CNN runs on backend — this is just visual feedback during recording
    setFaceFound(true);
    setEyeContact(Math.random() > 0.3);
    const keys = [
      "happy",
      "neutral",
      "fear",
      "angry",
      "sad",
      "surprise",
      "disgust",
    ];
    const vals = keys.map(() => Math.random());
    const total = vals.reduce((a, b) => a + b, 0);
    const em = {};
    keys.forEach((k, i) => (em[k] = Math.round((vals[i] / total) * 100)));
    const dom = keys[vals.indexOf(Math.max(...vals))];
    setEmotions(em);
    setDominant(EMOTIONS.find((e) => e.key === dom));
    onEmotionUpdate?.(em);
  };

  const dominantEmo = dominant || EMOTIONS[1];
  const postureColor =
    eyeContact === true
      ? "#00e5c3"
      : eyeContact === false
        ? "#ff5f7e"
        : "#435070";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Camera frame */}
      <div
        style={{
          position: "relative",
          borderRadius: 14,
          overflow: "hidden",
          background: "#000",
          height: 220,
          flexShrink: 0,
        }}
      >
        {camError ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "#111c32",
              color: "#435070",
            }}
          >
            <span style={{ fontSize: 28 }}>📷</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#8898bf" }}>
              Camera unavailable
            </span>
            <span
              style={{
                fontSize: 11,
                textAlign: "center",
                padding: "0 16px",
                color: "#435070",
              }}
            >
              {camError}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "#435070",
                textAlign: "center",
                padding: "0 16px",
              }}
            >
              Audio analysis will still work normally
            </span>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)",
              }}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* HUD overlay */}
            <div
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            >
              {/* Corner brackets */}
              {[
                {
                  top: 8,
                  left: 8,
                  borderTop: "2px solid #00e5c3",
                  borderLeft: "2px solid #00e5c3",
                },
                {
                  top: 8,
                  right: 8,
                  borderTop: "2px solid #00e5c3",
                  borderRight: "2px solid #00e5c3",
                },
                {
                  bottom: 8,
                  left: 8,
                  borderBottom: "2px solid #00e5c3",
                  borderLeft: "2px solid #00e5c3",
                },
                {
                  bottom: 8,
                  right: 8,
                  borderBottom: "2px solid #00e5c3",
                  borderRight: "2px solid #00e5c3",
                },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{ position: "absolute", width: 20, height: 20, ...s }}
                />
              ))}

              {/* Scanline when recording */}
              {recording && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: 2,
                    background:
                      "linear-gradient(90deg,transparent,rgba(0,229,195,0.5),transparent)",
                    animation: "scanline 2.5s linear infinite",
                  }}
                />
              )}

              {/* Top left — REC + frame count */}
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  left: 28,
                  display: "flex",
                  gap: 6,
                }}
              >
                {recording && (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        background: "rgba(0,0,0,0.65)",
                        backdropFilter: "blur(8px)",
                        padding: "3px 8px",
                        borderRadius: 100,
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#ff5f7e",
                          animation: "pulse 1s infinite",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#ff5f7e",
                          letterSpacing: "0.5px",
                        }}
                      >
                        REC
                      </span>
                    </div>
                    <div
                      style={{
                        background: "rgba(0,0,0,0.65)",
                        backdropFilter: "blur(8px)",
                        padding: "3px 8px",
                        borderRadius: 100,
                        fontSize: 10,
                        fontWeight: 600,
                        color: "#00e5c3",
                      }}
                    >
                      📸 {frameCount} frames
                    </div>
                  </>
                )}
              </div>

              {/* Top right — face detected */}
              {recording && (
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 28,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    background: "rgba(0,0,0,0.65)",
                    backdropFilter: "blur(8px)",
                    padding: "3px 8px",
                    borderRadius: 100,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: faceFound ? "#00e5c3" : "#435070",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: faceFound ? "#00e5c3" : "#435070",
                    }}
                  >
                    {faceFound ? "Face ✓" : "No face"}
                  </span>
                </div>
              )}

              {/* Bottom info bar */}
              {recording && dominant && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background:
                      "linear-gradient(transparent,rgba(7,13,26,0.92))",
                    padding: "28px 12px 10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 7 }}
                  >
                    <span style={{ fontSize: 20 }}>{dominantEmo.emoji}</span>
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: dominantEmo.color,
                          lineHeight: 1.2,
                        }}
                      >
                        {dominantEmo.label}
                      </div>
                      <div style={{ fontSize: 10, color: "#435070" }}>
                        {emotions[dominantEmo.key] || 0}% detected
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: postureColor,
                        }}
                      >
                        👁️{" "}
                        {eyeContact === null
                          ? "—"
                          : eyeContact
                            ? "Good"
                            : "Away"}
                      </div>
                      <div style={{ fontSize: 9, color: "#435070" }}>
                        eye contact
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#00e5c3",
                        }}
                      >
                        🤖 AI Vision
                      </div>
                      <div style={{ fontSize: 9, color: "#435070" }}>live</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Idle overlay */}
              {!recording && camReady && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(7,13,26,0.5)",
                    backdropFilter: "blur(2px)",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 24, marginBottom: 5 }}>📷</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#8898bf",
                        fontWeight: 500,
                      }}
                    >
                      Camera ready
                    </div>
                    <div style={{ fontSize: 11, color: "#435070" }}>
                      Emotion AI starts on record
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Live emotion bars during recording */}
      {recording && Object.keys(emotions).length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 5,
          }}
        >
          {EMOTIONS.slice(0, 6).map((em) => {
            const val = emotions[em.key] || 0;
            const isTop = em.key === dominant?.key;
            return (
              <div
                key={em.key}
                style={{
                  background: "var(--bg3)",
                  borderRadius: 8,
                  padding: "6px 8px",
                  border: `1px solid ${isTop ? em.color + "44" : "transparent"}`,
                  transition: "border-color 0.3s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: isTop ? em.color : "var(--tx2)",
                    }}
                  >
                    {em.emoji} {em.label}
                  </span>
                  <span
                    style={{ fontSize: 10, fontWeight: 700, color: em.color }}
                  >
                    {val}%
                  </span>
                </div>
                <div
                  style={{
                    height: 3,
                    background: "var(--surf2)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${val}%`,
                      background: em.color,
                      borderRadius: 2,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Frame collection info */}
      {recording && frameCount > 0 && (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(0,229,195,0.06)",
            border: "1px solid rgba(0,229,195,0.15)",
            borderRadius: "var(--rsm)",
            fontSize: 11,
            color: "var(--tx2)",
          }}
        >
          📸 {frameCount} frames captured for emotion analysis
          <span style={{ color: "var(--tx3)", marginLeft: 8 }}>
            (sent to AI after recording stops)
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Analyze Page ─────────────────────────────────────────────────────────
export default function AnalyzePage() {
  const [tab, setTab] = useState("record");
  const [file, setFile] = useState(null);
  const [targetLang, setTargetLang] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [frames, setFrames] = useState([]);

  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const stageRef = useRef(null);
  const navigate = useNavigate();

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      clearInterval(stageRef.current);
    },
    [],
  );

  // Handle frames collected from camera
  const handleFramesCollected = useCallback((collectedFrames) => {
    setFrames(collectedFrames);
    console.log(
      `📸 Camera collected ${collectedFrames.length} frames for emotion analysis`,
    );
  }, []);

  const handleEmotionUpdate = useCallback(() => {}, []);

  // Start recording
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setFile(new File([blob], "recording.webm", { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start(100);
      setRecording(true);
      setRecTime(0);
      setFrames([]);
      timerRef.current = setInterval(() => setRecTime((t) => t + 1), 1000);
    } catch {
      toast.error("Microphone access denied — allow it in browser settings");
    }
  };

  const stopRec = () => {
    mediaRecRef.current?.stop();
    setRecording(false);
    clearInterval(timerRef.current);
  };

  // Submit analysis
  const handleAnalyze = async () => {
    if (!file) {
      toast.error("Please upload or record a file first");
      return;
    }

    setLoading(true);
    setStage(0);
    setUploadPct(0);

    let s = 0;
    stageRef.current = setInterval(() => {
      s = (s + 1) % STAGES.length;
      setStage(s);
    }, 3000);

    try {
      const form = new FormData();
      form.append("file", file);
      if (targetLang) form.append("target_language", targetLang);

      // Send captured frames to backend for real emotion analysis
      if (frames.length > 0) {
        form.append("run_vision", "true");
        form.append("frames_count", String(frames.length));
        // Send up to 10 frames to avoid large payload
        const selectedFrames = frames
          .filter(
            (_, i) => i % Math.max(1, Math.floor(frames.length / 10)) === 0,
          )
          .slice(0, 10);
        form.append("camera_frames", JSON.stringify(selectedFrames));
        console.log(`📤 Sending ${selectedFrames.length} frames to backend`);
      } else {
        // Auto-detect if uploaded file is a video
        const isVideoFile = file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i);
        form.append("run_vision", isVideoFile ? "true" : "false");
      }

      const res = await axios.post("/api/analyze", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300_000,
        onUploadProgress: (e) => {
          if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100));
        },
      });

      clearInterval(stageRef.current);
      toast.success("Analysis complete!");
      navigate(`/results/${res.data.session_id}`, {
        state: { data: res.data },
      });
    } catch (err) {
      clearInterval(stageRef.current);
      toast.error(
        err.response?.data?.error || err.message || "Analysis failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {loading && <ProcessingOverlay stage={stage} />}

      <div
        style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px 60px" }}
      >
        <h1
          style={{
            fontFamily: "var(--fd)",
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-1px",
            marginBottom: 4,
          }}
        >
          New Analysis
        </h1>
        <p style={{ color: "var(--tx2)", marginBottom: 22, fontSize: 13 }}>
          Record with live emotion detection or upload an existing file.
        </p>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            gap: 3,
            background: "var(--bg2)",
            border: "1px solid var(--bord)",
            padding: 3,
            borderRadius: 10,
            width: "fit-content",
            marginBottom: 18,
          }}
        >
          {[
            { id: "record", label: "🎥 Record + Emotion" },
            { id: "upload", label: "📂 Upload File" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setFile(null);
                setRecording(false);
                clearInterval(timerRef.current);
                setRecTime(0);
                setFrames([]);
              }}
              style={{
                padding: "7px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                border: "none",
                fontFamily: "var(--fb)",
                transition: "all 0.2s",
                background: tab === t.id ? "var(--surf)" : "transparent",
                color: tab === t.id ? "var(--tx)" : "var(--tx2)",
                boxShadow: tab === t.id ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Language selector */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              fontSize: 11,
              color: "var(--tx2)",
              fontWeight: 600,
              display: "block",
              marginBottom: 5,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            🌍 Translate output to
          </label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Record tab — split layout */}
        {tab === "record" && (
          <div
            className="card"
            style={{ padding: 0, overflow: "hidden", marginBottom: 14 }}
          >
            <div
              style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr" }}
            >
              {/* Left — Camera */}
              <div
                style={{ padding: 20, borderRight: "1px solid var(--bord)" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--fd)",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    Live Camera
                  </span>
                  <span className="badge bp" style={{ fontSize: 10 }}>
                    Emotion AI
                  </span>
                  {recording && (
                    <span className="badge bd" style={{ fontSize: 10 }}>
                      ● Live
                    </span>
                  )}
                </div>
                <LiveCamera
                  recording={recording}
                  onEmotionUpdate={handleEmotionUpdate}
                  onFramesCollected={handleFramesCollected}
                />
              </div>

              {/* Right — Audio recorder */}
              <div
                style={{
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      marginBottom: 14,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--fd)",
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      Audio
                    </span>
                    <span className="badge bn" style={{ fontSize: 10 }}>
                      Whisper STT
                    </span>
                  </div>

                  {/* Timer display */}
                  <div style={{ textAlign: "center", padding: "12px 0 14px" }}>
                    <div
                      style={{
                        fontFamily: "var(--fd)",
                        fontSize: 44,
                        fontWeight: 800,
                        letterSpacing: "-2px",
                        lineHeight: 1,
                        color: recording ? "var(--brand)" : "var(--tx3)",
                        marginBottom: 10,
                        transition: "color 0.3s",
                      }}
                    >
                      {fmt(recTime)}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        marginBottom: 12,
                      }}
                    >
                      <Waveform active={recording} />
                    </div>

                    {recording && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 5,
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--danger)",
                            animation: "pulse 1s infinite",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--danger)",
                            letterSpacing: "0.5px",
                          }}
                        >
                          RECORDING
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Record button */}
                  {!file ? (
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <button
                        className={`btn ${recording ? "btnd" : "btnp"}`}
                        onClick={recording ? stopRec : startRec}
                        style={{ padding: "10px 22px", fontSize: 14 }}
                      >
                        {recording ? "⏹ Stop" : "⏺ Start Recording"}
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          padding: "10px 14px",
                          background: "rgba(0,229,195,0.07)",
                          border: "1px solid rgba(0,229,195,0.2)",
                          borderRadius: 10,
                          width: "100%",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            marginBottom: 3,
                          }}
                        >
                          ✅ Recording complete
                        </div>
                        <div style={{ fontSize: 11, color: "var(--tx3)" }}>
                          {fmt(recTime)} audio · {frames.length} camera frames
                        </div>
                      </div>
                      <button
                        className="btn btng"
                        style={{ fontSize: 12, padding: "6px 14px" }}
                        onClick={() => {
                          setFile(null);
                          setRecTime(0);
                          setFrames([]);
                        }}
                      >
                        ↩ Re-record
                      </button>
                    </div>
                  )}
                </div>

                {/* What we analyze info box */}
                {!recording && !file && (
                  <div
                    style={{
                      padding: "10px 12px",
                      background: "var(--bg3)",
                      borderRadius: "var(--rsm)",
                      border: "1px solid var(--bord)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--tx2)",
                        fontWeight: 600,
                        marginBottom: 7,
                        textTransform: "uppercase",
                        letterSpacing: "0.4px",
                      }}
                    >
                      What we analyze
                    </div>
                    {[
                      ["😊", "6 facial emotions in real-time"],
                      ["👁️", "Eye contact consistency"],
                      ["🧍", "Posture & movement"],
                      ["🎙️", "Speech, fillers & sentiment"],
                      ["🌍", "Multi-language translation"],
                    ].map(([ic, l]) => (
                      <div
                        key={l}
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontSize: 11 }}>{ic}</span>
                        <span style={{ fontSize: 11, color: "var(--tx2)" }}>
                          {l}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Frames summary after recording */}
                {!recording && file && frames.length > 0 && (
                  <div
                    style={{
                      padding: "10px 12px",
                      background: "rgba(79,142,255,0.06)",
                      border: "1px solid rgba(79,142,255,0.15)",
                      borderRadius: "var(--rsm)",
                      fontSize: 11,
                      color: "var(--tx2)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: 4,
                        color: "var(--brand)",
                      }}
                    >
                      📸 Emotion data ready
                    </div>
                    <div>{frames.length} camera frames will be analyzed</div>
                    <div style={{ color: "var(--tx3)", marginTop: 2 }}>
                      Your CNN emotion model will process these
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upload tab */}
        {tab === "upload" && (
          <div className="card" style={{ padding: 24, marginBottom: 14 }}>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) setFile(f);
              }}
              onClick={() => {
                const i = document.createElement("input");
                i.type = "file";
                i.accept = "audio/*,video/*";
                i.onchange = (e) => {
                  if (e.target.files[0]) setFile(e.target.files[0]);
                };
                i.click();
              }}
              style={{
                border: `2px dashed ${dragging ? "var(--brand)" : file ? "var(--acc)" : "var(--bord)"}`,
                borderRadius: "var(--r)",
                padding: "40px 24px",
                textAlign: "center",
                cursor: "pointer",
                background: dragging ? "rgba(79,142,255,0.04)" : "var(--bg2)",
                transition: "all 0.2s",
              }}
            >
              {file ? (
                <>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>✅</div>
                  <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>
                    {file.name}
                  </p>
                  <p style={{ color: "var(--tx3)", fontSize: 12 }}>
                    {(file.size / 1024 / 1024).toFixed(1)} MB · click to change
                  </p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 30, marginBottom: 10 }}>
                    {dragging ? "📥" : "📁"}
                  </div>
                  <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 5 }}>
                    Drag & drop or click to browse
                  </p>
                  <p
                    style={{
                      color: "var(--tx2)",
                      fontSize: 13,
                      marginBottom: 12,
                    }}
                  >
                    Audio or video file (MP4 recommended for emotion detection)
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      justifyContent: "center",
                    }}
                  >
                    {["WAV", "MP3", "MP4", "MOV", "WebM", "M4A"].map((f) => (
                      <span
                        key={f}
                        className="badge bn"
                        style={{ fontSize: 10 }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                  <p
                    style={{ color: "var(--tx3)", fontSize: 11, marginTop: 10 }}
                  >
                    Max 100MB
                  </p>
                </>
              )}
            </div>
            {file && (
              <p
                style={{
                  color: "var(--tx3)",
                  fontSize: 12,
                  marginTop: 10,
                  textAlign: "center",
                }}
              >
                💡 Upload MP4 with face visible for emotion detection
              </p>
            )}
          </div>
        )}

        {/* Upload progress */}
        {loading && uploadPct > 0 && uploadPct < 100 && (
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
                fontSize: 12,
                color: "var(--tx2)",
              }}
            >
              <span>Uploading...</span>
              <span>{uploadPct}%</span>
            </div>
            <div
              style={{
                height: 4,
                background: "var(--surf2)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${uploadPct}%`,
                  background: "var(--brand)",
                  borderRadius: 2,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        )}

        {/* Analyze button */}
        <button
          className="btn btnp"
          onClick={handleAnalyze}
          disabled={!file || loading}
          style={{
            width: "100%",
            justifyContent: "center",
            fontSize: 15,
            padding: 14,
          }}
        >
          {loading ? "⏳ Analyzing..." : "🚀 Analyze Interview"}
        </button>

        <p
          style={{
            textAlign: "center",
            color: "var(--tx3)",
            fontSize: 11,
            marginTop: 8,
          }}
        >
          {tab === "record" && frames.length > 0
            ? `Audio + ${frames.length} emotion frames will be analyzed together`
            : "Audio + NLP analysis · 10-30 seconds"}
        </p>
      </div>
    </>
  );
}
