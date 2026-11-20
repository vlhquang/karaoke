"use client";

import { useEffect, useMemo, useState } from "react";

type Phrase = { en: string; vi: string; reply: string; replyVi: string };
type Lesson = { week: number; day: number; title: string; goal: string; phrase: Phrase };
type Session = {
  lessonDay: number;
  score: number;
  speakingScore: number;
  transcript: string;
  missed: string[];
  note: string;
  completed: boolean;
};
type Progress = { startedAt: string; sessions: Record<string, Session> };

const WEEK_THEMES = [
  { title: "Làm quen và giới thiệu", goal: "Chào hỏi, giới thiệu bản thân và làm quen với đồng nghiệp." },
  { title: "Thói quen và lịch trình", goal: "Nói về một ngày thường, thời gian và lịch hẹn." },
  { title: "Giao tiếp nơi làm việc", goal: "Hỏi việc, cập nhật tiến độ và trao đổi với đồng nghiệp." },
  { title: "Họp và phối hợp", goal: "Tham gia cuộc họp, nêu ý kiến và xác nhận việc cần làm." },
  { title: "Đi lại và ăn uống", goal: "Hỏi đường, đi lại và gọi món trong những tình huống thường ngày." },
  { title: "Mua sắm và dịch vụ", goal: "Hỏi giá, nhờ trợ giúp và xử lý yêu cầu đơn giản." },
  { title: "Kể chuyện và trò chuyện", goal: "Chia sẻ sở thích, trải nghiệm và hỏi chuyện người khác." },
  { title: "Ôn tập và thực hành", goal: "Kết hợp những mẫu câu đã học trong tình huống thực tế." },
];

const PHRASES: Phrase[] = [
  { en: "Hello, my name is Lan.", vi: "Xin chào, tên tôi là Lan.", reply: "Nice to meet you, Lan.", replyVi: "Rất vui được gặp bạn, Lan." },
  { en: "I work in the office.", vi: "Tôi làm việc ở văn phòng.", reply: "What do you do there?", replyVi: "Bạn làm công việc gì ở đó?" },
  { en: "Could you speak more slowly, please?", vi: "Bạn có thể nói chậm hơn được không?", reply: "Of course. Is this better?", replyVi: "Được chứ. Như thế này đã dễ nghe hơn chưa?" },
  { en: "I will finish this today.", vi: "Tôi sẽ hoàn thành việc này hôm nay.", reply: "Great. Please send me an update.", replyVi: "Tốt. Hãy gửi tôi cập nhật nhé." },
  { en: "Could you help me with this?", vi: "Bạn có thể giúp tôi việc này không?", reply: "Sure. What do you need?", replyVi: "Được. Bạn cần gì?" },
  { en: "I have a meeting at ten.", vi: "Tôi có cuộc họp lúc mười giờ.", reply: "Where is the meeting?", replyVi: "Cuộc họp ở đâu?" },
  { en: "I usually have coffee in the morning.", vi: "Tôi thường uống cà phê vào buổi sáng.", reply: "Do you take it with milk?", replyVi: "Bạn có uống cùng sữa không?" },
  { en: "I get up at seven every day.", vi: "Tôi thức dậy lúc bảy giờ mỗi ngày.", reply: "What time do you start work?", replyVi: "Bạn bắt đầu làm lúc mấy giờ?" },
  { en: "I am working on the report.", vi: "Tôi đang làm báo cáo.", reply: "When will it be ready?", replyVi: "Khi nào báo cáo sẽ xong?" },
  { en: "I need a little more time.", vi: "Tôi cần thêm một chút thời gian.", reply: "That is fine. Let me know tomorrow.", replyVi: "Không sao. Ngày mai báo tôi nhé." },
  { en: "Could you send me the file?", vi: "Bạn gửi cho tôi tập tin được không?", reply: "Yes, I will send it now.", replyVi: "Được, tôi sẽ gửi ngay." },
  { en: "I will check and get back to you.", vi: "Tôi sẽ kiểm tra rồi phản hồi bạn.", reply: "Thank you. I will wait for your update.", replyVi: "Cảm ơn. Tôi sẽ chờ bạn cập nhật." },
  { en: "What do you think about this idea?", vi: "Bạn nghĩ sao về ý tưởng này?", reply: "I think it is a good idea.", replyVi: "Tôi nghĩ đây là một ý tưởng hay." },
  { en: "Could you repeat the last part?", vi: "Bạn có thể nhắc lại phần cuối không?", reply: "Yes, let me say that again.", replyVi: "Được, để tôi nói lại." },
  { en: "I agree with you.", vi: "Tôi đồng ý với bạn.", reply: "Great. Let us do that.", replyVi: "Tốt. Chúng ta làm như vậy nhé." },
  { en: "Let me share my screen.", vi: "Để tôi chia sẻ màn hình.", reply: "I can see it now.", replyVi: "Tôi thấy rồi." },
  { en: "I would like a table for two.", vi: "Tôi muốn một bàn cho hai người.", reply: "Certainly. Please follow me.", replyVi: "Được ạ. Xin mời đi theo tôi." },
  { en: "How do I get to the station?", vi: "Tôi đi đến nhà ga bằng cách nào?", reply: "Go straight and turn left.", replyVi: "Đi thẳng rồi rẽ trái." },
  { en: "Could I have the menu, please?", vi: "Cho tôi xin thực đơn được không?", reply: "Of course. Here you are.", replyVi: "Tất nhiên. Của bạn đây." },
  { en: "I would like some water, please.", vi: "Cho tôi xin một ít nước.", reply: "Still or sparkling?", replyVi: "Nước thường hay có ga?" },
  { en: "How much does this cost?", vi: "Cái này giá bao nhiêu?", reply: "It is ten dollars.", replyVi: "Món này giá mười đô la." },
  { en: "Do you have this in a smaller size?", vi: "Bạn có cỡ nhỏ hơn không?", reply: "Let me check for you.", replyVi: "Để tôi kiểm tra giúp bạn." },
  { en: "Can I pay by card?", vi: "Tôi có thể thanh toán bằng thẻ không?", reply: "Yes, we accept cards.", replyVi: "Có, chúng tôi nhận thanh toán bằng thẻ." },
  { en: "I am looking for the bus stop.", vi: "Tôi đang tìm trạm xe buýt.", reply: "It is across the street.", replyVi: "Trạm ở bên kia đường." },
  { en: "I enjoy listening to music.", vi: "Tôi thích nghe nhạc.", reply: "What kind of music do you like?", replyVi: "Bạn thích thể loại nhạc nào?" },
  { en: "What do you like to do on weekends?", vi: "Bạn thích làm gì vào cuối tuần?", reply: "I like to relax at home.", replyVi: "Tôi thích nghỉ ngơi ở nhà." },
  { en: "I visited my family last weekend.", vi: "Cuối tuần trước tôi đã thăm gia đình.", reply: "That sounds lovely.", replyVi: "Nghe thật vui." },
  { en: "I have been learning English for a month.", vi: "Tôi đã học tiếng Anh được một tháng.", reply: "That is great progress.", replyVi: "Bạn tiến bộ tốt đấy." },
  { en: "I am not sure, but I can find out.", vi: "Tôi chưa chắc, nhưng tôi có thể tìm hiểu.", reply: "Thank you for checking.", replyVi: "Cảm ơn bạn đã kiểm tra." },
  { en: "Could you say that again?", vi: "Bạn có thể nói lại câu đó không?", reply: "Sure. I said the call starts at three.", replyVi: "Được. Tôi nói cuộc gọi bắt đầu lúc ba giờ." },
  { en: "I am available after lunch.", vi: "Tôi rảnh sau bữa trưa.", reply: "Does two o'clock work for you?", replyVi: "Hai giờ có tiện cho bạn không?" },
  { en: "Thank you for your time today.", vi: "Cảm ơn bạn đã dành thời gian hôm nay.", reply: "You are welcome. Talk to you soon.", replyVi: "Không có gì. Sớm nói chuyện lại nhé." },
];

const LESSONS: Lesson[] = Array.from({ length: 56 }, (_, index) => {
  const week = Math.floor(index / 7) + 1;
  const day = (index % 7) + 1;
  const theme = WEEK_THEMES[week - 1];
  const phrase = PHRASES[index % PHRASES.length];
  const titles = ["Nghe và hiểu", "Nói theo", "Phản xạ nhanh", "Nói về công việc", "Đưa vào tình huống", "Ôn mẫu câu", "Tự tin giao tiếp"];
  return { week, day, title: titles[day - 1], goal: theme.goal, phrase };
});

const STORAGE_KEY = "english-daily-coach-v1";
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dayDifference = (start: string, end: string) => Math.floor((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000);

export default function DailyEnglishCoach() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [heard, setHeard] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [selfRating, setSelfRating] = useState<number | null>(null);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [replyChoice, setReplyChoice] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? (JSON.parse(stored) as Progress) : null;
      const today = dateKey();
      const next = parsed ?? { startedAt: today, sessions: {} };
      if (!parsed) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setProgress(next);
      setSelectedDay(Math.max(0, Math.min(55, dayDifference(next.startedAt, today))));
    } catch {
      const next = { startedAt: dateKey(), sessions: {} };
      setProgress(next);
      setSelectedDay(0);
    }
  }, []);

  const lesson = LESSONS[selectedDay];
  const todayKey = dateKey();
  const todaySession = progress?.sessions[todayKey];
  const quizOptions = useMemo(() => {
    const distractors = PHRASES.filter((item) => item.vi !== lesson.phrase.vi).slice((selectedDay * 3) % (PHRASES.length - 3), (selectedDay * 3) % (PHRASES.length - 3) + 3);
    const options = [lesson.phrase, ...distractors].map((item) => item.vi);
    const seed = selectedDay % options.length;
    return options.map((_, index) => options[(index + seed) % options.length]);
  }, [lesson, selectedDay]);
  const replyOptions = useMemo(() => {
    const distractors = PHRASES.filter((item) => item.replyVi !== lesson.phrase.replyVi).slice((selectedDay * 2) % (PHRASES.length - 3), (selectedDay * 2) % (PHRASES.length - 3) + 3);
    return [lesson.phrase.replyVi, ...distractors.map((item) => item.replyVi)].sort((a, b) => (a.length + selectedDay) % 7 - (b.length + selectedDay) % 7);
  }, [lesson, selectedDay]);
  const expectedReplyIndex = replyOptions.indexOf(lesson.phrase.replyVi);
  const expectedMeaningIndex = quizOptions.indexOf(lesson.phrase.vi);

  useEffect(() => {
    setShowMeaning(false);
    setHeard(false);
    setTranscript("");
    setSelfRating(null);
    setQuizChoice(null);
    setReplyChoice(null);
    setMessage("");
  }, [selectedDay]);

  const speak = (text: string, rate = 0.82) => {
    if (!("speechSynthesis" in window)) {
      setMessage("Trình duyệt này chưa hỗ trợ phát âm. Bạn có thể mở trang bằng Chrome hoặc Safari.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.onend = () => setHeard(true);
    utterance.onerror = () => setMessage("Không phát được âm thanh. Hãy kiểm tra âm lượng thiết bị.");
    window.speechSynthesis.speak(utterance);
  };

  const recordSpeech = () => {
    type SpeechRecognitionLike = new () => {
      lang: string; interimResults: boolean; maxAlternatives: number;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: (() => void) | null; onend: (() => void) | null; start: () => void;
    };
    const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionLike; webkitSpeechRecognition?: SpeechRecognitionLike };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage("Trình duyệt chưa hỗ trợ nhận diện giọng nói. Hãy đọc câu thành tiếng rồi chọn ‘Tự chấm’.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => setTranscript(event.results[0][0].transcript);
    recognition.onerror = () => setMessage("Chưa nhận được giọng nói. Hãy cho phép dùng micro rồi thử lại.");
    recognition.onend = () => setRecording(false);
    setRecording(true);
    setMessage("Đang nghe… Hãy nói câu tiếng Anh ở trên.");
    try { recognition.start(); } catch { setRecording(false); setMessage("Không thể mở micro. Hãy thử tải lại trang và cấp quyền micro."); }
  };

  const speakingScore = (heardText: string) => {
    const expected = normalize(lesson.phrase.en).split(" ");
    const actual = new Set(normalize(heardText).split(" "));
    return Math.round((expected.filter((word) => actual.has(word)).length / expected.length) * 100);
  };

  const saveSession = (selfRated = false) => {
    if (!progress) return;
    if (quizChoice === null || replyChoice === null) {
      setMessage("Hãy trả lời cả hai câu kiểm tra trước nhé.");
      return;
    }
    if (!heard && !transcript) {
      setMessage("Hãy nghe bài và luyện nói trước khi lưu kết quả.");
      return;
    }
    const score = (Number(quizChoice === expectedMeaningIndex) + Number(replyChoice === expectedReplyIndex)) * 50;
    const voiceScore = transcript ? speakingScore(transcript) : selfRated && selfRating !== null ? selfRating : 0;
    const missed: string[] = [];
    if (!heard) missed.push("Nghe câu mẫu ít nhất 2 lần");
    if (score < 100) missed.push("Ôn nghĩa câu và câu trả lời trong hội thoại");
    if (voiceScore < 80) missed.push(`Luyện phát âm lại: “${lesson.phrase.en}”`);
    if (selfRated && !transcript) missed.push("Lần sau thử bật nhận diện giọng nói để theo dõi rõ hơn");
    const session: Session = {
      lessonDay: selectedDay, score, speakingScore: voiceScore, transcript,
      missed, note: missed.join(" · ") || "Ôn lại mẫu câu vào ngày mai để ghi nhớ lâu hơn.", completed: true,
    };
    const next = { ...progress, sessions: { ...progress.sessions, [todayKey]: session } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setProgress(next);
    setMessage("Đã lưu kết quả hôm nay. Phần cần ôn đã được ghi lại bên dưới.");
  };

  if (!progress) return <div className="mt-6 rounded-3xl border border-slate-700 bg-slate-900/70 p-6 text-slate-300">Đang mở lộ trình học…</div>;
  const completedSessions = Object.values(progress.sessions).filter((item) => item.completed);
  const average = completedSessions.length ? Math.round(completedSessions.reduce((sum, item) => sum + item.score, 0) / completedSessions.length) : 0;
  const savedForToday = todaySession?.lessonDay === selectedDay;

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-950/40 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Lộ trình 8 tuần · nghe và nói</p>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Bài học hằng ngày</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Mỗi ngày dành khoảng 15 phút: nghe mẫu câu, nói theo, rồi kiểm tra nhanh. Tiến độ được lưu trên thiết bị này.</p>
        </div>
        <div className="grid min-w-[220px] grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-400">Ngày đã học</p><p className="mt-1 text-xl font-bold text-white">{completedSessions.length} <span className="text-sm font-normal text-slate-400">/ 56</span></p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-400">Điểm trung bình</p><p className="mt-1 text-xl font-bold text-cyan-200">{average}%</p></div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[250px_1fr]">
        <aside className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
          <label htmlFor="english-day" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Chọn bài học</label>
          <select id="english-day" value={selectedDay} onChange={(event) => setSelectedDay(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400">
            {LESSONS.map((item, index) => <option key={index} value={index}>Ngày {index + 1} · Tuần {item.week}: {item.title}</option>)}
          </select>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-cyan-300">Tuần {lesson.week}: {WEEK_THEMES[lesson.week - 1].title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{lesson.goal}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${(completedSessions.length / 56) * 100}%` }} /></div>
          <p className="mt-1.5 text-[11px] text-slate-500">Hoàn thành {Math.round((completedSessions.length / 56) * 100)}% lộ trình</p>
        </aside>

        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-200">Ngày {selectedDay + 1} · {lesson.title}</p><h3 className="mt-1 text-lg font-bold text-white">Nghe câu, hiểu ý, rồi nói theo</h3></div><span className="rounded-full border border-cyan-300/20 px-3 py-1 text-xs text-cyan-100">Khoảng 15 phút</span></div>
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-xs text-slate-400">Câu mẫu hôm nay</p>
              <p className="mt-2 text-xl font-semibold leading-8 text-white">{lesson.phrase.en}</p>
              {showMeaning && <p className="mt-1 text-sm text-amber-200">{lesson.phrase.vi}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => speak(lesson.phrase.en)} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300">▶ Nghe câu mẫu</button>
                <button onClick={() => speak(lesson.phrase.en, 0.68)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5">Nghe chậm</button>
                <button onClick={() => setShowMeaning(!showMeaning)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5">{showMeaning ? "Ẩn nghĩa" : "Xem nghĩa"}</button>
              </div>
              <p className="mt-3 text-xs text-slate-500">Bước 1: nghe 2 lần, thử đoán nghĩa trước khi mở phần dịch.</p>
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-400">Bước 2: đọc câu trên thành tiếng</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={recordSpeech} disabled={recording} className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-60">{recording ? "🎙 Đang nghe…" : "🎙 Nói và nhận diện"}</button>
              <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-slate-400">Không dùng micro? Tự đánh giá:</span>{[{ label: "Cần luyện thêm", value: 50 }, { label: "Khá ổn", value: 75 }, { label: "Nói rõ", value: 100 }].map((rating) => <button key={rating.value} onClick={() => setSelfRating(rating.value)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${selfRating === rating.value ? "border-emerald-300 bg-emerald-300/10 text-emerald-100" : "border-white/15 text-slate-300 hover:bg-white/5"}`}>{rating.label}</button>)}</div>
              </div>
              {transcript && <p className="mt-3 text-sm text-slate-200">Máy nhận được: <span className="font-semibold text-emerald-200">{transcript}</span><span className="ml-2 text-xs text-slate-400">Khớp khoảng {speakingScore(transcript)}%</span></p>}
              <p className="mt-2 text-xs text-slate-500">Điểm nói chỉ so khớp từ nhận diện được, không thay thế đánh giá phát âm chuyên môn.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-200">Bước 3 · kiểm tra nhanh</p>
            <fieldset className="mt-3"><legend className="text-sm font-semibold text-white">1. Câu mẫu có nghĩa gần nhất là gì?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{quizOptions.map((option, index) => <button key={option} onClick={() => setQuizChoice(index)} className={`rounded-xl border px-3 py-2.5 text-left text-sm ${quizChoice === index ? "border-cyan-300 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-slate-900/50 text-slate-300 hover:border-white/25"}`}>{option}</button>)}</div></fieldset>
            <fieldset className="mt-4"><legend className="text-sm font-semibold text-white">2. Nghe câu trả lời, người kia vừa nói gì?</legend><p className="mt-1 text-xs text-slate-400">Bấm nghe trước, rồi chọn ý nghĩa câu trả lời.</p><button onClick={() => speak(lesson.phrase.reply)} className="mt-2 rounded-lg border border-amber-300/30 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/10">▶ Nghe câu trả lời</button><div className="mt-2 grid gap-2 sm:grid-cols-2">{replyOptions.map((option, index) => <button key={option} onClick={() => setReplyChoice(index)} className={`rounded-xl border px-3 py-2.5 text-left text-sm ${replyChoice === index ? "border-amber-300 bg-amber-400/10 text-amber-100" : "border-white/10 bg-slate-900/50 text-slate-300 hover:border-white/25"}`}>{option}</button>)}</div></fieldset>
            <button onClick={() => saveSession(selfRating !== null)} className="mt-4 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-100">Lưu kết quả hôm nay</button>
            {message && <p role="status" className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-400/5 px-3 py-2 text-sm text-cyan-100">{message}</p>}
          </div>

          {savedForToday && todaySession && <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/5 p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-200">Đánh giá ngày hôm nay</p><p className="mt-1 text-sm text-slate-200">Bài kiểm tra: <strong className="text-white">{todaySession.score}%</strong> <span className="mx-2 text-slate-600">·</span> Luyện nói: <strong className="text-white">{todaySession.speakingScore}%</strong></p></div><span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">Đã ghi nhận</span></div>
            <p className="mt-3 text-sm font-semibold text-white">Phần nên luyện thêm</p>
            {todaySession.missed.length ? <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-slate-300">{todaySession.missed.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-1 text-sm text-emerald-100">Làm tốt lắm! Ôn nhanh câu này vào ngày mai để ghi nhớ lâu hơn.</p>}
            {todaySession.transcript && <p className="mt-3 text-xs text-slate-400">Nhận diện giọng nói: “{todaySession.transcript}”</p>}
          </div>}
        </div>
      </div>

      {completedSessions.length > 0 && <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <p className="text-sm font-semibold text-white">Nhật ký học gần đây</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(progress.sessions).sort(([a], [b]) => b.localeCompare(a)).slice(0, 6).map(([day, session]) => <div key={day} className="rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2"><p className="text-xs text-slate-400">{day} · Ngày học {session.lessonDay + 1}</p><p className="mt-1 text-sm text-slate-200">Kiểm tra {session.score}% · Nói {session.speakingScore}%</p><p className="mt-1 truncate text-xs text-amber-200">{session.missed[0] ?? "Đã hoàn thành tốt"}</p></div>)}</div>
      </div>}
    </section>
  );
}
