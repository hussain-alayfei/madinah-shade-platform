"use client";

import { Keyboard, MessageSquareText, Mic, MicOff, PhoneOff, Send, Volume2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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

const sectionRoutes: Record<string, string> = {
  trip: "/",
  report: "/report",
  community: "/community",
};

function currentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("الموقع غير متاح"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    });
  });
}

function friendlyStartError(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "اسمح باستخدام الميكروفون عشان نبدأ.";
  }
  return "ما قدرنا نشغل الصوت الآن. جرّب مرة ثانية.";
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
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const [active, setActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState("جاهز");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );

  function addMessage(role: TranscriptMessage["role"], text: string) {
    const clean = text.trim();
    if (!clean) return;
    nextId.current += 1;
    setMessages((current) => [...current, { id: nextId.current, role, text: clean }]);
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
    setActive(false);
    setConnecting(false);
    setMuted(false);
  }

  useEffect(() => cleanup, []);

  useEffect(() => {
    if (showTranscript) transcriptEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, showTranscript]);

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

      setStatus("أجهز لك المشوار…");
      try {
        const [position, geocodeResponse] = await Promise.all([
          currentPosition(),
          fetch(`/api/geocode?q=${encodeURIComponent(destinationName)}`),
        ]);
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
          fromLat: String(position.coords.latitude),
          fromLon: String(position.coords.longitude),
          toLat: String(destination.lat),
          toLon: String(destination.lon),
          fromLabel: "موقعي الحالي",
          toLabel: destination.label,
          time: "الآن",
          originMode: "current",
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
          message: "ما قدرت أوصل لموقعك. اطلب من المستخدم السماح بالموقع أو تحديد البداية يدويًا.",
        });
        setStatus("احتاج إذن الموقع");
      }
    }
  }

  function handleRealtimeEvent(raw: string) {
    try {
      const event = JSON.parse(raw) as RealtimeEvent;

      if (event.type === "input_audio_buffer.speech_started") {
        setStatus("أسمعك…");
        return;
      }

      if (event.type === "input_audio_buffer.speech_stopped") {
        setStatus("ثواني…");
        return;
      }

      if (event.type === "response.output_audio_transcript.delta" && event.delta) {
        partialAssistantRef.current += event.delta;
        setStatus("أرد عليك…");
        return;
      }

      if (event.type === "response.output_audio_transcript.done") {
        const text = event.transcript || partialAssistantRef.current;
        partialAssistantRef.current = "";
        if (text) addMessage("assistant", text);
        setStatus("جاهز");
        return;
      }

      if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
        addMessage("user", event.transcript);
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
      // Audio events can include payloads the interface does not need to display.
    }
  }

  async function startConversation() {
    if (active || connecting) return;
    setConnecting(true);
    setStatus("أشغل الميكروفون…");

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

      const response = await fetch("/api/voice-realtime", {
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
              تقدر تتكلم أو تستخدم الكتابة، وتقدر توقف المحادثة في أي وقت.
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
                <p>اضغط الزر وتكلم.</p>
              </div>
            ) : (
              <div className={`realtime-voice-live-state ${active ? "is-active" : ""}`} aria-hidden="true">
                <Mic size={32} />
              </div>
            )}

            <div className="realtime-voice-status" role="status" aria-live="polite">
              {status}
            </div>

            {latestAssistant && (
              <section className="realtime-voice-latest" aria-label="آخر رد" aria-live="polite">
                <p>{latestAssistant.text}</p>
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

            <div className="realtime-voice-secondary">
              <button
                type="button"
                onClick={() => setShowTranscript((value) => !value)}
                aria-expanded={showTranscript}
              >
                <MessageSquareText size={19} aria-hidden="true" />
                <span>{showTranscript ? "إخفاء النص" : "عرض النص"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowKeyboard((value) => !value)}
                aria-expanded={showKeyboard}
              >
                <Keyboard size={19} aria-hidden="true" />
                <span>{showKeyboard ? "إخفاء الكتابة" : "اكتب"}</span>
              </button>
            </div>

            {showTranscript && (
              <section className="realtime-voice-transcript" aria-label="نص المحادثة">
                {messages.length ? (
                  messages.map((message) => (
                    <div key={message.id} className="realtime-message">
                      <strong>{message.role === "assistant" ? "المساعد" : "أنت"}</strong>
                      <p>{message.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="realtime-voice-empty">ما فيه محادثة للحين.</p>
                )}
                <div ref={transcriptEndRef} />
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
