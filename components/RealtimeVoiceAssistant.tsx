"use client";

import {
  ArrowRight,
  History as HistoryIcon,
  House,
  Keyboard,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Volume2,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  fetchLiveRoutes,
  formatDistance,
  formatDuration,
  parseLiveTrip,
} from "@/lib/maps";
import {
  buildVoiceTripContext,
  clearVoiceTripContext,
  readVoiceTripContext,
  writeVoiceTripContext,
  type VoiceTripContext,
} from "@/lib/voice-context";

type TranscriptMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  createdAt: number;
};

type VoiceSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: TranscriptMessage[];
};

type RealtimeEvent = {
  type?: string;
  delta?: string;
  transcript?: string;
  arguments?: string;
  call_id?: string;
  name?: string;
};

type GeocodeResult = {
  label: string;
  lat: number;
  lon: number;
};

type PlanTripArgs = {
  destination?: string;
  senior?: boolean;
  wheelchair?: boolean;
  moreRest?: boolean;
  avoidCrowds?: boolean;
};

type VoiceProfile = "male" | "female";
type VoicePhase = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "muted" | "error";
type VoiceView = "chat" | "sessions" | "session";

const VOICE_PREF_KEY = "madinah-shade-realtime-voice-v1";
const VOICE_SESSIONS_KEY = "madinah-shade-voice-sessions-v2";
const LEGACY_HISTORY_KEY = "madinah-shade-realtime-history-v1";
const MAX_SESSIONS = 12;
const MAX_SESSION_MESSAGES = 50;
const DEMO_ORIGIN = {
  lat: 24.4497,
  lon: 39.6108,
  label: "موقعي في المدينة",
};

const sectionRoutes: Record<string, string> = {
  trip: "/",
  report: "/report",
  community: "/community",
};

const phaseCopy: Record<VoicePhase, { title: string; detail: string }> = {
  idle: { title: "جاهز", detail: "ابدأ وقت ما تبي" },
  connecting: { title: "لحظة", detail: "أجهز الصوت" },
  listening: { title: "دورك", detail: "أسمعك" },
  thinking: { title: "لحظة", detail: "أفهم كلامك" },
  speaking: { title: "دوري", detail: "أرد عليك" },
  muted: { title: "متوقف", detail: "الميكروفون مكتوم" },
  error: { title: "تعذر الصوت", detail: "جرّب مرة ثانية" },
};

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function friendlyStartError(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "اسمح باستخدام الميكروفون عشان نبدأ.";
  }
  return "ما قدرنا نشغل الصوت الآن. جرّب مرة ثانية.";
}

function titleFromMessages(messages: TranscriptMessage[]) {
  const firstUser = messages.find((message) => message.role === "user")?.text.trim();
  const source = firstUser || messages[0]?.text.trim() || "محادثة صوتية";
  return source.length > 42 ? `${source.slice(0, 42)}…` : source;
}

function isTranscriptMessage(value: unknown): value is TranscriptMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<TranscriptMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "assistant" || message.role === "user") &&
    typeof message.text === "string" &&
    typeof message.createdAt === "number"
  );
}

function readSavedSessions(): VoiceSession[] {
  try {
    const raw = window.localStorage.getItem(VOICE_SESSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is VoiceSession => {
            if (!item || typeof item !== "object") return false;
            const session = item as Partial<VoiceSession>;
            return (
              typeof session.id === "string" &&
              typeof session.title === "string" &&
              typeof session.createdAt === "number" &&
              typeof session.updatedAt === "number" &&
              Array.isArray(session.messages) &&
              session.messages.every(isTranscriptMessage)
            );
          })
          .slice(0, MAX_SESSIONS);
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_HISTORY_KEY);
    if (!legacyRaw) return [];
    const legacy = JSON.parse(legacyRaw) as Array<{ id?: number; role?: string; text?: string }>;
    if (!Array.isArray(legacy)) return [];
    const now = Date.now();
    const messages: TranscriptMessage[] = legacy
      .filter((item) => (item.role === "assistant" || item.role === "user") && typeof item.text === "string" && item.text.trim())
      .slice(-MAX_SESSION_MESSAGES)
      .map((item, index) => ({
        id: `legacy-${index}-${now}`,
        role: item.role as TranscriptMessage["role"],
        text: item.text!.trim(),
        createdAt: now + index,
      }));
    if (!messages.length) return [];
    return [{
      id: `legacy-session-${now}`,
      title: titleFromMessages(messages),
      createdAt: now,
      updatedAt: now,
      messages,
    }];
  } catch {
    return [];
  }
}

function formatSessionTime(timestamp: number) {
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(timestamp);
  } catch {
    return "محادثة سابقة";
  }
}

function sessionContext(messages: TranscriptMessage[]) {
  return messages
    .slice(-16)
    .map((message) => `${message.role === "user" ? "المستخدم" : "المساعد"}: ${message.text}`)
    .join("\n");
}

export function RealtimeVoiceAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const partialAssistantRef = useRef("");
  const partialUserRef = useRef("");
  const messagesRef = useRef<TranscriptMessage[]>([]);
  const currentSessionIdRef = useRef<string | null>(null);
  const phaseRef = useRef<VoicePhase>("idle");

  const [active, setActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [statusOverride, setStatusOverride] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [partialUser, setPartialUser] = useState("");
  const [partialAssistant, setPartialAssistant] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [sessions, setSessions] = useState<VoiceSession[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>("female");
  const [view, setView] = useState<VoiceView>("chat");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  function changePhase(next: VoicePhase, override = "") {
    phaseRef.current = next;
    setPhase(next);
    setStatusOverride(override);
  }

  function setCurrentSession(id: string | null) {
    currentSessionIdRef.current = id;
    setCurrentSessionId(id);
  }

  function syncSession(nextMessages: TranscriptMessage[]) {
    const sessionId = currentSessionIdRef.current;
    if (!sessionId) return;
    const now = Date.now();
    setSessions((current) => current.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            title: titleFromMessages(nextMessages),
            updatedAt: now,
            messages: nextMessages.slice(-MAX_SESSION_MESSAGES),
          }
        : session,
    ));
  }

  function addMessage(role: TranscriptMessage["role"], text: string) {
    const clean = text.trim();
    if (!clean) return;
    const message: TranscriptMessage = {
      id: makeId("message"),
      role,
      text: clean,
      createdAt: Date.now(),
    };
    setMessages((current) => {
      const next = [...current, message].slice(-MAX_SESSION_MESSAGES);
      messagesRef.current = next;
      syncSession(next);
      return next;
    });
  }

  function teardownConnection() {
    const channel = channelRef.current;
    channelRef.current = null;
    if (channel && channel.readyState !== "closed") channel.close();

    const peer = peerRef.current;
    peerRef.current = null;
    peer?.close();

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }

    partialAssistantRef.current = "";
    partialUserRef.current = "";
    setPartialAssistant("");
    setPartialUser("");
    setActive(false);
    setConnecting(false);
    setMuted(false);
  }

  function createNewSession() {
    const now = Date.now();
    const session: VoiceSession = {
      id: makeId("session"),
      title: "محادثة جديدة",
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    setSessions((current) => [session, ...current].slice(0, MAX_SESSIONS));
    setCurrentSession(session.id);
    messagesRef.current = [];
    setMessages([]);
    setSelectedHistoryId(null);
    setView("chat");
    changePhase("idle");
    return session.id;
  }

  function ensureSession() {
    return currentSessionIdRef.current || createNewSession();
  }

  function finalizeCurrentSession() {
    const sessionId = currentSessionIdRef.current;
    if (sessionId && messagesRef.current.length === 0) {
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    }
    setCurrentSession(null);
    messagesRef.current = [];
    setMessages([]);
  }

  useEffect(() => {
    const savedSessions = readSavedSessions();
    setSessions(savedSessions);
    try {
      const savedVoice = window.localStorage.getItem(VOICE_PREF_KEY);
      if (savedVoice === "male" || savedVoice === "female") setVoiceProfile(savedVoice);
    } catch {
      // Keep defaults when storage is blocked.
    }
    setHistoryLoaded(true);
    return () => teardownConnection();
  }, []);

  useEffect(() => {
    if (!historyLoaded) return;
    try {
      const stored = sessions
        .filter((session) => session.messages.length > 0)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_SESSIONS);
      window.localStorage.setItem(VOICE_SESSIONS_KEY, JSON.stringify(stored));
    } catch {
      // Sessions remain available for the current visit.
    }
  }, [historyLoaded, sessions]);

  function chooseVoice(profile: VoiceProfile) {
    setVoiceProfile(profile);
    try {
      window.localStorage.setItem(VOICE_PREF_KEY, profile);
    } catch {
      // The choice still applies to the current session.
    }
  }

  function sendToolResult(callId: string, output: Record<string, unknown>) {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") return;
    channel.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(output),
      },
    }));
    channel.send(JSON.stringify({ type: "response.create" }));
    changePhase("thinking");
  }

  async function resolveTripContext(): Promise<VoiceTripContext | null> {
    const cached = readVoiceTripContext();
    if (cached && Date.now() - cached.updatedAt < 6 * 60 * 60 * 1000) return cached;

    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const afterWait = readVoiceTripContext();
    if (afterWait && Date.now() - afterWait.updatedAt < 6 * 60 * 60 * 1000) return afterWait;

    const searchParams = new URLSearchParams(window.location.search);
    const trip = parseLiveTrip(searchParams);
    if (!trip) return null;

    try {
      const routes = await fetchLiveRoutes(trip);
      const selectedId = searchParams.get("route") || routes[0]?.id;
      const context = buildVoiceTripContext(trip, routes, selectedId);
      writeVoiceTripContext(context);
      return context;
    } catch {
      return null;
    }
  }

  async function handleToolCall(event: RealtimeEvent) {
    if (!event.call_id || !event.name) return;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(event.arguments || "{}") as Record<string, unknown>;
    } catch {
      sendToolResult(event.call_id, { ok: false, message: "الطلب غير واضح." });
      return;
    }

    if (event.name === "get_trip_info") {
      changePhase("thinking");
      const context = await resolveTripContext();
      if (!context) {
        sendToolResult(event.call_id, {
          ok: false,
          message: "ما فيه رحلة جاهزة أقدر أقرأ تفاصيلها الحين. افتح المسارات أولًا.",
        });
        return;
      }
      sendToolResult(event.call_id, {
        ok: true,
        origin: context.originLabel,
        destination: context.destinationLabel,
        selected: {
          name: context.selectedRoute.name,
          duration_minutes: context.selectedRoute.durationMinutes,
          duration: formatDuration(context.selectedRoute.durationMinutes),
          distance_meters: context.selectedRoute.distanceMeters,
          distance: formatDistance(context.selectedRoute.distanceMeters),
          comfort_score: context.selectedRoute.comfortScore,
          accessibility_priority: context.selectedRoute.wheelchairAware,
          reason: context.selectedRoute.profileReason,
        },
        alternatives: context.alternatives.map((route) => ({
          name: route.name,
          duration_minutes: route.durationMinutes,
          duration: formatDuration(route.durationMinutes),
          distance_meters: route.distanceMeters,
          distance: formatDistance(route.distanceMeters),
          comfort_score: route.comfortScore,
        })),
      });
      return;
    }

    if (event.name === "navigate_back") {
      if (window.history.length > 1) router.back();
      else router.push("/");
      sendToolResult(event.call_id, { ok: true, message: "رجعتك للصفحة اللي قبل." });
      return;
    }

    if (event.name === "open_section") {
      const section = typeof args.section === "string" ? args.section : "";
      const href = sectionRoutes[section];
      if (!href) {
        sendToolResult(event.call_id, { ok: false, message: "القسم غير متاح." });
        return;
      }
      router.push(href);
      sendToolResult(event.call_id, { ok: true, message: "تم فتح القسم المطلوب." });
      return;
    }

    if (event.name === "plan_trip") {
      const plan = args as PlanTripArgs;
      const destinationName = typeof plan.destination === "string" ? plan.destination.trim() : "";
      if (!destinationName) {
        sendToolResult(event.call_id, { ok: false, message: "أحتاج اسم الوجهة." });
        return;
      }

      changePhase("thinking", "أجهز لك المشوار");
      try {
        const geocodeResponse = await fetch(`/api/geocode?q=${encodeURIComponent(destinationName)}`);
        const geocodePayload = (await geocodeResponse.json().catch(() => null)) as { results?: GeocodeResult[] } | null;
        const destination = geocodePayload?.results?.[0];
        if (!geocodeResponse.ok || !destination) {
          sendToolResult(event.call_id, { ok: false, message: "ما لقيت الوجهة داخل نطاق الخدمة الحالي." });
          return;
        }

        const needs: string[] = ["shade"];
        if (plan.senior) needs.push("senior", "rest");
        if (plan.wheelchair) needs.push("wheelchair");
        if (plan.moreRest && !needs.includes("rest")) needs.push("rest");
        if (plan.avoidCrowds) needs.push("lowCrowd");

        clearVoiceTripContext();
        const params = new URLSearchParams({
          fromLat: String(DEMO_ORIGIN.lat),
          fromLon: String(DEMO_ORIGIN.lon),
          toLat: String(destination.lat),
          toLon: String(destination.lon),
          fromLabel: DEMO_ORIGIN.label,
          toLabel: destination.label,
          time: "الآن",
          originMode: "selected",
        });
        if (needs.length) params.set("needs", needs.join(","));
        router.push(`/plan?${params.toString()}`);
        sendToolResult(event.call_id, { ok: true, message: `تم فتح المسارات إلى ${destination.label}.` });
      } catch {
        sendToolResult(event.call_id, { ok: false, message: "ما قدرت أجهز المشوار الآن. جرّب مرة ثانية." });
      }
    }
  }

  function handleRealtimeEvent(raw: string) {
    try {
      const event = JSON.parse(raw) as RealtimeEvent;

      if (event.type === "input_audio_buffer.speech_started") {
        partialUserRef.current = "";
        setPartialUser("");
        changePhase("listening");
        return;
      }

      if (event.type === "input_audio_buffer.speech_stopped") {
        changePhase("thinking");
        return;
      }

      if (event.type === "conversation.item.input_audio_transcription.delta" && event.delta) {
        partialUserRef.current += event.delta;
        setPartialUser(partialUserRef.current);
        return;
      }

      if (event.type === "conversation.item.input_audio_transcription.completed") {
        const text = event.transcript || partialUserRef.current;
        partialUserRef.current = "";
        setPartialUser("");
        if (text) addMessage("user", text);
        return;
      }

      if (event.type === "conversation.item.input_audio_transcription.failed") {
        partialUserRef.current = "";
        setPartialUser("");
        changePhase("listening", "ما وضح الكلام، جرب مرة ثانية");
        return;
      }

      if (event.type === "output_audio_buffer.started") {
        changePhase("speaking");
        return;
      }

      if (event.type === "output_audio_buffer.stopped" || event.type === "output_audio_buffer.cleared") {
        changePhase(muted ? "muted" : "listening");
        return;
      }

      if (event.type === "response.output_audio_transcript.delta" && event.delta) {
        partialAssistantRef.current += event.delta;
        setPartialAssistant(partialAssistantRef.current);
        if (phaseRef.current !== "speaking") changePhase("speaking");
        return;
      }

      if (event.type === "response.output_audio_transcript.done") {
        const text = event.transcript || partialAssistantRef.current;
        partialAssistantRef.current = "";
        setPartialAssistant("");
        if (text) addMessage("assistant", text);
        return;
      }

      if (event.type === "response.function_call_arguments.done") {
        changePhase("thinking");
        void handleToolCall(event);
        return;
      }

      if (event.type === "response.done" && phaseRef.current === "thinking") {
        changePhase(muted ? "muted" : "listening");
        return;
      }

      if (event.type === "error") changePhase("error", "صار خلل بسيط. جرب مرة ثانية");
    } catch {
      // Ignore realtime payloads that are not needed by the interface.
    }
  }

  function seedSessionContext(channel: RTCDataChannel) {
    if (!messagesRef.current.length) return;
    const context = sessionContext(messagesRef.current);
    if (!context) return;
    channel.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [{
          type: "input_text",
          text: `المستخدم اختار يكمل محادثة سابقة. هذا سياقها الأخير:\n${context}\nكمل من نفس السياق بدون إعادة الترحيب أو تلخيصه إلا إذا طلب المستخدم.`,
        }],
      },
    }));
  }

  async function startConversation() {
    if (active || connecting) return;
    ensureSession();
    setConnecting(true);
    changePhase("connecting");
    setPartialUser("");
    setPartialAssistant("");
    partialUserRef.current = "";
    partialAssistantRef.current = "";

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("microphone-unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));

      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("aria-hidden", "true");
      audioRef.current = audio;
      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void audio.play().catch(() => undefined);
      };

      const channel = peer.createDataChannel("voice-events");
      channelRef.current = channel;
      channel.addEventListener("open", () => {
        seedSessionContext(channel);
        setActive(true);
        setConnecting(false);
        changePhase("listening");
      });
      channel.addEventListener("message", (event) => handleRealtimeEvent(String(event.data)));
      channel.addEventListener("close", () => {
        if (peerRef.current) {
          teardownConnection();
          changePhase("idle", "انتهت المحادثة");
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (!offer.sdp) throw new Error("connection-failed");
      const response = await fetch(`/api/voice-realtime?voice=${voiceProfile}`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!response.ok) throw new Error("service-unavailable");
      const answerSdp = await response.text();
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (error) {
      teardownConnection();
      changePhase("error", friendlyStartError(error));
    }
  }

  function stopConversation() {
    teardownConnection();
    changePhase("idle", "انتهت المحادثة");
  }

  function toggleMute() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const nextMuted = !track.enabled;
    setMuted(nextMuted);
    changePhase(nextMuted ? "muted" : "listening");
  }

  function sendText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    const channel = channelRef.current;
    if (!text || !active || channel?.readyState !== "open") return;
    addMessage("user", text);
    setDraft("");
    channel.send(JSON.stringify({
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
    }));
    channel.send(JSON.stringify({ type: "response.create" }));
    changePhase("thinking");
  }

  function openAssistant() {
    ensureSession();
    setView("chat");
    setSelectedHistoryId(null);
    dialogRef.current?.showModal();
  }

  function handleDialogClosed() {
    teardownConnection();
    finalizeCurrentSession();
    setView("chat");
    setSelectedHistoryId(null);
    changePhase("idle");
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function goHome() {
    teardownConnection();
    finalizeCurrentSession();
    dialogRef.current?.close();
    router.push("/");
  }

  function continueSession(session: VoiceSession) {
    teardownConnection();
    setCurrentSession(session.id);
    messagesRef.current = session.messages;
    setMessages(session.messages);
    setSelectedHistoryId(null);
    setView("chat");
    changePhase("idle", "جاهز نكمل");
  }

  function showSessions() {
    if (active || connecting) stopConversation();
    setSelectedHistoryId(null);
    setView("sessions");
  }

  function startFreshFromHistory() {
    if (currentSessionIdRef.current) finalizeCurrentSession();
    createNewSession();
    setView("chat");
  }

  if (pathname.startsWith("/city")) return null;

  const savedSessions = sessions
    .filter((session) => session.messages.length > 0 && session.id !== currentSessionId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const selectedHistory = sessions.find((session) => session.id === selectedHistoryId) || null;
  const hasTranscript = messages.length > 0 || Boolean(partialUser) || Boolean(partialAssistant);
  const copy = phaseCopy[phase];
  const phaseDetail = statusOverride || copy.detail;

  return (
    <>
      <button className="realtime-voice-launcher" type="button" onClick={openAssistant} aria-label="فتح المساعد الصوتي">
        <Mic size={22} aria-hidden="true" />
        <strong>مساعد صوتي</strong>
      </button>

      <dialog
        ref={dialogRef}
        className="realtime-voice-dialog realtime-voice-dialog--v2"
        aria-labelledby="realtime-voice-title"
        onClose={handleDialogClosed}
      >
        <div className="realtime-voice-shell realtime-voice-shell--v2">
          <header className="realtime-voice-header realtime-voice-header--v2">
            <h2 id="realtime-voice-title">{view === "chat" ? "المساعد الصوتي" : "المحادثات"}</h2>
            <div className="realtime-voice-header-actions">
              <button type="button" className="realtime-voice-home" onClick={goHome}>
                <House size={18} aria-hidden="true" />
                <span>الرئيسية</span>
              </button>
              <button type="button" className="realtime-voice-close" onClick={closeDialog} aria-label="إغلاق">
                <X size={22} aria-hidden="true" />
              </button>
            </div>
          </header>

          <main className="realtime-voice-main realtime-voice-main--v2">
            {view === "chat" && (
              <>
                <section className={`realtime-turn-stage is-${phase}`} aria-live="polite" aria-atomic="true">
                  <div className="realtime-wave" aria-hidden="true">
                    {Array.from({ length: 9 }).map((_, index) => <span key={index} />)}
                  </div>
                  <div className="realtime-turn-copy">
                    <strong>{copy.title}</strong>
                    <span>{phaseDetail}</span>
                  </div>
                </section>

                {!active && !connecting && (
                  <div className="realtime-voice-choice realtime-voice-choice--v2" role="radiogroup" aria-label="اختيار الصوت">
                    <button type="button" role="radio" aria-checked={voiceProfile === "male"} className={voiceProfile === "male" ? "is-selected" : ""} onClick={() => chooseVoice("male")}>
                      <strong>صوت رجالي</strong>
                    </button>
                    <button type="button" role="radio" aria-checked={voiceProfile === "female"} className={voiceProfile === "female" ? "is-selected" : ""} onClick={() => chooseVoice("female")}>
                      <strong>صوت نسائي</strong>
                    </button>
                  </div>
                )}

                {hasTranscript && (
                  <section className="realtime-session-transcript" aria-label="المحادثة الحالية" aria-live="polite">
                    {messages.map((message) => (
                      <div key={message.id} className={`realtime-message realtime-message--${message.role}`}>
                        <strong>{message.role === "assistant" ? "المساعد" : "أنت"}</strong>
                        <p>{message.text}</p>
                      </div>
                    ))}
                    {partialUser && (
                      <div className="realtime-message realtime-message--user is-live">
                        <strong>أنت</strong>
                        <p>{partialUser}<span className="realtime-live-caret" aria-hidden="true" /></p>
                      </div>
                    )}
                    {partialAssistant && (
                      <div className="realtime-message realtime-message--assistant is-live">
                        <strong>المساعد</strong>
                        <p>{partialAssistant}<span className="realtime-live-caret" aria-hidden="true" /></p>
                      </div>
                    )}
                  </section>
                )}

                {!active ? (
                  <button type="button" className="realtime-start" onClick={startConversation} disabled={connecting}>
                    <Mic size={26} aria-hidden="true" />
                    <span>{connecting ? "لحظة…" : messages.length ? "كمل الكلام" : "ابدأ الكلام"}</span>
                  </button>
                ) : (
                  <div className="realtime-live-controls" aria-label="التحكم بالمحادثة">
                    <button type="button" onClick={toggleMute} aria-pressed={muted}>
                      {muted ? <MicOff size={21} aria-hidden="true" /> : <Mic size={21} aria-hidden="true" />}
                      <span>{muted ? "افتح الميكروفون" : "اكتم"}</span>
                    </button>
                    <button type="button" className="is-danger" onClick={stopConversation}>
                      <PhoneOff size={21} aria-hidden="true" />
                      <span>إنهاء</span>
                    </button>
                  </div>
                )}

                <div className="realtime-voice-secondary realtime-voice-secondary--v2">
                  <button type="button" onClick={showSessions}>
                    <HistoryIcon size={18} aria-hidden="true" />
                    <span>المحادثات</span>
                    {savedSessions.length > 0 && <small>{savedSessions.length}</small>}
                  </button>
                  <button type="button" onClick={() => setShowKeyboard((value) => !value)} aria-expanded={showKeyboard}>
                    <Keyboard size={18} aria-hidden="true" />
                    <span>{showKeyboard ? "إخفاء الكتابة" : "اكتب"}</span>
                  </button>
                </div>

                {showKeyboard && (
                  <form className="realtime-voice-form" onSubmit={sendText}>
                    <label htmlFor="realtime-voice-text" className="realtime-sr-only">اكتب طلبك</label>
                    <input id="realtime-voice-text" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={active ? "اكتب طلبك" : "ابدأ المحادثة أولًا"} disabled={!active} maxLength={500} autoComplete="off" />
                    <button type="submit" disabled={!active || !draft.trim()} aria-label="إرسال"><Send size={19} aria-hidden="true" /></button>
                  </form>
                )}
              </>
            )}

            {view === "sessions" && (
              <section className="realtime-sessions-view" aria-label="المحادثات السابقة">
                <div className="realtime-history-topline">
                  <button type="button" onClick={() => setView("chat")}><ArrowRight size={18} aria-hidden="true" /> رجوع</button>
                  <button type="button" className="is-primary" onClick={startFreshFromHistory}>محادثة جديدة</button>
                </div>
                {savedSessions.length === 0 ? (
                  <div className="realtime-sessions-empty"><Volume2 size={28} aria-hidden="true" /><p>ما عندك محادثات سابقة.</p></div>
                ) : (
                  <div className="realtime-sessions-list">
                    {savedSessions.map((session) => (
                      <button key={session.id} type="button" className="realtime-session-card" onClick={() => { setSelectedHistoryId(session.id); setView("session"); }}>
                        <span><strong>{session.title}</strong><small>{formatSessionTime(session.updatedAt)}</small></span>
                        <ArrowRight size={18} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {view === "session" && selectedHistory && (
              <section className="realtime-session-detail" aria-label="تفاصيل المحادثة">
                <div className="realtime-history-topline">
                  <button type="button" onClick={() => { setSelectedHistoryId(null); setView("sessions"); }}><ArrowRight size={18} aria-hidden="true" /> المحادثات</button>
                </div>
                <header><h3>{selectedHistory.title}</h3><small>{formatSessionTime(selectedHistory.updatedAt)}</small></header>
                <div className="realtime-session-detail-messages">
                  {selectedHistory.messages.map((message) => (
                    <div key={message.id} className={`realtime-message realtime-message--${message.role}`}>
                      <strong>{message.role === "assistant" ? "المساعد" : "أنت"}</strong>
                      <p>{message.text}</p>
                    </div>
                  ))}
                </div>
                <button type="button" className="realtime-continue-session" onClick={() => continueSession(selectedHistory)}>
                  <Mic size={20} aria-hidden="true" /> كمل هالمحادثة
                </button>
              </section>
            )}
          </main>
        </div>
      </dialog>
    </>
  );
}
