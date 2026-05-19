import { Link } from "react-router-dom";
import { PHONE, PHONE_HREF, SERVICES, CITIES } from "../data/cities";
import QuoteForm from "../components/QuoteForm";

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 60%, #0f0f0f 100%)",
        color: "var(--white)",
        padding: "80px 24px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(245,166,35,0.03) 40px, rgba(245,166,35,0.03) 80px)" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "inline-block", background: "var(--amber)", color: "var(--black)", padding: "6px 16px", borderRadius: 20, fontSize: "0.85rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 24 }}>
            📍 Atlanta, Georgia &amp; Statewide
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", marginBottom: 16, lineHeight: 1.2 }}>
            Atlanta's Commercial<br /><span style={{ color: "var(--amber)" }}>Paving &amp; Sealing Specialists</span>
          </h1>
          <p style={{ fontSize: "1.15rem", color: "rgba(255,255,255,0.8)", maxWidth: 600, margin: "0 auto 32px" }}>
            100+ QSR locations paved across Georgia. Serving Atlanta metro, Savannah, Augusta, and statewide. Commercial parking lots, residential driveways, and sealcoating.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={PHONE_HREF} className="btn-primary">Get a Free Estimate</a>
            <a href="#services" className="btn-outline">Our Services</a>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div style={{ background: "var(--amber)", padding: "16px 24px", display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
        {["✓ 100+ QSR Locations Paved","✓ Commercial & Residential","✓ Georgia Licensed & Insured","✓ Free Estimates"].map(t => (
          <span key={t} style={{ color: "var(--black)", fontWeight: "bold", fontSize: "0.9rem" }}>{t}</span>
        ))}
      </div>

      {/* QSR SECTION */}
      <section style={{ background: "linear-gradient(135deg, #8B0000 0%, #c0392b 100%)", color: "white", padding: "64px 24px", textAlign: "center" }}>
        <div className="container">
          <h2 style={{ color: "white", fontSize: "clamp(1.8rem, 4vw, 3rem)", marginBottom: 16 }}>Georgia's QSR Paving Authority</h2>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.1rem", maxWidth: 700, margin: "0 auto 40px" }}>
            We've paved over 100 quick service restaurant locations across Atlanta and Georgia — including the iconic 2017 Marietta Big Chicken parking lot. When QSR franchise operators need paving done right, on time, and to spec, they call us.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20, maxWidth: 800, margin: "0 auto" }}>
            {[["100+","QSR Locations Paved"],["12+","States Served"],["2017","Big Chicken Marietta"],["40+","Years Experience"]].map(([num, lbl]) => (
              <div key={lbl} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: 24 }}>
                <span style={{ fontSize: "2.5rem", fontWeight: "bold", color: "var(--amber)", display: "block" }}>{num}</span>
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>{lbl}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services">
        <div className="container">
          <h2>Asphalt Paving &amp; Sealing Services</h2>
          <p className="lead">Full-service paving and sealing for commercial and residential clients across Atlanta and Georgia.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginTop: 32 }}>
            {SERVICES.map(s => (
              <div key={s.title} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 32, borderLeft: "4px solid var(--amber)", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: 12 }}>{s.icon} {s.title}</h3>
                <p style={{ color: "#666" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LOCATIONS */}
      <section id="locations" style={{ background: "var(--light-gray)" }}>
        <div className="container">
          <h2>Atlanta Metro &amp; Georgia Service Areas</h2>
          <p className="lead">Serving the full Atlanta metro and statewide Georgia commercial projects.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 32 }}>
            {CITIES.map(c => (
              <Link key={c.slug} to={`/${c.slug}`} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, textDecoration: "none", color: "var(--text)", transition: "all 0.2s", display: "block" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                <h3 style={{ fontSize: "1rem", color: "var(--black)", marginBottom: 4 }}>{c.name}</h3>
                <p style={{ fontSize: "0.85rem", color: "#888" }}>{c.sub}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section style={{ background: "var(--black)" }}>
        <div className="container">
          <h2 style={{ color: "var(--white)" }}>40+ Years. 12+ States. 100+ QSR Locations.</h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "1.1rem", lineHeight: 1.8, marginBottom: 20 }}>We've been paving commercial and residential properties since 1984. Our Georgia operation is built on a foundation of real project history — not promises. When KFC franchise operators needed their parking lots paved to corporate specs across the Atlanta metro, they called us. When the iconic Marietta Big Chicken needed its parking lot rebuilt in 2017, we did it.</p>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "1.1rem", lineHeight: 1.8 }}>Licensed. Insured. Free estimates. Call {PHONE}.</p>
        </div>
      </section>

      {/* QUOTE FORM */}
      <section id="quote" style={{ background: "var(--light-gray)" }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <h2 style={{ textAlign: "center" }}>Get a Free Estimate</h2>
          <p className="lead" style={{ textAlign: "center" }}>Commercial or residential — we provide free detailed estimates for all Atlanta and Georgia paving projects.</p>
          <QuoteForm />
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "var(--amber)", textAlign: "center", padding: "80px 24px" }}>
        <div className="container">
          <h2 style={{ color: "var(--black)", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", marginBottom: 16 }}>Ready to Get Your Project Done?</h2>
          <p style={{ color: "rgba(0,0,0,0.7)", fontSize: "1.1rem", marginBottom: 36 }}>Commercial or residential — we provide free detailed estimates for all Atlanta and Georgia paving projects.</p>
          <a href={PHONE_HREF} className="btn-dark">📞 Call {PHONE}</a>
        </div>
      </section>
    </>
  );
}
