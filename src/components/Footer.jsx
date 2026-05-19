import { Link } from "react-router-dom";
import { PHONE, PHONE_HREF, CITIES } from "../data/cities";

const topCities = ["Atlanta","Marietta","Roswell","Alpharetta","Savannah","Augusta","Buckhead"];

export default function Footer() {
  return (
    <footer style={{ background: "var(--black)", color: "rgba(255,255,255,0.6)", padding: "48px 24px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 40, maxWidth: 1100, margin: "0 auto 40px" }}>
        <div>
          <h4 style={{ color: "var(--amber)", marginBottom: 16, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: 1 }}>
            Atlanta Paving &amp; Sealing
          </h4>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", lineHeight: 1.8 }}>
            Professional asphalt paving and sealing serving Atlanta, Georgia and statewide.
          </p>
          <p style={{ marginTop: 12, color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>
            Est. 1984 · 4th Generation · Licensed &amp; Insured
          </p>
        </div>
        <div>
          <h4 style={{ color: "var(--amber)", marginBottom: 16, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: 1 }}>Services</h4>
          {["Commercial Parking Lots","QSR & Restaurant Paving","Residential Driveways","Asphalt Sealcoating","Crack Filling & Repair"].map(s => (
            <Link key={s} to="/#services" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", lineHeight: 1.8, display: "block", textDecoration: "none" }}
              onMouseEnter={e => e.target.style.color="var(--amber)"} onMouseLeave={e => e.target.style.color="rgba(255,255,255,0.6)"}>
              {s}
            </Link>
          ))}
        </div>
        <div>
          <h4 style={{ color: "var(--amber)", marginBottom: 16, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: 1 }}>Service Areas</h4>
          {topCities.map(name => {
            const city = CITIES.find(c => c.name === name);
            return city ? (
              <Link key={name} to={`/${city.slug}`} style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", lineHeight: 1.8, display: "block", textDecoration: "none" }}
                onMouseEnter={e => e.target.style.color="var(--amber)"} onMouseLeave={e => e.target.style.color="rgba(255,255,255,0.6)"}>
                {name}
              </Link>
            ) : null;
          })}
        </div>
        <div>
          <h4 style={{ color: "var(--amber)", marginBottom: 16, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: 1 }}>Contact</h4>
          <a href={PHONE_HREF} style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", lineHeight: 1.8, display: "block", textDecoration: "none" }}
            onMouseEnter={e => e.target.style.color="var(--amber)"} onMouseLeave={e => e.target.style.color="rgba(255,255,255,0.6)"}>
            {PHONE}
          </a>
          <p style={{ marginTop: 12, color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>
            Mon–Fri 7am–6pm<br />Sat 7am–2pm<br />24/7 Emergency Response
          </p>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 24, textAlign: "center", fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", maxWidth: 1100, margin: "0 auto" }}>
        <p>© {new Date().getFullYear()} Atlanta Paving &amp; Sealing · Serving Atlanta &amp; Georgia · All Rights Reserved</p>
      </div>
    </footer>
  );
}
