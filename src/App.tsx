import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppData, Profile, Timeframe, Wish, classifyDueDate, dueDateFor, remainingHealthyDays, timeframeFromDueDate, tokyoDate } from "./core";

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
    return parsed?.version === 1 && parsed.profile ? parsed : null;
  } catch { return null; }
};

const makeWish = (title: string, nextStep = ""): Wish => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: title.trim(), nextStep: nextStep.trim(), actionDueOn: null, status: "active", doneOn: null, createdAt: now, updatedAt: now };
};

const App = () => {
  const [data, setData] = useState<AppData | null>(loadData);
  const [age, setAge] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => { if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);

  const active = useMemo(() => data?.wishes.filter((wish) => wish.status === "active") ?? [], [data]);
  const done = useMemo(() => (data?.wishes.filter((wish) => wish.status === "done") ?? []).sort((a, b) => (b.doneOn ?? "").localeCompare(a.doneOn ?? "")), [data]);

  const addWish = (title: string, nextStep = "") => {
    if (!title.trim()) throw new Error("やりたいことを入力してください");
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

  const saveAge = (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number(age);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 120) return;
    const profile: Profile = { age: parsed, savedAt: new Date().toISOString() };
    setData({ version: 1, profile, wishes: [] });
    setNotice("このブラウザで続けられます");
  };

  const submitWish = (event: FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim()) return;
    addWish(newTitle);
    setNewTitle("");
    setShowAdd(false);
  };

  const updateWish = (updated: Wish) => setData((current) => current ? { ...current, wishes: current.wishes.map((wish) => wish.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : wish) } : current);
  const completeWish = (wish: Wish) => { updateWish({ ...wish, status: "done", doneOn: tokyoDate(), actionDueOn: null }); setEditingId(null); setNotice("達成に残しました。おめでとう。"); };
  const restoreWish = (wish: Wish) => updateWish({ ...wish, status: "active", doneOn: null });
  const deleteWish = (wish: Wish) => {
    if (!window.confirm(`「${wish.title}」を削除しますか？`)) return;
    setData((current) => current ? { ...current, wishes: current.wishes.filter((item) => item.id !== wish.id) } : current);
    setEditingId(null);
  };

  if (!data) {
    return <main className="onboarding-shell"><section className="onboarding-card">
      <div className="brand-mark" aria-hidden="true">や</div><p className="eyebrow">やりたいことやろう</p><h1>今、何歳ですか？</h1>
      <p className="lead">残された時間を決めつけるためではなく、やりたいことを思い出す目安にします。</p>
      <form onSubmit={saveAge}><label htmlFor="age">年齢</label><div className="age-row"><input id="age" name="age" type="number" inputMode="numeric" min="0" max="120" required value={age} onChange={(e) => setAge(e.target.value)} autoFocus /><span>歳</span></div><button className="primary" type="submit">はじめる</button></form>
      <p className="privacy-note">入力内容はこの端末だけに保存されます。</p>
    </section></main>;
  }

  const days = remainingHealthyDays(data.profile);
  return <main className="app-shell">
    <header className="topbar"><p className="wordmark">やりたいことやろう</p><button className="age-button" type="button" onClick={() => {
      const next = window.prompt("年齢を入力してください", String(data.profile.age));
      if (next === null) return;
      const parsed = Number(next);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 120) setData({ ...data, profile: { age: parsed, savedAt: new Date().toISOString() } });
    }}>{data.profile.age}歳</button></header>
    {notice && <button className="notice" type="button" onClick={() => setNotice("")}>{notice}<span>×</span></button>}
    <section className="time-card"><p className="eyebrow">時間を考える目安</p>
      {days > 0 ? <p className="time-number"><strong>約 {Math.floor(days / 365.2425)}</strong><span>年</span></p> : <h1>これから、何をしたい？</h1>}
      {days > 0 && <p className="days-detail">あと約 {days.toLocaleString("ja-JP")} 日</p>}
      <p className="caution">2022年の健康寿命の中間値74.01年を使用。個人の寿命や健康状態を予測するものではありません。</p>
    </section>
    <section className="list-section"><div className="section-heading"><div><p className="eyebrow">わたしのリスト</p><h1>動けるうちに<br />やりたいこと</h1></div><span className="count">{active.length}</span></div>
      {showAdd ? <form className="inline-add" onSubmit={submitWish}><label htmlFor="new-wish">やりたいこと</label><input id="new-wish" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="例：ずっと気になっていた町へ行く" autoFocus /><div className="form-actions"><button className="text-button" type="button" onClick={() => { setShowAdd(false); setNewTitle(""); }}>やめる</button><button className="small-primary" type="submit">追加する</button></div></form>
      : <button className="add-button" type="button" onClick={() => setShowAdd(true)}><span>＋</span> やりたいことを追加</button>}
      {active.length === 0 ? <div className="empty-state"><p>頭に浮かんだことを、ひとつだけ。</p><span>タイトルだけで追加できます</span></div>
      : <div className="wish-list">{active.map((wish) => editingId === wish.id
        ? <WishEditor key={wish.id} wish={wish} onSave={(next) => { updateWish(next); setEditingId(null); }} onCancel={() => setEditingId(null)} onComplete={() => completeWish(wish)} onDelete={() => deleteWish(wish)} />
        : <button className="wish-card" type="button" key={wish.id} onClick={() => setEditingId(wish.id)}><span className="wish-main"><strong>{wish.title}</strong>{wish.nextStep && <small>次の一歩　{wish.nextStep}</small>}</span><span className="due-label">{classifyDueDate(wish.actionDueOn)}</span></button>)}</div>}
    </section>
    {done.length > 0 && <section className="done-section"><p className="eyebrow">達成したこと</p>{done.map((wish) => <div className="done-row" key={wish.id}><div><strong>{wish.title}</strong><small>{wish.doneOn?.replaceAll("-", ".")}</small></div><button type="button" onClick={() => restoreWish(wish)}>戻す</button></div>)}</section>}
  </main>;
};

const WishEditor = ({ wish, onSave, onCancel, onComplete, onDelete }: { wish: Wish; onSave: (wish: Wish) => void; onCancel: () => void; onComplete: () => void; onDelete: () => void }) => {
  const [title, setTitle] = useState(wish.title);
  const [nextStep, setNextStep] = useState(wish.nextStep);
  const [timeframe, setTimeframe] = useState<Timeframe>(timeframeFromDueDate(wish.actionDueOn));
  return <form className="wish-editor" onSubmit={(event) => { event.preventDefault(); if (title.trim()) onSave({ ...wish, title: title.trim(), nextStep: nextStep.trim(), actionDueOn: dueDateFor(timeframe) }); }}>
    <label htmlFor={`title-${wish.id}`}>やりたいこと</label><input id={`title-${wish.id}`} value={title} onChange={(event) => setTitle(event.target.value)} />
    <label htmlFor={`step-${wish.id}`}>次の一歩 <span>任意</span></label><input id={`step-${wish.id}`} value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder="例：行き方を調べる" />
    <fieldset><legend>いつ動き出す？</legend><div className="choice-row">{([["month", "今月"], ["year", "今年"], ["undecided", "未定"]] as const).map(([value, label]) => <label key={value} className={timeframe === value ? "selected" : ""}><input type="radio" name={`timeframe-${wish.id}`} checked={timeframe === value} onChange={() => setTimeframe(value)} />{label}</label>)}</div></fieldset>
    <div className="form-actions spread"><button className="text-button danger" type="button" onClick={onDelete}>削除</button><div><button className="text-button" type="button" onClick={onCancel}>閉じる</button><button className="small-primary" type="submit">保存</button></div></div>
    <button className="complete-button" type="button" onClick={onComplete}>達成にする</button>
  </form>;
};

export default App;
