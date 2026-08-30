"use client";

import { Accessibility, Mic, MicOff, PhoneOff, Send, Volume2, X } from "lucide-react";
import { usePathname } from "next/navigation";
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
  item?: { role?: string; content?: Array<{ transcript?: string; text?: string }> };
};

export function RealtimeVoiceAssistant() {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextId = useRef(2);
  const partialAssistantRef = useRef("");

  const [active, setActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState("جاهز للمحادثة");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<TranscriptMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: "حياك. اضغط «ابدأ المحادثة» وتكلم بطريقتك، وأنا برد عليك بصوت عربي واضح وبلهجة سعودية بسيطة.",
    },
  ]);

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

  function handleRealtimeEvent(raw: string) {
    try {
      const event = JSON.parse(raw) as RealtimeEvent;
      if (event.type === "input_audio_buffer.speech_started") {
        setStatus("أسمعك…");
        return;
      }
      if (event.type === "input_audio_buffer.speech_stopped") {
        setStatus("ثواني وأرد عليك");
        return;
      }
      if (event.type === "response.output_audio_transcript.delta" && event.delta) {
        partialAssistantRef.current += event.delta;
        setStatus("المساعد يرد…");
        return;
      }
      if (event.type === "response.output_audio_transcript.done") {
        const text = event.transcript || partialAssistantRef.current;
        partialAssistantRef.current = "";
        addMessage("assistant", text || "تم الرد صوتيًا.");
        setStatus("جاهز، تكلم متى ما تبي");
        return;
      }
      if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
        addMessage("user", event.transcript);
      }
      if (event.type === "error") {
        setStatus("صار تعذر بسيط في الصوت. حاول مرة ثانية.");
      }
    } catch {
      // Ignore non-JSON events; audio itself travels over the peer connection.
    }
  }

  async function startConversation() {
    if (active || connecting) return;
    setConnecting(true);
    setStatus("أشغل الميكروفون…");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("المتصفح ما يدعم الميكروفون للمحادثة الحية.");
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

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.addEventListener("open", () => {
        setActive(true);
        setConnecting(false);
        setStatus("جاهز، تكلم الحين");
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
      if (!offer.sdp) throw new Error("تعذر تجهيز الاتصال الصوتي.");

      const response = await fetch("/api/voice-realtime", {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "تعذر بدء المحادثة الصوتية الحية.");
      }

      const answerSdp = await response.text();
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (error) {
      cleanup();
      setStatus(error instanceof Error ? error.message : "تعذر بدء المحادثة الصوتية الحية.");
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
    setStatus(track.enabled ? "الميكروفون مفتوح" : "الميكروفون مكتوم");
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
    setStatus("ثواني وأرد عليك");
  }

  if (pathname.startsWith("/city")) return null;

  return (
    <>
      <button
        className="realtime-voice-launcher"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label="فتح المساعد الصوتي المباشر"
      >
        <span aria-hidden="true"><Mic size={24} /></span>
        <strong>تحدث معي</strong>
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
            <div>
              <span className="realtime-voice-eyebrow"><Accessibility size={16} /> وصول أسهل</span>
              <h2 id="realtime-voice-title">مساعد ظل المدينة الصوتي</h2>
              <p id="realtime-voice-description">محادثة مباشرة لكبار السن والمكفوفين، بصوت واضح وردود قصيرة.</p>
            </div>
            <button
              type="button"
              className="realtime-voice-close"
              onClick={() => dialogRef.current?.close()}
              aria-label="إغلاق المساعد الصوتي"
            >
              <X size={23} />
            </button>
          </header>

          <div className="realtime-voice-status" role="status" aria-live="polite">
            <span className={active ? "is-live" : ""} aria-hidden="true" />
            {status}
          </div>

          <div className="realtime-voice-transcript" aria-label="نص المحادثة" aria-live="polite" aria-relevant="additions text">
            {messages.map((message) => (
              <div key={message.id} className={`realtime-message realtime-message--${message.role}`}>
                <strong>{message.role === "assistant" ? "المساعد" : "أنت"}</strong>
                <p>{message.text}</p>
              </div>
            ))}
          </div>

          <section className="realtime-voice-primary" aria-label="التحكم بالمحادثة">
            {!active ? (
              <button type="button" className="realtime-start" onClick={startConversation} disabled={connecting}>
                <Mic size={30} />
                <span>{connecting ? "جاري الاتصال…" : "ابدأ المحادثة"}</span>
              </button>
            ) : (
              <div className="realtime-live-controls">
                <button type="button" onClick={toggleMute} aria-pressed={muted}>
                  {muted ? <MicOff size={23} /> : <Mic size={23} />}
                  <span>{muted ? "افتح الميكروفون" : "اكتم الميكروفون"}</span>
                </button>
                <button type="button" className="is-danger" onClick={stopConversation}>
                  <PhoneOff size={23} />
                  <span>إنهاء</span>
                </button>
              </div>
            )}
          </section>

          <form className="realtime-voice-form" onSubmit={sendText}>
            <label htmlFor="realtime-voice-text">ما تقدر تتكلم؟ اكتب هنا</label>
            <div>
              <input
                id="realtime-voice-text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="مثال: أبي طريق أريح للمسجد النبوي"
                disabled={!active}
                maxLength={500}
              />
              <button type="submit" disabled={!active || !draft.trim()} aria-label="إرسال الرسالة">
                <Send size={20} />
              </button>
            </div>
          </form>

          <footer className="realtime-voice-footnote">
            <Volume2 size={17} aria-hidden="true" />
            <span>الصوت لا يبدأ من نفسه؛ يبدأ فقط بعد ضغطك على زر المحادثة. تقدر تكتم الميكروفون أو تنهي الاتصال بأي وقت.</span>
          </footer>
        </div>
      </dialog>
    </>
  );
}
