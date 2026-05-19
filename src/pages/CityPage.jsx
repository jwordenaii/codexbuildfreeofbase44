import { useParams, Link, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { CITIES, SERVICES, PHONE, PHONE_HREF } from "../data/cities";
import QuoteForm from "../components/QuoteForm";

export default function CityPage() {
  const { slug } = useParams();
  const city = CITIES.find(c => c.slug === slug);

  useEffect(() => {
    if (city) {
      document.title = city.metaTitle;
      const meta = document.querySelector("meta[name='description']");
      if (meta) meta.setAttribute("content", city.metaDesc);
    }
    window.scrollTo(0, 0);
  }, [city]);

  if (!city) return <Navigate to="/" replace />;

  return (
    <>
      {/* BREADCRUMB */}
      <div style={{ padding: "14px 24px", background: "var(--light-gray)", fontSize: "0.9rem" }}>
        <div className="container">
          <Link to="/" style={{ color: "var(--amber)", textDecoration: "none" }}>Home</Link>
          {" → "}{city.name} Asphalt Paving
        </div>
      </div>

      {/* HERO */}
      <section style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)", color: "var(--white)", padding: "80px 24px", textAlign: "center" }}>
        {city.highlight && (
          <div style={{ display: "inline-block", background: "var(--red)", color: "white", padding: "6px 16px", borderRadius: 20, fontSize: "0.85rem", fontWeight: "bold", marginBottom: 12 }}>
            {city.highlight}
          </div>
        )}
        <div style={{ display: "inline-block", background: "var(--amber)", color: "var(--black)", padding: "6px 16px", borderRadius: 20, fontSize: "0.85rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 24 }}>
          📍 {city.badge}
        </div>
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", marginBottom: 16 }}>
          Asphalt Paving &amp;<br /><span style={{ color: "var(--amber)" }}>Sealing in {city.name}</span>
        </h1>
        <p style={{ fontSize: "1.1rem", color: "rgba(255,255,255,0.8)", maxWidth: 600, margin: "0 auto 32px" }}>
          {city.lead1.split(".")[0]}. 40+ years of Georgia paving expertise. Free estimates.
        </p>
        <a href={PHONE_HREF} className="btn-primary">Get a Free Estimate</a>
      </section>

      {/* TRUST BAR */}
      <div style={{ background: "var(--amber)", padding: "14px 24px", display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
        {["✓ 100+ QSR Locations Paved","✓ Commercial & Residential","✓ Georgia Licensed & Insured","✓ Free Estimates"].map(t => (
          <span key={t} style={{ color: "var(--black)", fontWeight: "bold", fontSize: "0.9rem" }}>{t}</span>
        ))}
      </div>

      {/* CONTENT */}
      <section>
        <div className="container" style={{ maxWidth: 900 }}>
          <h2>Professional Paving in {city.name}, Georgia</h2>
          <p className="lead">{city.lead1}</p>
          <p className="lead">{city.lead2}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginTop: 32 }}>
            {SERVICES.map(s => (
              <div key={s.title} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 24, borderLeft: "4px solid var(--amber)" }}>
                <h3 style={{ fontSize: "1.1rem", marginBottom: 10 }}>{s.icon} {s.title}</h3>
                <p style={{ color: "#666", fontSize: "0.95rem" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section style={{ background: "var(--light-gray)" }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <h2>Why {city.name} Chooses Atlanta Paving &amp; Sealing</h2>
          <p className="lead">{city.why}</p>
        </div>
      </section>

      {/* QUOTE FORM */}
      <section id="quote">
        <div className="container" style={{ maxWidth: 720 }}>
          <h2 style={{ textAlign: "center" }}>Free Estimate for Your {city.name} Project</h2>
          <p className="lead" style={{ textAlign: "center" }}>Submit your project details and we'll call back within 1 business hour.</p>
          <QuoteForm city={`${city.name}, GA`} />
        </div>
      </section>

      {/* NEARBY */}
      <section style={{ background: "var(--light-gray)" }}>
        <div className="container">
          <h2>Other Georgia Service Areas</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 24 }}>
            {CITIES.filter(c => c.slug !== slug).slice(0, 8).map(c => (
              <Link key={c.slug} to={`/${c.slug}`} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px", textDecoration: "none", color: "var(--text)", transition: "border-color 0.2s, color 0.2s", display: "block" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.querySelector("h3").style.color = "var(--amber)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.querySelector("h3").style.color = "var(--black)"; }}>
                <h3 style={{ fontSize: "0.95rem", color: "var(--black)", marginBottom: 2, transition: "color 0.2s" }}>{c.name}</h3>
                <p style={{ fontSize: "0.8rem", color: "#888" }}>{c.county}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "var(--amber)", textAlign: "center", padding: "64px 24px" }}>
        <div className="container">
          <h2 style={{ color: "var(--black)", marginBottom: 16 }}>Ready to Get Your {city.name} Project Started?</h2>
          <p style={{ color: "rgba(0,0,0,0.7)", marginBottom: 32 }}>Free estimates · Licensed &amp; insured · Georgia's QSR paving authority</p>
          <a href={PHONE_HREF} className="btn-dark">📞 Call {PHONE}</a>
        </div>
      </section>
    </>
  );
}
