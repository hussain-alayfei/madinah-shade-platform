"use client";

import {
  Accessibility,
  CircleStop,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { VoiceAssistantAction, VoiceAssistantResponse } from "@/lib/voice-assistant";

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
};

type RecognitionResultLike = {
  0?: { transcript?: string };
};

type RecognitionEventLike = {
  results: ArrayLike<RecognitionResultLike>;
};

type RecognitionErrorLike = {
  error?: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type GeocodeResult = {
  label: string;
  lat: number;
  lon: number;
};

const AUTO_SPEAK_KEY = "madinah-shade-voice-auto-speak-v1";
const LARGE_TEXT_KEY = "madinah-shade-voice-large-text-v1";

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    text: "هلا، أنا مساعد ظل المدينة. قل لي وين تبي تروح، أو قل: افتح البلاغ، المجتمع، أو لوحة المدينة.",
  },
];

function recognitionConstructor() {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

function recognitionErrorMessage(code?: string) {
  if (code === "not-allowed" || code === "service-not-allowed") {
    return "ما قدرت أستخدم الميكروفون. فعّل إذن الميكروفون من إعدادات المتصفح، أو اكتب طلبك تحت.";
  }
  if (code === "audio-capture") return "ما لقيت ميكروفون متاح. تقدر تكتب طلبك بدل الصوت.";
  if (code === "no-speech") return "ما سمعت كلام واضح. اضغط الميكروفون وجرب مرة ثانية.";
  if (code === "network") return "التعرف على الصوت تعطل بسبب الاتصال. اكتب طلبك أو جرّب مرة ثانية.";
  return "تعذر سماع الطلب الآن. تقدر تكتبه بدل الصوت.";
}

function currentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("الموقع غير متاح على هذا الجهاز."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    });
  });
}

export function VoiceAssistant() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const messageIdRef = useRef(2);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("جاهز");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [largeText, setLargeText] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSpeechSupported(Boolean(recognitionConstructor()));
    try {
      const savedSpeak = window.localStorage.getItem(AUTO_SPEAK_KEY);
      if (savedSpeak !== null) setAutoSpeak(savedSpeak === "true");
      const savedLarge = window.localStorage.getItem(LARGE_TEXT_KEY);
      if (savedLarge !== null) setLargeText(savedLarge === "true");
    } catch {
      // Preferences remain available for this session if local storage is unavailable.
    }

    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function addMessage(role: ChatMessage["role"], text: string) {
    messageIdRef.current += 1;
    setMessages((current) => [...current, { id: messageIdRef.current, role, text }]);
  }

  function persistPreference(key: string, value: boolean) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // Preference still works for the current session.
    }
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setStatus("جاهز");
  }

  function speak(text: string) {
    if (!autoSpeak || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    utterance.rate = 0.92;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const saudiVoice = voices.find((voice) => voice.lang.toLowerCase() === "ar-sa");
    const arabicVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith("ar"));
    utterance.voice = saudiVoice || arabicVoice || null;
    utterance.onstart = () => {
      setSpeaking(true);
      setStatus("أقرأ لك الرد");
    };
    utterance.onend = () => {
      setSpeaking(false);
      setStatus("جاهز");
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setStatus("الرد ظاهر بالنص");
    };
    window.speechSynthesis.speak(utterance);
  }

  function openAssistant() {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }

  function closeAssistant() {
    recognitionRef.current?.abort();
    setListening(false);
    stopSpeaking();
    dialogRef.current?.close();
  }

  async function performAction(action?: VoiceAssistantAction) {
    if (!action) return;

    if (action.type === "navigate") {
      setStatus(`بفتح ${action.label}`);
      window.setTimeout(() => router.push(action.href), 650);
      return;
    }

    setStatus("أحدد موقعك وأبحث عن الوجهة");
    try {
      const [position, geocodeResponse] = await Promise.all([
        currentPosition(),
        fetch(`/api/geocode?q=${encodeURIComponent(action.destination)}`),
      ]);
      const geocodePayload = (await geocodeResponse.json().catch(() => null)) as
        | { results?: GeocodeResult[]; error?: string }
        | null;
      const destination = geocodePayload?.results?.[0];

      if (!geocodeResponse.ok || !destination) {
        throw new Error(geocodePayload?.error || "ما لقيت الوجهة المطلوبة داخل نطاق الخدمة الحالي.");
      }

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
      if (action.needs.length) params.set("needs", action.needs.join(","));

      setStatus("تم، بفتح لك المسارات المناسبة");
      window.setTimeout(() => router.push(`/plan?${params.toString()}`), 500);
    } catch (error) {
      const message =
        error instanceof GeolocationPositionError ||
        (typeof error === "object" && error !== null && "code" in error && "message" in error)
          ? "ما قدرت أوصل لموقعك. فعّل إذن الموقع، أو افتح مشواري وحدد نقطة البداية يدويًا."
          : error instanceof Error
            ? error.message
            : "تعذر تجهيز المشوار الآن.";
      addMessage("assistant", message);
      setStatus("احتاج منك خطوة بسيطة");
      speak(message);
    }
  }

  async function sendMessage(value: string) {
    const message = value.trim();
    if (!message || sending) return;

    addMessage("user", message);
    setDraft("");
    setSending(true);
    setStatus("أجهز لك الرد");

    try {
      const response = await fetch("/api/voice-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (VoiceAssistantResponse & { error?: string })
        | null;

      if (!response.ok || !payload?.reply) {
        throw new Error(payload?.error || "تعذر تجهيز الرد الآن.");
      }

      addMessage("assistant", payload.reply);
      setStatus("تم");
      speak(payload.reply);
      await performAction(payload.action);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "تعذر تجهيز الرد الآن.";
      addMessage("assistant", errorMessage);
      setStatus("تعذر الرد");
      speak(errorMessage);
    } finally {
      setSending(false);
    }
  }

  function startListening() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setSpeechSupported(false);
      setStatus("استخدم الكتابة");
      return;
    }

    stopSpeaking();
    const recognition = new Recognition();
    recognition.lang = "ar-SA";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setListening(true);
      setStatus("أسمعك… تكلم الحين");
    };
    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult?.[0]?.transcript?.trim() || "";
      if (transcript) {
        setDraft(transcript);
        void sendMessage(transcript);
      }
    };
    recognition.onerror = (event) => {
      const message = recognitionErrorMessage(event.error);
      setStatus(message);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      setStatus((current) => (current.startsWith("أسمعك") ? "جاهز" : current));
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setListening(false);
      setStatus("تعذر تشغيل الميكروفون. استخدم الكتابة أو جرب مرة ثانية.");
    }
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  return (
    <>
      <button className="voice-assistant-launcher" type="button" onClick={openAssistant} aria-label="فتح المساعد الصوتي">
        <span className="voice-assistant-launcher__icon" aria-hidden="true"><Mic size={22} /></span>
        <span>اسأل بصوتك</span>
      </button>

      <dialog
        ref={dialogRef}
        className={`voice-assistant-dialog ${largeText ? "is-large-text" : ""}`}
        aria-labelledby="voice-assistant-title"
        aria-describedby="voice-assistant-description"
        onClose={() => {
          recognitionRef.current?.abort();
          setListening(false);
          stopSpeaking();
        }}
      >
        <div className="voice-assistant-shell">
          <header className="voice-assistant-header">
            <div>
              <span className="voice-assistant-eyebrow"><Accessibility size={16} /> وصول أسهل</span>
              <h2 id="voice-assistant-title">مساعد ظل المدينة</h2>
              <p id="voice-assistant-description">تكلم بطريقتك. نحاول نفهم اللهجة السعودية ونرد عليك بصوت عربي واضح.</p>
            </div>
            <button className="voice-assistant-close" type="button" onClick={closeAssistant} aria-label="إغلاق المساعد الصوتي">
              <X size={22} />
            </button>
          </header>

          <div className="voice-assistant-status" role="status" aria-live="polite">
            <span className={listening ? "is-listening" : ""} aria-hidden="true" />
            {status}
          </div>

          <div className="voice-assistant-messages" aria-label="المحادثة" aria-live="polite" aria-relevant="additions text">
            {messages.map((message) => (
              <div key={message.id} className={`voice-message voice-message--${message.role}`}>
                <span>{message.role === "assistant" ? "المساعد" : "أنت"}</span>
                <p>{message.text}</p>
              </div>
            ))}
          </div>

          <div className="voice-assistant-quick" aria-label="اقتراحات سريعة">
            <button type="button" onClick={() => void sendMessage("ودني للمسجد النبوي")}>ودني للمسجد النبوي</button>
            <button type="button" onClick={() => void sendMessage("افتح البلاغ")}>افتح البلاغ</button>
            <button type="button" onClick={() => void sendMessage("لوحة المدينة")}>لوحة المدينة</button>
          </div>

          <section className="voice-assistant-controls" aria-label="التحكم الصوتي">
            <button
              type="button"
              className={`voice-mic-button ${listening ? "is-listening" : ""}`}
              onClick={startListening}
              disabled={!speechSupported || sending}
              aria-pressed={listening}
              aria-label={listening ? "إيقاف الاستماع" : "ابدأ التحدث"}
            >
              {listening ? <MicOff size={30} /> : <Mic size={30} />}
              <span>{listening ? "وقف الاستماع" : speechSupported ? "تكلم الحين" : "الصوت غير متاح"}</span>
            </button>

            {!speechSupported && (
              <p className="voice-assistant-support-note">التعرف الصوتي غير متاح في هذا المتصفح. الكتابة تحت تشتغل بشكل كامل.</p>
            )}

            <form className="voice-assistant-form" onSubmit={submitForm}>
              <label htmlFor="voice-assistant-input">أو اكتب طلبك</label>
              <div>
                <input
                  id="voice-assistant-input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="مثال: أبي أروح مسجد قباء"
                  maxLength={500}
                  autoComplete="off"
                />
                <button type="submit" disabled={sending || !draft.trim()} aria-label="إرسال الطلب">
                  <Send size={19} />
                </button>
              </div>
            </form>
          </section>

          <footer className="voice-assistant-preferences">
            <label>
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(event) => {
                  setAutoSpeak(event.target.checked);
                  persistPreference(AUTO_SPEAK_KEY, event.target.checked);
                  if (!event.target.checked) stopSpeaking();
                }}
              />
              <span>{autoSpeak ? <Volume2 size={17} /> : <VolumeX size={17} />} قراءة الردود بصوت</span>
            </label>

            <label>
              <input
                type="checkbox"
                checked={largeText}
                onChange={(event) => {
                  setLargeText(event.target.checked);
                  persistPreference(LARGE_TEXT_KEY, event.target.checked);
                }}
              />
              <span>نص أكبر وأوضح</span>
            </label>

            {speaking && (
              <button type="button" className="voice-stop-button" onClick={stopSpeaking}>
                <CircleStop size={17} /> وقف الصوت
              </button>
            )}
          </footer>

          <p className="voice-assistant-footnote">
            نستخدم صوت سعودي إذا كان متوفر على جهازك، وإلا نختار أقرب صوت عربي. الذكاء الموسع راح يتفعل لاحقًا عند ربط الـAPI.
          </p>
        </div>
      </dialog>
    </>
  );
}
