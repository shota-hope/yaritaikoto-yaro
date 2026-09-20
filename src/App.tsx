import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppData, Profile, Timeframe, Wish, classifyDueDate, dueDateFor, parseAge, remainingHealthyTime, timeframeFromDueDate, tokyoDate } from "./core";

const STORAGE_KEY = "yaritaikoto-yaro:v1";

declare global {
  interface Document {
    modelContext?: { registerTool: (tool: Record<string, unknown>, options?: { signal: AbortSignal }) => void | Promise<void> };
  }
}

const loadData = (): AppData | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppData;
    return parsed?.version === 1 && parsed.profile && Array.isArray(parsed.wishes) ? parsed : null;
  } catch { return null; }
};

const makeWish = (title: string, nextStep = ""): Wish => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: title.trim(), nextStep: nextStep.trim(), actionDueOn: null, status: "active", doneOn: null, createdAt: now, updatedAt: now };
};

const App = () => {
  const initialData = useMemo(loadData, []);
  const [data, setData] = useState<AppData | null>(initialData);
  const [age, setAge] = useState(() => String(initialData?.profile.age ?? ""));
  const [ageError, setAgeError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [wishError, setWishError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [today, setToday] = useState(() => tokyoDate());
  const ageInput = useRef<HTMLInputElement>(null);

  useEffect(() => { if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);
  useEffect(() => {
    const refreshDate = () => setToday(tokyoDate());
    const interval = window.setInterval(refreshDate, 60_000);
    document.addEventListener("visibilitychange", refreshDate);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", refreshDate); };
  }, []);

  const active = useMemo(() => data?.wishes.filter((wish) => wish.status === "active") ?? [], [data]);
  const done = useMemo(() => [...(data?.wishes.filter((wish) => wish.status === "done") ?? [])].sort((a, b) => (b.doneOn ?? "").localeCompare(a.doneOn ?? "")), [data]);
  const validAge = parseAge(age);
  const previewProfile: Profile | null = validAge === null ? null : data?.profile.age === validAge ? data.profile : { age: validAge, savedAt: new Date().toISOString() };
  const remaining = previewProfile ? remainingHealthyTime(previewProfile, new Date(`${today}T12:00:00+09:00`)) : null;

  const addWish = (title: string, nextStep = "") => {
    if (!title.trim()) throw new Error("やりたいことを入力してください");
    if (!data) throw new Error("先に年齢を保存してください");
    const wish = makeWish(title, nextStep);
    setData((current) => current ? { ...current, wishes: [wish, ...current.wishes] } : current);
    return wish;
  };

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool || !data) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "add_wish",
      title: "やりたいことを追加",
      description: "この端末のリストに、やりたいことと任意の次の一歩を追加します。",
      inputSchema: { type: "object", properties: { title: { type: "string" }, nextStep: { type: "string" } }, required: ["title"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input: unknown) => {
        const value = input as { title?: string; nextStep?: string };
        const wish = addWish(value.title ?? "", value.nextStep ?? "");
        return { id: wish.id, status: wish.status };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [data?.profile]);

  const saveAge = () => {
    const parsed = parseAge(age);
    if (parsed === null) {
      setAgeError("0〜120の整数で入力してください");
      return false;
    }
    setAgeError("");
    if (data?.profile.age === parsed) return true;
    const profile = { age: parsed, savedAt: new Date().toISOString() };
    setData((current) => current ? { ...current, profile } : { version: 1, profile, wishes: [] });
    if (!data) setNotice("このブラウザに保存しました");
    return true;
  };

  const submitWish = (event: FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim()) { setWishError("やりたいことを入力してください"); return; }
    if (!data) {
      const parsed = parseAge(age);
      if (parsed !== null) {
        const profile = { age: parsed, savedAt: new Date().toISOString() };
        const wish = makeWish(newTitle);
        setData({ version: 1, profile, wishes: [wish] });
        setNewTitle("");
        setAgeError("");
        setWishError("");
        setNotice("このブラウザに保存しました");
        return;
      }
      setAgeError("追加する前に年齢を入力してください");
      setWishError("タイトルはそのままです。年齢を入力してから、もう一度追加してください");
      ageInput.current?.focus();
      return;
    }
    addWish(newTitle);
    setNewTitle("");
    setWishError("");
  };

  const updateWish = (updated: Wish) => setData((current) => current ? { ...current, wishes: current.wishes.map((wish) => wish.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : wish) } : current);
  const completeWish = (wish: Wish) => { updateWish({ ...wish, status: "done", doneOn: tokyoDate(), actionDueOn: null }); setEditingId(null); setNotice("達成に残しました。おめでとう。"); };
  const restoreWish = (wish: Wish) => updateWish({ ...wish, status: "active", doneOn: null });
  const deleteWish = (wish: Wish) => {
    if (!window.confirm(`「${wish.title}」を削除しますか？`)) return;
    setData((current) => current ? { ...current, wishes: current.wishes.filter((item) => item.id !== wish.id) } : current);
    setEditingId(null);
  };

  return <main className="app-shell">
    <header className="hero">
      <p className="wordmark">やりたいことやろう</p>
      <h1>残りの時間を意識して、<br />やりたいことを一つずつ。</h1>
    </header>

    {notice && <button className="notice" type="button" onClick={() => setNotice("")}>{notice}<span aria-hidden="true">×</span></button>}

    <section className="time-section" aria-labelledby="time-heading">
      <div className="age-field">
        <label htmlFor="age">今の年齢</label>
        <div className={ageError ? "age-input invalid" : "age-input"}>
          <input ref={ageInput} id="age" name="age" type="number" inputMode="numeric" min="0" max="120" value={age} onChange={(event) => { setAge(event.target.value); setAgeError(""); }} onBlur={saveAge} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} aria-describedby={ageError ? "age-error" : undefined} aria-invalid={Boolean(ageError)} />
          <span>歳</span>
        </div>
        {ageError && <p className="field-error" id="age-error" role="alert">{ageError}</p>}
      </div>
      <div className="remaining-time">
        <p className="section-label" id="time-heading">健康寿命の目安まで</p>
        {!remaining ? <p className="time-prompt">年齢を入力してください</p>
          : remaining.totalDays > 0 ? <p className="time-number"><span>約</span><strong>{remaining.years}</strong><span>年</span><strong>{remaining.days}</strong><span>日</span></p>
          : <p className="time-prompt">これから、何をしたい？</p>}
      </div>
      <p className="caution">2022年の健康寿命（男性72.57年、女性75.45年）の中間値74.01年を目安にしています。個人の寿命や健康状態を予測するものではありません。<a href="https://www.mhlw.go.jp/content/10904750/001363070.pdf" target="_blank" rel="noreferrer">厚生労働省の資料</a></p>
    </section>

    <section className="list-section" aria-labelledby="list-heading">
      <div className="section-heading"><h2 id="list-heading">やりたいこと</h2><span>{active.length}件</span></div>
      <form className="quick-add" onSubmit={submitWish}>
        <label className="sr-only" htmlFor="new-wish">やりたいこと</label>
        <input id="new-wish" value={newTitle} onChange={(event) => { setNewTitle(event.target.value); setWishError(""); }} onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} placeholder="やりたいことを入力" aria-describedby={wishError ? "wish-error" : undefined} />
        <button type="submit" disabled={!newTitle.trim()}>追加</button>
      </form>
      {wishError && <p className="field-error" id="wish-error" role="alert">{wishError}</p>}

      {active.length === 0 ? <div className="empty-state"><p>頭に浮かんだことを、ひとつだけ。</p><span>タイトルだけで追加できます</span></div>
        : <div className="wish-list">{active.map((wish) => editingId === wish.id
          ? <WishEditor key={wish.id} wish={wish} onSave={(next) => { updateWish(next); setEditingId(null); }} onCancel={() => setEditingId(null)} onComplete={() => completeWish(wish)} onDelete={() => deleteWish(wish)} />
          : <article className="wish-row" key={wish.id}>
              <button className="wish-content" type="button" onClick={() => setEditingId(wish.id)}>
                <strong>{wish.title}</strong>
                <small className={wish.nextStep ? "" : "add-step"}>{wish.nextStep ? `次の一歩　${wish.nextStep}` : "＋ 次の一歩を追加"}</small>
              </button>
              <div className="wish-meta"><span>{classifyDueDate(wish.actionDueOn)}</span><button type="button" onClick={() => setEditingId(wish.id)}>編集</button></div>
            </article>)}</div>}
    </section>

    {done.length > 0 && <details className="done-section"><summary>達成したこと <span>{done.length}件</span></summary>{done.map((wish) => <div className="done-row" key={wish.id}><div><strong>{wish.title}</strong><small>{wish.doneOn?.replaceAll("-", ".")}</small></div><button type="button" onClick={() => restoreWish(wish)}>戻す</button></div>)}</details>}
    <p className="storage-note">入力内容はこのブラウザに保存されます。</p>
  </main>;
};

const WishEditor = ({ wish, onSave, onCancel, onComplete, onDelete }: { wish: Wish; onSave: (wish: Wish) => void; onCancel: () => void; onComplete: () => void; onDelete: () => void }) => {
  const [title, setTitle] = useState(wish.title);
  const [nextStep, setNextStep] = useState(wish.nextStep);
  const initialTimeframe = timeframeFromDueDate(wish.actionDueOn);
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  return <form className="wish-editor" onSubmit={(event) => { event.preventDefault(); if (title.trim()) onSave({ ...wish, title: title.trim(), nextStep: nextStep.trim(), actionDueOn: timeframe === initialTimeframe ? wish.actionDueOn : dueDateFor(timeframe) }); }}>
    <label htmlFor={`title-${wish.id}`}>やりたいこと</label><input id={`title-${wish.id}`} value={title} onChange={(event) => setTitle(event.target.value)} />
    <label htmlFor={`step-${wish.id}`}>次の一歩 <span>任意</span></label><input id={`step-${wish.id}`} value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder="例：行き方を調べる" />
    <fieldset><legend>いつ動き出す？</legend><div className="choice-row">{([["month", "今月"], ["year", "今年"], ["undecided", "未定"]] as const).map(([value, label]) => <label key={value} className={timeframe === value ? "selected" : ""}><input type="radio" name={`timeframe-${wish.id}`} checked={timeframe === value} onChange={() => setTimeframe(value)} />{label}</label>)}</div></fieldset>
    <div className="form-actions spread"><button className="text-button danger" type="button" onClick={onDelete}>削除</button><div><button className="text-button" type="button" onClick={onCancel}>キャンセル</button><button className="small-primary" type="submit" disabled={!title.trim()}>保存</button></div></div>
    <button className="complete-button" type="button" onClick={onComplete}>達成にする</button>
  </form>;
};

export default App;
