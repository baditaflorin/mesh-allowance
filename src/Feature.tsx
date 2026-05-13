import { useEffect, useMemo, useState } from "react";
import type { MeshConfig, YRoom } from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Kid = { name: string; balance: number };
type ChoreStatus = "todo" | "pending" | "verified";
type Chore = { kidId: string; label: string; value: number; status: ChoreStatus };

const newId = () => Math.random().toString(36).slice(2, 10);

export function Feature({ room }: Props) {
  if (!room) {
    return (
      <div className="all-screen">
        <h1>allowance</h1>
        <p className="all-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} />;
}

function Body({ room }: { room: YRoom }) {
  const [newKidName, setNewKidName] = useState("");
  const [newChoreLabel, setNewChoreLabel] = useState<Record<string, string>>({});
  const [newChoreValue, setNewChoreValue] = useState<Record<string, string>>({});
  const [tick, rerender] = useState(0);

  useEffect(() => {
    const kids = room.doc.getMap<Kid>("kids");
    const chores = room.doc.getMap<Chore>("chores");
    const onChange = () => rerender((n) => n + 1);
    kids.observe(onChange);
    chores.observe(onChange);
    return () => {
      kids.unobserve(onChange);
      chores.unobserve(onChange);
    };
  }, [room]);

  const kids = room.doc.getMap<Kid>("kids");
  const chores = room.doc.getMap<Chore>("chores");

  const kidList = useMemo(() => {
    const arr: Array<Kid & { id: string }> = [];
    kids.forEach((v, k) => arr.push({ ...v, id: k }));
    arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, tick]);

  const choresByKid = useMemo(() => {
    const m = new Map<string, Array<Chore & { id: string }>>();
    chores.forEach((v, k) => {
      const list = m.get(v.kidId) ?? [];
      list.push({ ...v, id: k });
      m.set(v.kidId, list);
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, tick]);

  const addKid = (e: React.FormEvent) => {
    e.preventDefault();
    const n = newKidName.trim();
    if (!n) return;
    kids.set(newId(), { name: n, balance: 0 });
    setNewKidName("");
  };

  const removeKid = (kidId: string) => {
    room.doc.transact(() => {
      kids.delete(kidId);
      chores.forEach((c, k) => {
        if (c.kidId === kidId) chores.delete(k);
      });
    });
  };

  const addChore = (kidId: string) => {
    const label = (newChoreLabel[kidId] ?? "").trim();
    const value = Number(newChoreValue[kidId] ?? "");
    if (!label || !Number.isFinite(value) || value <= 0) return;
    chores.set(newId(), { kidId, label, value: Math.round(value * 100) / 100, status: "todo" });
    setNewChoreLabel((m) => ({ ...m, [kidId]: "" }));
    setNewChoreValue((m) => ({ ...m, [kidId]: "" }));
  };

  const markPending = (choreId: string) => {
    const c = chores.get(choreId);
    if (!c || c.status !== "todo") return;
    chores.set(choreId, { ...c, status: "pending" });
  };

  const unmark = (choreId: string) => {
    const c = chores.get(choreId);
    if (!c || c.status !== "pending") return;
    chores.set(choreId, { ...c, status: "todo" });
  };

  const verify = (choreId: string) => {
    const c = chores.get(choreId);
    if (!c || c.status !== "pending") return;
    const kid = kids.get(c.kidId);
    if (!kid) return;
    room.doc.transact(() => {
      kids.set(c.kidId, { ...kid, balance: Math.round((kid.balance + c.value) * 100) / 100 });
      chores.set(choreId, { ...c, status: "verified" });
    });
  };

  const reject = (choreId: string) => {
    const c = chores.get(choreId);
    if (!c || c.status !== "pending") return;
    chores.set(choreId, { ...c, status: "todo" });
  };

  const removeChore = (choreId: string) => chores.delete(choreId);

  const cashOut = (kidId: string) => {
    const kid = kids.get(kidId);
    if (!kid || kid.balance <= 0) return;
    if (!confirm(`Cash out $${kid.balance.toFixed(2)} for ${kid.name}?`)) return;
    kids.set(kidId, { ...kid, balance: 0 });
  };

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="all-screen">
      <header className="all-header">
        <h1>allowance</h1>
        <p className="all-status">
          {kidList.length} {kidList.length === 1 ? "kid" : "kids"} · {room.peerCount + 1} present
        </p>
      </header>

      <form className="all-add-kid" onSubmit={addKid}>
        <input
          value={newKidName}
          onChange={(e) => setNewKidName(e.target.value)}
          placeholder="add a kid by name"
          maxLength={48}
        />
        <button type="submit" disabled={!newKidName.trim()}>
          + add kid
        </button>
      </form>

      <section className="all-kids">
        {kidList.length === 0 ? (
          <p className="all-empty">no kids yet — add one above</p>
        ) : (
          kidList.map((kid) => {
            const myChores = choresByKid.get(kid.id) ?? [];
            const pending = myChores.filter((c) => c.status === "pending");
            const todo = myChores.filter((c) => c.status === "todo");
            const verified = myChores.filter((c) => c.status === "verified");
            return (
              <article key={kid.id} className="all-kid">
                <header className="all-kid-head">
                  <div className="all-kid-name">
                    <strong>{kid.name}</strong>
                  </div>
                  <div className="all-kid-balance">
                    <span className="all-balance-amt">${fmt(kid.balance)}</span>
                    <button
                      type="button"
                      className="all-cashout"
                      onClick={() => cashOut(kid.id)}
                      disabled={kid.balance <= 0}
                    >
                      cash out
                    </button>
                  </div>
                </header>

                {pending.length > 0 && (
                  <div className="all-chore-group all-pending">
                    <h3>awaiting verification</h3>
                    {pending.map((c) => (
                      <div key={c.id} className="all-chore">
                        <span className="all-chore-label">{c.label}</span>
                        <span className="all-chore-value">+${fmt(c.value)}</span>
                        <button
                          type="button"
                          className="all-btn all-btn-verify"
                          onClick={() => verify(c.id)}
                        >
                          ✓ verify
                        </button>
                        <button type="button" className="all-btn" onClick={() => reject(c.id)}>
                          reject
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {todo.length > 0 && (
                  <div className="all-chore-group all-todo">
                    <h3>to do</h3>
                    {todo.map((c) => (
                      <div key={c.id} className="all-chore">
                        <span className="all-chore-label">{c.label}</span>
                        <span className="all-chore-value">+${fmt(c.value)}</span>
                        <button
                          type="button"
                          className="all-btn all-btn-done"
                          onClick={() => markPending(c.id)}
                        >
                          mark done
                        </button>
                        <button
                          type="button"
                          className="all-btn"
                          onClick={() => removeChore(c.id)}
                          aria-label={`remove ${c.label}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {pending.length === 0 && todo.length === 0 && (
                  <p className="all-empty-sub">no open chores</p>
                )}

                <form
                  className="all-add-chore"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addChore(kid.id);
                  }}
                >
                  <input
                    value={newChoreLabel[kid.id] ?? ""}
                    onChange={(e) => setNewChoreLabel((m) => ({ ...m, [kid.id]: e.target.value }))}
                    placeholder="chore (e.g. take out trash)"
                    maxLength={80}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={newChoreValue[kid.id] ?? ""}
                    onChange={(e) => setNewChoreValue((m) => ({ ...m, [kid.id]: e.target.value }))}
                    placeholder="$"
                    aria-label="value"
                  />
                  <button
                    type="submit"
                    disabled={
                      !(newChoreLabel[kid.id] ?? "").trim() || !Number(newChoreValue[kid.id] ?? "")
                    }
                  >
                    + add chore
                  </button>
                </form>

                <details className="all-history">
                  <summary>verified history ({verified.length})</summary>
                  {verified.length === 0 ? (
                    <p className="all-empty-sub">none yet</p>
                  ) : (
                    <ul>
                      {verified.map((c) => (
                        <li key={c.id}>
                          <span>{c.label}</span>
                          <span>+${fmt(c.value)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>

                <button
                  type="button"
                  className="all-kid-rm"
                  onClick={() => removeKid(kid.id)}
                  aria-label={`remove ${kid.name}`}
                >
                  remove kid
                </button>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
