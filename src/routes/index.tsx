import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  AlertTriangle,
  Lightbulb,
  Brain,
  Target,
  Heart,
  ShieldAlert,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Live Sales Coach — Real-time Meeting Insights" },
      {
        name: "description",
        content:
          "Click record and get live AI insights every 5 seconds: objections, intent, sentiment, what to say next, risks and pattern-based hindsight.",
      },
    ],
  }),
});

type Insights = {
  objection: string;
  intent: string;
  sentiment: "Positive" | "Neutral" | "Negative" | string;
  suggestion: string;
  warning: string;
  hindsight: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec: SpeechRecognitionLike = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  return rec;
}

const ANALYSIS_INTERVAL_MS = 5000;

function Index() {
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [tick, setTick] = useState(5);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const lastAnalyzedRef = useRef("");
  const intervalRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* noop */
      }
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  const runAnalysis = async () => {
    const convo = transcriptRef.current.trim();
    if (!convo || convo === lastAnalyzedRef.current) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-meeting", {
        body: { conversation: convo.slice(-7500) },
      });
      if (error) {
        const msg = (error as any)?.context?.error || error.message || "Failed";
        toast.error(msg);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.insights) {
        setInsights(data.insights as Insights);
        lastAnalyzedRef.current = convo;
      }
    } catch (e) {
      console.error(e);
    } finally {
      inFlightRef.current = false;
      setAnalyzing(false);
    }
  };

  const startRecording = () => {
    const rec = getRecognition();
    if (!rec) {
      toast.error("Voice input is not supported here. Try Chrome.");
      return;
    }
    rec.onresult = (e: any) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else interimChunk += r[0].transcript;
      }
      if (finalChunk) {
        const next =
          (transcriptRef.current ? transcriptRef.current + " " : "") +
          finalChunk.trim();
        transcriptRef.current = next;
        setTranscript(next);
      }
      setInterim(interimChunk);
    };
    rec.onerror = (e: any) => {
      console.error("speech error", e);
      if (e?.error && e.error !== "no-speech" && e.error !== "aborted") {
        toast.error("Mic: " + e.error);
      }
    };
    rec.onend = () => {
      // auto-restart while user is still recording
      if (recording) {
        try {
          rec.start();
        } catch {
          /* noop */
        }
      }
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      console.error(e);
    }

    setRecording(true);
    setTick(5);

    intervalRef.current = window.setInterval(() => {
      runAnalysis();
      setTick(5);
    }, ANALYSIS_INTERVAL_MS);

    tickRef.current = window.setInterval(() => {
      setTick((t) => (t > 1 ? t - 1 : 5));
    }, 1000);
  };

  const stopRecording = () => {
    setRecording(false);
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    // final pass
    runAnalysis();
  };

  const toggle = () => (recording ? stopRecording() : startRecording());

  const reset = () => {
    setTranscript("");
    setInterim("");
    transcriptRef.current = "";
    lastAnalyzedRef.current = "";
    setInsights(null);
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Floating gradient blobs */}
      <div
        aria-hidden
        className="blob pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: "var(--gradient-sunset)" }}
      />
      <div
        aria-hidden
        className="blob pointer-events-none absolute top-40 -right-32 h-[28rem] w-[28rem] rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--gradient-ocean)", animationDelay: "-4s" }}
      />
      <div
        aria-hidden
        className="blob pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "linear-gradient(135deg, var(--neon-lime), var(--neon-cyan))",
          animationDelay: "-8s",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <header className="mb-10 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-[var(--neon-cyan)]" />
            <span className="text-muted-foreground">
              Live AI · refreshes every 5 seconds
            </span>
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-6xl">
            <span className="shimmer-text">Live Sales Coach</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Hit record. Speak naturally. Get instant insights, objections, what
            to say next, risks and pattern-based hindsight — every 5 seconds.
          </p>
        </header>

        {/* Recorder */}
        <section className="mb-10 flex flex-col items-center">
          <div className="relative">
            {recording && <span className="pulse-ring absolute inset-0" />}
            <button
              onClick={toggle}
              type="button"
              className="relative grid h-32 w-32 place-items-center rounded-full text-white shadow-2xl transition-transform hover:scale-105 active:scale-95 sm:h-40 sm:w-40"
              style={{
                background: recording
                  ? "linear-gradient(135deg, var(--neon-coral), var(--neon-pink))"
                  : "var(--gradient-aurora)",
                boxShadow: recording
                  ? "var(--shadow-glow-pink)"
                  : "var(--shadow-glow-cyan)",
              }}
              aria-label={recording ? "Stop recording" : "Start recording"}
            >
              {recording ? (
                <MicOff className="h-12 w-12 sm:h-14 sm:w-14" />
              ) : (
                <Mic className="h-12 w-12 sm:h-14 sm:w-14" />
              )}
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3 text-sm">
            {recording ? (
              <>
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--neon-coral)]/15 px-3 py-1 font-medium text-[var(--neon-coral)]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--neon-coral)]" />
                  Recording
                </span>
                <span className="text-muted-foreground">
                  Next insight in <b className="text-foreground">{tick}s</b>
                </span>
                {analyzing && (
                  <span className="inline-flex items-center gap-1 text-[var(--neon-cyan)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">
                {transcript ? "Paused — tap to resume" : "Tap to start recording"}
              </span>
            )}
          </div>

          {transcript && (
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset session
            </Button>
          )}
        </section>

        {/* Live transcript */}
        <section className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Live Transcript
            </h2>
            <span className="text-xs text-muted-foreground">
              {transcript.length} chars
            </span>
          </div>
          <div className="min-h-[110px] rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed backdrop-blur-md">
            {transcript || interim ? (
              <p>
                <span>{transcript}</span>{" "}
                <span className="text-muted-foreground italic">{interim}</span>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Your speech will appear here as you talk…
              </p>
            )}
          </div>
        </section>

        {/* Insights grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InsightCard
            icon={<Lightbulb className="h-5 w-5" />}
            label="Say Next"
            value={insights?.suggestion}
            tone="lime"
            featured
            empty="A ready-to-speak line will appear here"
          />
          <InsightCard
            icon={<ShieldAlert className="h-5 w-5" />}
            label="Objection"
            value={insights?.objection}
            tone="pink"
            empty="No objections detected yet"
          />
          <SentimentCard sentiment={insights?.sentiment} />
          <InsightCard
            icon={<Target className="h-5 w-5" />}
            label="Intent"
            value={insights?.intent}
            tone="cyan"
            empty="Listening for buyer intent…"
          />
          <InsightCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Warning"
            value={insights?.warning}
            tone="amber"
            empty="No risk signals yet"
          />
          <InsightCard
            icon={<Brain className="h-5 w-5" />}
            label="Hindsight"
            value={insights?.hindsight}
            tone="violet"
            empty="A sales pattern insight will appear here"
          />
        </section>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          Powered by Lovable AI · Voice via your browser
        </footer>
      </div>
    </main>
  );
}

type Tone = "pink" | "cyan" | "lime" | "amber" | "violet" | "coral";

const toneStyles: Record<
  Tone,
  { border: string; glow: string; chip: string; iconBg: string }
> = {
  pink: {
    border: "border-[color:var(--neon-pink)]/30",
    glow: "var(--shadow-glow-pink)",
    chip: "bg-[var(--neon-pink)]/15 text-[var(--neon-pink)]",
    iconBg: "linear-gradient(135deg, var(--neon-pink), var(--neon-coral))",
  },
  cyan: {
    border: "border-[color:var(--neon-cyan)]/30",
    glow: "var(--shadow-glow-cyan)",
    chip: "bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)]",
    iconBg: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))",
  },
  lime: {
    border: "border-[color:var(--neon-lime)]/40",
    glow: "var(--shadow-glow-lime)",
    chip: "bg-[var(--neon-lime)]/15 text-[var(--neon-lime)]",
    iconBg: "linear-gradient(135deg, var(--neon-lime), var(--neon-cyan))",
  },
  amber: {
    border: "border-[color:var(--neon-amber)]/40",
    glow: "0 0 40px -8px oklch(0.83 0.18 75 / 0.5)",
    chip: "bg-[var(--neon-amber)]/15 text-[var(--neon-amber)]",
    iconBg: "linear-gradient(135deg, var(--neon-amber), var(--neon-coral))",
  },
  violet: {
    border: "border-[color:var(--neon-violet)]/40",
    glow: "0 0 40px -8px oklch(0.65 0.27 295 / 0.55)",
    chip: "bg-[var(--neon-violet)]/15 text-[var(--neon-violet)]",
    iconBg: "linear-gradient(135deg, var(--neon-violet), var(--neon-pink))",
  },
  coral: {
    border: "border-[color:var(--neon-coral)]/40",
    glow: "0 0 40px -8px oklch(0.72 0.22 25 / 0.5)",
    chip: "bg-[var(--neon-coral)]/15 text-[var(--neon-coral)]",
    iconBg: "linear-gradient(135deg, var(--neon-coral), var(--neon-amber))",
  },
};

function InsightCard({
  icon,
  label,
  value,
  tone,
  featured,
  empty,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  tone: Tone;
  featured?: boolean;
  empty: string;
}) {
  const s = toneStyles[tone];
  const has = !!value && value.trim().length > 0;
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${s.border} bg-white/5 p-5 backdrop-blur-md transition-all hover:-translate-y-0.5 ${
        featured ? "sm:col-span-2 lg:col-span-1" : ""
      }`}
      style={featured ? { boxShadow: s.glow } : undefined}
    >
      <div className="mb-3 flex items-center gap-3">
        <div
          className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-lg"
          style={{ background: s.iconBg }}
        >
          {icon}
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.chip}`}
        >
          {label}
        </span>
      </div>
      <p
        className={`text-sm leading-relaxed ${
          has ? "text-foreground" : "text-muted-foreground italic"
        } ${featured && has ? "text-base font-medium" : ""}`}
      >
        {has ? value : empty}
      </p>
    </div>
  );
}

function SentimentCard({ sentiment }: { sentiment?: string }) {
  const v = (sentiment || "").toLowerCase();
  const tone: Tone = v.includes("pos")
    ? "lime"
    : v.includes("neg")
      ? "pink"
      : "cyan";
  const s = toneStyles[tone];
  const label = sentiment || "Listening…";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${s.border} bg-white/5 p-5 backdrop-blur-md`}
    >
      <div className="mb-3 flex items-center gap-3">
        <div
          className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-lg"
          style={{ background: s.iconBg }}
        >
          <Heart className="h-5 w-5" />
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.chip}`}
        >
          Sentiment
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{label}</p>
    </div>
  );
}
