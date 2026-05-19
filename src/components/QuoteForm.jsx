import { useState } from "react";
import { PHONE_HREF, PHONE } from "../data/cities";

export default function QuoteForm({ city = "" }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", service: "", city: city, message: "" });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ "form-name": "quote", ...form }).toString(),
      });
      setSent(true);
    } catch {
      setSent(true);
    }
    setBusy(false);
  };

  const inp = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid var(--border)",
    borderRadius: 4,
    fontSize: "1rem",
    fontFamily: "Georgia, serif",
    background: "var(--white)",
    color: "var(--text)",
    outline: "none",
  };

  const lbl = {
    display: "block",
    fontWeight: "bold",
    marginBottom: 6,
    fontSize: "0.9rem",
    color: "var(--black)",
  };

  if (sent) {
    return (
      <div style={{ textAlign: "center", padding: "40px 24px", background: "rgba(245,166,35,0.08)", borderRadius: 8, border: "1px solid rgba(245,166,35,0.3)" }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>✓</div>
        <h3 style={{ fontSize: "1.3rem", marginBottom: 8 }}>Request Received</h3>
        <p style={{ color: "#555", marginBottom: 20 }}>We'll call you back within 1 business hour. For faster response:</p>
        <a href={PHONE_HREF} className="btn-primary">{PHONE}</a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} name="quote" data-netlify="true" netlify-honeypot="bot-field" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <input type="hidden" name="form-name" value="quote" />
      <p hidden><label>Don't fill this out: <input name="bot-field" /></label></p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={lbl}>Name *</label>
          <input required style={inp} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Your name" />
        </div>
        <div>
          <label style={lbl}>Phone *</label>
          <input required type="tel" style={inp} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(404) 555-0100" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={lbl}>Email</label>
          <input type="email" style={inp} value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@email.com" />
        </div>
        <div>
          <label style={lbl}>Service</label>
          <select style={{ ...inp, cursor: "pointer" }} value={form.service} onChange={e => set("service", e.target.value)}>
            <option value="">Select a service</option>
            <option>Commercial Parking Lot</option>
            <option>Residential Driveway</option>
            <option>Asphalt Sealcoating</option>
            <option>Crack Filling & Repair</option>
            <option>QSR / Restaurant Paving</option>
            <option>Lot Resurfacing</option>
            <option>Other</option>
          </select>
        </div>
      </div>
      <div>
        <label style={lbl}>City / Location</label>
        <input style={inp} value={form.city} onChange={e => set("city", e.target.value)} placeholder="Atlanta, GA" />
      </div>
      <div>
        <label style={lbl}>Project Details</label>
        <textarea style={{ ...inp, resize: "vertical", minHeight: 90 }} value={form.message} onChange={e => set("message", e.target.value)} placeholder="Approximate square footage, timeline, special requirements..." />
      </div>
      <button type="submit" disabled={busy} className="btn-primary" style={{ fontSize: "1.05rem", padding: "14px 28px", opacity: busy ? 0.7 : 1 }}>
        {busy ? "Sending..." : "Request Free Estimate"}
      </button>
      <p style={{ fontSize: "0.85rem", color: "#888", textAlign: "center" }}>
        Or call directly: <a href={PHONE_HREF} style={{ color: "var(--amber)", fontWeight: "bold" }}>{PHONE}</a> · Mon–Fri 7am–6pm
      </p>
    </form>
  );
}
