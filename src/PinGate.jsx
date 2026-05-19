import { useState, useEffect, useRef } from "react";

/**
 * Server-side 4-digit PIN gate.
 *
 * The PIN is NOT in this bundle. We POST it to /api/auth/login which checks
 * the value server-side (env var `WS_PIN`) and, on success, sets a signed
 * HttpOnly session cookie. /api/jarvis verifies that cookie before forwarding.
 */
export default function PinGate({ children }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // On mount: ask server if we already have a valid session.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setUnlocked(true);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!checking && !unlocked) refs[0].current?.focus();
  }, [checking, unlocked]);

  if (checking) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#08090e", color: "#8b91a3",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        fontSize: 13, zIndex: 99999,
      }}>Checking session…</div>
    );
  }
  if (unlocked) return children;

  const submit = async (code) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ pin: code }),
      });
      if (r.ok) {
        setUnlocked(true);
        return;
      }
      setError(r.status === 503 ? "Auth not configured" : "Incorrect PIN");
    } catch {
      setError("Network error");
    }
    setShake(true);
    setTimeout(() => {
      setDigits(["", "", "", ""]);
      setShake(false);
      setBusy(false);
      refs[0].current?.focus();
    }, 400);
  };

  const setDigit = (i, val) => {
    const v = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    setError("");
    if (v && i < 3) refs[i + 1].current?.focus();
    if (next.every((d) => d !== "")) submit(next.join(""));
  };

  const onKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs[i - 1].current?.focus();
  };

  const onPaste = (e) => {
    const pasted = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;
    e.preventDefault();
    const next = pasted.padEnd(4, "").split("").slice(0, 4);
    while (next.length < 4) next.push("");
    setDigits(next);
    if (next.every((d) => d !== "")) submit(next.join(""));
    else refs[Math.min(pasted.length, 3)].current?.focus();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#08090e", color: "#f5f5f5",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", zIndex: 99999,
    }}>
      <div style={{
        width: "min(360px, 90vw)", padding: "32px 28px",
        background: "#11131a", border: "1px solid #1f2330", borderRadius: 12,
        textAlign: "center",
        animation: shake ? "ws-pin-shake 0.4s ease" : "none",
      }}>
        <style>{`@keyframes ws-pin-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}50%{transform:translateX(8px)}75%{transform:translateX(-4px)}}`}</style>
        <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600 }}>The Worden Standard</h1>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#8b91a3" }}>
          Internal access. Enter your 4-digit PIN to continue.
        </p>
        <div onPaste={onPaste} style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={d}
              disabled={busy}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              aria-label={`PIN digit ${i + 1}`}
              style={{
                width: 56, height: 64, fontSize: 28, textAlign: "center",
                background: "#0b0d14", color: "#f5f5f5",
                border: `1px solid ${error ? "#c0392b" : "#2a3040"}`,
                borderRadius: 8, outline: "none",
              }}
            />
          ))}
        </div>
        <div style={{ minHeight: 18, fontSize: 13, color: "#c0392b" }}>{error}&nbsp;</div>
      </div>
    </div>
  );
}
