import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import CityPage from "./pages/CityPage";

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/:slug" element={<CityPage />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
