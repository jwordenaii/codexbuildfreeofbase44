import { Link } from "react-router-dom";
import { PHONE, PHONE_HREF } from "../data/cities";

export default function Nav() {
  return (
    <nav style={{
      background: "var(--black)",
      padding: "0 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 70,
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <Link to="/" style={{
        color: "var(--amber)",
        fontSize: "1.1rem",
        fontWeight: "bold",
        textDecoration: "none",
      }}>
        Atlanta Paving &amp; Sealing
      </Link>
      <a href={PHONE_HREF} style={{
        color: "var(--black)",
        textDecoration: "none",
        fontWeight: "bold",
        background: "var(--amber)",
        padding: "10px 20px",
        borderRadius: 4,
      }}>
        📞 {PHONE}
      </a>
    </nav>
  );
}
