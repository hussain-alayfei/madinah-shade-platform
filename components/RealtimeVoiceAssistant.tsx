"use client";

import { ChevronDown, History as HistoryIcon, Keyboard, Mic, MicOff, PhoneOff, Send, Volume2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

type TranscriptMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
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

const VOICE_PREF_KEY = "madinah-shade-realtime-voice-v1";
const VOICE_HISTORY_KEY = "madinah-shade-realtime-history-v1";
const MAX_SAVED_MESSAGES = 60;
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

function friendlyStartError(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "اسمح باستخدام الميكروفون عشان نبدأ.";
  }
  return "ما قدرنا نشغل الصوت الآن. جرّب مرة ثانية.";
}

function readSavedHistory(): TranscriptMessage[] {
  try {
    const raw = window.localStorage.getItem(VOICE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is TranscriptMessage => {
        if (!item || typeof item !== "object") return false;
        const message = item as Partial<TranscriptMessage>;
        return (
          typeof message.id === "number" &&
          (message.role === "assistant" || message.role === "user") &&
          typeof message.text === "string" &&
          Boolean(message.text.trim())
        );
      })
      .slice(-MAX_SAVED_MESSAGES);
  } catch {
    return [];
  }
}

export function RealtimeVoiceAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextId = useRef(0);
  const partialAssistantRef = useRef("");
  const partialUserRef = useRef("");
  const messagesRef = useRef<TranscriptMessage[]>([]);

  const [active, setActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState("جاهز");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [partialUser, setPartialUser] = useState("");
  const [partialAssistant, setPartialAssistant] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [currentTurnStart, setCurrentTurnStart] = useState(0);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>("female");

  function addMessage(role: TranscriptMessage["role"], text: string) {
    const clean = text.trim();
    if (!clean) return;
    nextId.current += 1;
    const message = { id: nextId.current, role, text: clean };
    setMessages((current) => {
      const next = [...current, message];
      messagesRef.current = next;
      return next;
    });
  }

  function cleanup() {
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
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

  useEffect(() => {
    const savedMessages = readSavedHistory();
    messagesRef.current = savedMessages;
    setMessages(savedMessages);
    setCurrentTurnStart(savedMessages.length);
    nextId.current = savedMessages.reduce((max, message) => Math.max(max, message.id), 0);

    try {
      const savedVoice = window.localStorage.getItem(VOICE_PREF_KEY);
      if (savedVoice === "male" || savedVoice === "female") setVoiceProfile(savedVoice);
    } catch {
      // Keep defaults when local storage is blocked.
    }

    setHistoryLoaded(true);
    return () => cleanup();
  }, []);

  useEffect(() => {
    if (!historyLoaded) return;
    messagesRef.current = messages;
    try {
      window.localStorage.setItem(VOICE_HISTORY_KEY, JSON.stringify(messages.slice(-MAX_SAVED_MESSAGES)));
    } catch {
      // Conversation remains available for the current visit.
    }
  }, [historyLoaded, messages]);

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

    channel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify(output),
        },
      }),
    );
    channel.send(JSON.stringify({ type: "response.create" }));
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

    if (event.name === "navigate_back") {
      if (window.history.length > 1) router.back();
      else router.push("/");
      sendToolResult(event.call_id, { ok: true, message: "رجعتك للصفحة اللي قبل." });
      setStatus("تم");
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
      setStatus("تم");
      return;
    }

    if (event.name === "plan_trip") {
      const plan = args as PlanTripArgs;
      const destinationName = typeof plan.destination === "string" ? plan.destination.trim() : "";
      if (!destinationName) {
        sendToolResult(event.call_id, { ok: false, message: "أحتاج اسم الوجهة." });
        return;
      }

      setStatus("أجهز لك المشوار…");
      try {
        const geocodeResponse = await fetch(`/api/geocode?q=${encodeURIComponent(destinationName)}`);
        const geocodePayload = (await geocodeResponse.json().catch(() => null)) as
          | { results?: GeocodeResult[] }
          | null;
        const destination = geocodePayload?.results?.[0];

        if (!geocodeResponse.ok || !destination) {
          sendToolResult(event.call_id, { ok: false, message: "ما لقيت الوجهة داخل نطاق الخدمة الحالي." });
          setStatus("جاهز");
          return;
        }

        const needs: string[] = ["shade"];
        if (plan.senior) needs.push("senior", "rest");
        if (plan.wheelchair) needs.push("wheelchair");
        if (plan.moreRest && !needs.includes("rest")) needs.push("rest");
        if (plan.avoidCrowds) needs.push("lowCrowd");

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
        sendToolResult(event.call_id, {
          ok: true,
          message: `تم تجهيز المسارات إلى ${destination.label}.`,
        });
        setStatus("تم");
      } catch {
        sendToolResult(event.call_id, {
          ok: false,
          message: "ما قدرت أجهز المشوار الآن. جرّب مرة ثانية.",
        });
        setStatus("جاهز");
      }
    }
  }

  function handleRealtimeEvent(raw: string) {
    try {
      const event = JSON.parse(raw) as RealtimeEvent;

      if (event.type === "input_audio_buffer.speech_started") {
        setCurrentTurnStart(messagesRef.current.length);
        setShowHistory(false);
        partialUserRef.current = "";
        setPartialUser("");
        setStatus("أسمعك…");
        return;
      }

      if (event.type === "input_audio_buffer.speech_stopped") {
        setStatus("ثواني…");
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
        setStatus("ما وضح الكلام، جرّب مرة ثانية.");
        return;
      }

      if (event.type === "response.output_audio_transcript.delta" && event.delta) {
        partialAssistantRef.current += event.delta;
        setPartialAssistant(partialAssistantRef.current);
        setStatus("أرد عليك…");
        return;
      }

      if (event.type === "response.output_audio_transcript.done") {
        const text = event.transcript || partialAssistantRef.current;
        partialAssistantRef.current = "";
        setPartialAssistant("");
        if (text) addMessage("assistant", text);
        setStatus("جاهز");
        return;
      }

      if (event.type === "response.function_call_arguments.done") {
        void handleToolCall(event);
        return;
      }

      if (event.type === "error") {
        setStatus("صار خلل بسيط. جرّب مرة ثانية.");
      }
    } catch {
      // Ignore realtime payloads that are not needed by the interface.
    }
  }

  async function startConversation() {
    if (active || connecting) return;
    setConnecting(true);
    setStatus("أشغل الميكروفون…");
    setCurrentTurnStart(messagesRef.current.length);
    setShowHistory(false);
    setPartialUser("");
    setPartialAssistant("");
    partialUserRef.current = "";
    partialAssistantRef.current = "";

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("microphone-unavailable");
      }

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
        setActive(true);
        setConnecting(false);
        setStatus("تكلم الحين");
      });
      channel.addEventListener("message", (event) => handleRealtimeEvent(String(event.data)));
      channel.addEventListener("close", () => {
        if (peerRef.current) {
          cleanup();
          setStatus("انتهت المحادثة");
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
      cleanup();
      setStatus(friendlyStartError(error));
    }
  }

  function stopConversation() {
    cleanup();
    setStatus("انتهت المحادثة");
  }

  function toggleMute() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
    setStatus(track.enabled ? "تكلم الحين" : "الميكروفون مكتوم");
  }

  function sendText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    const channel = channelRef.current;
    if (!text || !active || channel?.readyState !== "open") return;

    setCurrentTurnStart(messagesRef.current.length);
    setShowHistory(false);
    addMessage("user", text);
    setDraft("");
    channel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      }),
    );
    channel.send(JSON.stringify({ type: "response.create" }));
    setStatus("ثواني…");
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  if (pathname.startsWith("/city")) return null;

  const currentMessages = messages.slice(currentTurnStart);
  const historyMessages = messages.slice(0, currentTurnStart);
  const hasCurrentTranscript = currentMessages.length > 0 || Boolean(partialUser) || Boolean(partialAssistant);

  return (
    <>
      <button
        className="realtime-voice-launcher"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label="فتح المساعد الصوتي"
      >
        <Mic size={22} aria-hidden="true" />
        <strong>مساعد صوتي</strong>
      </button>

      <dialog
        ref={dialogRef}
        className="realtime-voice-dialog"
        aria-labelledby="realtime-voice-title"
        aria-describedby="realtime-voice-description"
        onClose={stopConversation}
      >
        <div className="realtime-voice-shell">
          <header className="realtime-voice-header">
            <h2 id="realtime-voice-title">المساعد الصوتي</h2>
            <p id="realtime-voice-description" className="realtime-sr-only">
              تقدر تتكلم وتشوف كلامك مكتوب، أو تستخدم الكتابة، وتقدر توقف المحادثة في أي وقت.
            </p>
            <button type="button" className="realtime-voice-close" onClick={closeDialog} aria-label="إغلاق">
              <X size={24} aria-hidden="true" />
            </button>
          </header>

          <main className="realtime-voice-main">
            {!active && !connecting ? (
              <div className="realtime-voice-welcome">
                <div className="realtime-voice-mark" aria-hidden="true"><Volume2 size={32} /></div>
                <h3>كيف أقدر أساعدك؟</h3>
                <p>اختر الصوت، وبعدها تكلم.</p>

                <div className="realtime-voice-choice" role="radiogroup" aria-label="اختيار الصوت">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={voiceProfile === "male"}
                    className={voiceProfile === "male" ? "is-selected" : ""}
                    onClick={() => chooseVoice("male")}
                  >
                    <strong>صوت رجالي</strong>
                    <span>هادئ وواضح</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={voiceProfile === "female"}
                    className={voiceProfile === "female" ? "is-selected" : ""}
                    onClick={() => chooseVoice("female")}
                  >
                    <strong>صوت نسائي</strong>
                    <span>هادئ وواضح</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className={`realtime-voice-live-state ${active ? "is-active" : ""}`} aria-hidden="true">
                <Mic size={32} />
              </div>
            )}

            <div className="realtime-voice-status" role="status" aria-live="polite">
              {status}
            </div>

            {(active || hasCurrentTranscript) && (
              <section
                className="realtime-voice-transcript realtime-voice-transcript--live realtime-voice-current-turn"
                aria-label="المحادثة الحالية"
              >
                {!hasCurrentTranscript && active && (
                  <p className="realtime-voice-empty">كلامك بيظهر هنا.</p>
                )}

                {currentMessages.map((message) => (
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
              <button
                type="button"
                className="realtime-start"
                onClick={startConversation}
                disabled={connecting}
                autoFocus
              >
                <Mic size={28} aria-hidden="true" />
                <span>{connecting ? "لحظة…" : "ابدأ الكلام"}</span>
              </button>
            ) : (
              <div className="realtime-live-controls" aria-label="التحكم بالمحادثة">
                <button type="button" onClick={toggleMute} aria-pressed={muted}>
                  {muted ? <MicOff size={22} aria-hidden="true" /> : <Mic size={22} aria-hidden="true" />}
                  <span>{muted ? "افتح الميكروفون" : "اكتم"}</span>
                </button>
                <button type="button" className="is-danger" onClick={stopConversation}>
                  <PhoneOff size={22} aria-hidden="true" />
                  <span>إنهاء</span>
                </button>
              </div>
            )}

            <div className={`realtime-voice-secondary ${historyMessages.length ? "" : "realtime-voice-secondary--single"}`}>
              {historyMessages.length > 0 && (
                <button
                  type="button"
                  className="realtime-history-toggle"
                  onClick={() => setShowHistory((value) => !value)}
                  aria-expanded={showHistory}
                >
                  <HistoryIcon size={19} aria-hidden="true" />
                  <span>السجل السابق</span>
                  <ChevronDown className={showHistory ? "is-open" : ""} size={17} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowKeyboard((value) => !value)}
                aria-expanded={showKeyboard}
              >
                <Keyboard size={19} aria-hidden="true" />
                <span>{showKeyboard ? "إخفاء الكتابة" : "اكتب بدل الصوت"}</span>
              </button>
            </div>

            {showHistory && historyMessages.length > 0 && (
              <section className="realtime-voice-history" aria-label="سجل المحادثة السابق">
                {historyMessages.map((message) => (
                  <div key={message.id} className={`realtime-message realtime-message--${message.role}`}>
                    <strong>{message.role === "assistant" ? "المساعد" : "أنت"}</strong>
                    <p>{message.text}</p>
                  </div>
                ))}
              </section>
            )}

            {showKeyboard && (
              <form className="realtime-voice-form" onSubmit={sendText}>
                <label htmlFor="realtime-voice-text" className="realtime-sr-only">اكتب طلبك</label>
                <input
                  id="realtime-voice-text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={active ? "اكتب طلبك" : "ابدأ المحادثة أولًا"}
                  disabled={!active}
                  maxLength={500}
                  autoComplete="off"
                />
                <button type="submit" disabled={!active || !draft.trim()} aria-label="إرسال">
                  <Send size={20} aria-hidden="true" />
                </button>
              </form>
            )}
          </main>
        </div>
      </dialog>
    </>
  );
}
