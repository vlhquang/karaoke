"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LessonWord = {
  text: string;
  ipa: string;
  meaning: string;
};

const ALPHABET_ITEMS = [
  { letter: "A", ipa: "/eɪ/" },
  { letter: "B", ipa: "/biː/" },
  { letter: "C", ipa: "/siː/" },
  { letter: "D", ipa: "/diː/" },
  { letter: "E", ipa: "/iː/" },
  { letter: "F", ipa: "/ef/" },
  { letter: "G", ipa: "/dʒiː/" },
  { letter: "H", ipa: "/eɪtʃ/" },
  { letter: "I", ipa: "/aɪ/" },
  { letter: "J", ipa: "/dʒeɪ/" },
  { letter: "K", ipa: "/keɪ/" },
  { letter: "L", ipa: "/el/" },
  { letter: "M", ipa: "/em/" },
  { letter: "N", ipa: "/en/" },
  { letter: "O", ipa: "/oʊ/" },
  { letter: "P", ipa: "/piː/" },
  { letter: "Q", ipa: "/kjuː/" },
  { letter: "R", ipa: "/ɑːr/" },
  { letter: "S", ipa: "/es/" },
  { letter: "T", ipa: "/tiː/" },
  { letter: "U", ipa: "/juː/" },
  { letter: "V", ipa: "/viː/" },
  { letter: "W", ipa: "/ˈdʌb.əl.juː/" },
  { letter: "X", ipa: "/eks/" },
  { letter: "Y", ipa: "/waɪ/" },
  { letter: "Z", ipa: "/ziː/" }
] as const;

const BASIC_WORDS: LessonWord[] = [
  { text: "cat", ipa: "/kaet/", meaning: "con mèo" },
  { text: "dog", ipa: "/dog/", meaning: "con chó" },
  { text: "apple", ipa: "/aep-l/", meaning: "quả táo" },
  { text: "book", ipa: "/buk/", meaning: "quyển sách" },
  { text: "school", ipa: "/sku:l/", meaning: "trường học" },
  { text: "teacher", ipa: "/ti:cher/", meaning: "giáo viên" },
  { text: "happy", ipa: "/hae-pi/", meaning: "vui vẻ" },
  { text: "beautiful", ipa: "/byu:-ti-ful/", meaning: "xinh đẹp" }
];

const IPA_VOWELS = [
  { symbol: "/i:/", sample: "see", note: "i dài", guide: "Kéo dài miệng cười: ii...", ipaSpeak: "ee" },
  { symbol: "/ɪ/", sample: "sit", note: "i ngắn", guide: "Âm i ngắn, bật nhanh, không kéo dài.", ipaSpeak: "ih" },
  { symbol: "/e/", sample: "bed", note: "e ngắn", guide: "Miệng mở vừa, âm e rõ và ngắn.", ipaSpeak: "eh" },
  { symbol: "/æ/", sample: "cat", note: "i bẹt (a bẹt)", guide: "Há miệng ngang, bẹt: /ae/.", ipaSpeak: "aeh" },
  { symbol: "/ʌ/", sample: "cup", note: "â ngắn", guide: "Miệng mở vừa, âm ơ ngắn.", ipaSpeak: "uh" },
  { symbol: "/ɑ:/", sample: "car", note: "a dài", guide: "Mở miệng rộng, kéo âm a.", ipaSpeak: "ah" },
  { symbol: "/ɔ:/", sample: "call", note: "o dài", guide: "Môi tròn nhẹ, kéo âm o.", ipaSpeak: "aw" },
  { symbol: "/u:/", sample: "food", note: "u dài", guide: "Chu môi, kéo âm u.", ipaSpeak: "oo" },
  { symbol: "/ʊ/", sample: "book", note: "u ngắn", guide: "Chu môi nhẹ, âm ngắn.", ipaSpeak: "uu" },
  { symbol: "/ə/", sample: "about", note: "ơ nhẹ", guide: "Âm rất nhẹ, nhanh, thư giãn.", ipaSpeak: "uh" }
];

const IPA_CONSONANTS = [
  { symbol: "/p/", sample: "pen" },
  { symbol: "/b/", sample: "book" },
  { symbol: "/t/", sample: "tea" },
  { symbol: "/d/", sample: "dog" },
  { symbol: "/k/", sample: "cat" },
  { symbol: "/g/", sample: "go" },
  { symbol: "/f/", sample: "fish" },
  { symbol: "/v/", sample: "very" },
  { symbol: "/s/", sample: "sun" },
  { symbol: "/z/", sample: "zoo" },
  { symbol: "/ʃ/", sample: "she" },
  { symbol: "/tʃ/", sample: "chair" }
];

const FINAL_SOUND_RULES = [
  {
    sound: "Âm cuối /s/",
    how: "Đặt lưỡi gần răng trên, đẩy hơi ra, KHÔNG rung cổ họng.",
    examples: "cats, books, stops"
  },
  {
    sound: "Âm cuối /t/",
    how: "Chạm đầu lưỡi vào nướu răng trên rồi bật nhẹ ra.",
    examples: "cat, sit, hot"
  },
  {
    sound: "Âm cuối /d/",
    how: "Giống /t/ nhưng có rung cổ họng.",
    examples: "bad, need, food"
  },
  {
    sound: "Âm cuối /k/",
    how: "Mặt sau lưỡi chạm ngạc mềm, bật hơi dứt khoát.",
    examples: "book, back, take"
  }
];

const LINKING_RULES = [
  {
    rule: "Phụ âm cuối + nguyên âm đầu",
    demo: "pick it → /pi-kit/",
    tip: "Nối liền, không ngắt giữa 2 từ."
  },
  {
    rule: "Tận cùng /r/ + nguyên âm",
    demo: "far away → /fa-ra-way/",
    tip: "Đọc nhẹ âm /r/ để câu mượt hơn."
  },
  {
    rule: "T + Y = /tʃ/",
    demo: "don’t you → /don-chu/",
    tip: "Trong nói nhanh, t+y thường hóa thành /ch/."
  }
];

const SENTENCE_PATTERNS = [
  {
    title: "Câu cơ bản",
    pattern: "Subject + Verb + Object",
    example: "I read books.",
    explain: "Chủ ngữ đứng trước động từ. Tân ngữ đứng sau động từ."
  },
  {
    title: "Tính từ + Danh từ",
    pattern: "Adjective + Noun",
    example: "a beautiful girl",
    explain: "Trong tiếng Anh, tính từ đứng trước danh từ."
  },
  {
    title: "Trạng từ + Động từ",
    pattern: "Adverb + Verb / Verb + Adverb",
    example: "She speaks slowly.",
    explain: "Trạng từ mô tả cách làm hành động."
  },
  {
    title: "Vị trí thời gian",
    pattern: "Subject + Verb + ... + Time",
    example: "We study English every day.",
    explain: "Cụm thời gian thường đứng cuối câu."
  }
];

const pickBestVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
  if (!voices.length) return null;
  return (
    voices.find((v) => /^en-US$/i.test(v.lang)) ??
    voices.find((v) => /^en-/i.test(v.lang)) ??
    voices.find((v) => /^vi-/i.test(v.lang)) ??
    voices[0] ??
    null
  );
};

const playSound = (text: string, voice: SpeechSynthesisVoice | null): Promise<"started" | "error" | "unsupported"> => {
  return new Promise((resolve) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve("unsupported");
      return;
  }

  const synth = window.speechSynthesis;
  synth.cancel();
    synth.resume();

  const utter = new SpeechSynthesisUtterance(text);
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  } else {
    utter.lang = "en-US";
  }
  utter.rate = 0.85;
  utter.pitch = 1;
  utter.volume = 1;
    utter.onstart = () => resolve("started");
    utter.onerror = () => resolve("error");
  synth.speak(utter);
    setTimeout(() => resolve("started"), 600);
  });
};

export default function EnglishLearningPage() {
  const [status, setStatus] = useState("");
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speechRate, setSpeechRate] = useState(0.85);


  const alphabetRows = useMemo(() => {
    const rows: Array<Array<{ letter: string; ipa: string }>> = [];
    for (let i = 0; i < ALPHABET_ITEMS.length; i += 6) {
      rows.push(ALPHABET_ITEMS.slice(i, i + 6));
    }
    return rows;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;

    const loadVoices = () => {
      const allVoices = synth.getVoices();
      const selected = pickBestVoice(allVoices);
      setVoice(selected);
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => {
      synth.onvoiceschanged = null;
    };
  }, []);

  const onSpeak = async (text: string) => {
    const result = await new Promise<"started" | "error" | "unsupported">((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve("unsupported");
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      synth.resume();
      const utter = new SpeechSynthesisUtterance(text);
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang;
      } else {
        utter.lang = "en-US";
      }
      utter.rate = speechRate;
      utter.pitch = 1;
      utter.volume = 1;
      utter.onstart = () => resolve("started");
      utter.onerror = () => resolve("error");
      synth.speak(utter);
      setTimeout(() => resolve("started"), 600);
    });
    if (result === "unsupported") {
      setStatus("Thiết bị/trình duyệt chưa hỗ trợ âm thanh đọc. Hãy dùng Chrome/Safari mới.");
      return;
    }
    if (result === "error") {
      setStatus("Không phát được âm thanh. Kiểm tra volume thiết bị, tab trình duyệt và quyền autoplay.");
      return;
    }
    setStatus(`Đang phát âm: "${text}" ${voice ? `(${voice.lang})` : ""}`);
  };

  const testAudioApi = async (): Promise<void> => {
    try {
      const audio = new Audio("/api/english/audio-test?freq=660&durationMs=1000");
      audio.volume = 1;
      await audio.play();
      setStatus("Đã phát âm test qua API thành công.");
    } catch (error) {
      setStatus("Không phát được âm test API. Kiểm tra quyền autoplay/media của trình duyệt.");
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/hoc-tap" className="text-sm text-cyan-400 hover:text-cyan-300 transition">
          ← Quay lại Học tập
        </Link>
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-200 transition">
          Về trang chủ
        </Link>
      </div>

      <section className="rounded-3xl border border-cyan-300/20 bg-slate-950/40 p-5 backdrop-blur md:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">English</p>
        <h1 className="mt-3 text-2xl font-bold md:text-4xl">Học tiếng Anh cơ bản</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
          Học phát âm từ đầu như trẻ tiểu học, nghe và đọc theo. Kèm phần cấu trúc câu để đặt câu đúng ngữ pháp.
        </p>
        {status && (
          <p className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
            {status}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => void onSpeak("Hello, this is a pronunciation test")}
            className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/10"
          >
            🔊 Test TTS trình duyệt
          </button>
          <button
            onClick={() => void testAudioApi()}
            className="rounded-lg border border-amber-300/40 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/10"
          >
            🔊 Test âm thanh API
          </button>
          <span className="text-xs text-slate-400">API: `/api/english/audio-test`</span>
        </div>
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-200">Tốc độ phát âm</p>
            <p className="text-xs text-amber-300">{speechRate.toFixed(2)}x</p>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.2}
            step={0.05}
            value={speechRate}
            onChange={(e) => setSpeechRate(Number(e.target.value))}
            className="mt-2 w-full accent-cyan-400"
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-100 md:text-xl">1. Bảng chữ cái và phiên âm</h2>
        <p className="mt-2 text-sm text-slate-300">Mỗi chữ có phiên âm IPA. Bấm Nghe để nghe chuẩn theo tiếng Anh.</p>
        <div className="mt-4 space-y-3">
          {alphabetRows.map((row, index) => (
            <div key={`row-${index}`} className="grid grid-cols-6 gap-2">
              {row.map((item) => (
                <div key={item.letter} className="rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-center">
                  <p className="text-sm font-bold text-cyan-200">{item.letter}</p>
                  <p className="text-[11px] text-amber-300">{item.ipa}</p>
                  <button
                    onClick={() => void onSpeak(item.letter)}
                    className="mt-1 w-full rounded-lg border border-cyan-300/40 px-2 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/10"
                  >
                    🔊 Nghe
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-100 md:text-xl">2. Từ vựng đầu tiên (nghe và đọc theo)</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {BASIC_WORDS.map((word) => (
            <div key={word.text} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-slate-100">{word.text}</p>
                  <p className="text-xs text-amber-300">{word.ipa}</p>
                  <p className="text-xs text-slate-400">{word.meaning}</p>
                </div>
                <button
                  onClick={() => onSpeak(word.text)}
                  className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/10"
                >
                  🔊 Nghe
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-100 md:text-xl">3. Bảng IPA cơ bản</h2>
        <p className="mt-2 text-sm text-slate-300">Bấm nút Nghe để nghe từ ví dụ của từng âm.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <p className="text-sm font-semibold text-cyan-200">Nguyên âm (vowels)</p>
            <div className="mt-2 space-y-2">
              {IPA_VOWELS.map((item) => (
                <div
                  key={item.symbol}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-left"
                >
                  <span className="font-mono text-amber-300">{item.symbol}</span>
                  <span className="text-slate-200">{item.sample}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{item.note}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => void onSpeak(item.ipaSpeak)}
                        className="rounded-lg border border-cyan-300/40 px-2 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/10"
                      >
                        🔊 Nghe âm
                      </button>
                      <button
                        onClick={() => void onSpeak(item.sample)}
                        className="rounded-lg border border-amber-300/40 px-2 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/10"
                      >
                        🔊 Ví dụ
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 space-y-1">
              {IPA_VOWELS.map((item) => (
                <p key={`${item.symbol}-guide`} className="text-xs text-slate-400">
                  <span className="font-mono text-amber-300">{item.symbol}</span> ({item.note}): {item.guide ?? ""}
                </p>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-2">
              <p className="text-xs font-semibold text-cyan-200">Video/GIF khẩu hình gợi ý</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {IPA_VOWELS.map((item) => (
                  <a
                    key={`${item.symbol}-video`}
                    href={`https://www.youtube.com/results?search_query=IPA+${encodeURIComponent(item.symbol)}+mouth+position`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 hover:border-cyan-300/60"
                  >
                    {item.symbol} ({item.note}) • Mở video/gif
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <p className="text-sm font-semibold text-cyan-200">Phụ âm (consonants)</p>
            <div className="mt-2 space-y-2">
              {IPA_CONSONANTS.map((item) => (
                <div
                  key={item.symbol}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-left"
                >
                  <span className="font-mono text-amber-300">{item.symbol}</span>
                  <span className="text-slate-200">{item.sample}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => void onSpeak(item.symbol.replaceAll("/", ""))}
                      className="rounded-lg border border-cyan-300/40 px-2 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/10"
                    >
                      🔊 Nghe âm
                    </button>
                    <button
                      onClick={() => void onSpeak(item.sample)}
                      className="rounded-lg border border-amber-300/40 px-2 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/10"
                    >
                      🔊 Ví dụ
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-2">
              <p className="text-xs font-semibold text-cyan-200">Video/GIF khẩu hình gợi ý</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {IPA_CONSONANTS.map((item) => (
                  <a
                    key={`${item.symbol}-video`}
                    href={`https://www.youtube.com/results?search_query=IPA+${encodeURIComponent(item.symbol)}+mouth+position`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 hover:border-cyan-300/60"
                  >
                    {item.symbol} • Mở video/gif
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-100 md:text-xl">4. Âm cuối quan trọng (s, t, d, k...)</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FINAL_SOUND_RULES.map((item) => (
            <div key={item.sound} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-sm font-semibold text-cyan-200">{item.sound}</p>
              <p className="mt-1 text-xs text-slate-300">{item.how}</p>
              <p className="mt-2 text-xs text-amber-300">Ví dụ: {item.examples}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-100 md:text-xl">5. Nối âm cơ bản (linking)</h2>
        <div className="mt-4 space-y-3">
          {LINKING_RULES.map((item) => (
            <div key={item.rule} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-sm font-semibold text-cyan-200">{item.rule}</p>
              <p className="mt-1 font-mono text-amber-300">{item.demo}</p>
              <p className="mt-1 text-xs text-slate-300">{item.tip}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-100 md:text-xl">6. Cấu trúc câu cơ bản</h2>
        <div className="mt-4 space-y-3">
          {SENTENCE_PATTERNS.map((item) => (
            <div key={item.title} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-sm font-semibold text-cyan-200">{item.title}</p>
              <p className="mt-1 text-sm text-slate-100">
                Mẫu: <span className="font-mono text-amber-300">{item.pattern}</span>
              </p>
              <p className="text-sm text-slate-300">
                Ví dụ: <span className="italic text-slate-100">{item.example}</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">{item.explain}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
