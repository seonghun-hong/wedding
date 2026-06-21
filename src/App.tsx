import { useEffect, useState } from "react";
import "./styles/invitation.css";

import { HeroSection } from "./components/HeroSection";
import { IntroSection } from "./components/IntroSection";
import { CalendarSection } from "./components/CalendarSection";
import { GallerySection } from "./components/GallerySection";
import { LocationSection } from "./components/LocationSection";
import { AccountSection } from "./components/AccountSection";
import { GuestbookSection } from "./components/GuestbookSection";
import {
  PhotoUploadSection,
  PhotoUploadPage,
  MyPhotosPage,
} from "./components/PhotoUploadSection";
import { FooterSection } from "./components/FooterSection";

function App() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash);
      window.scrollTo(0, 0);
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  if (route === "#upload") {
    return (
      <main className="page">
        <PhotoUploadPage />
      </main>
    );
  }

  if (route === "#my-photos") {
    return (
      <main className="page">
        <MyPhotosPage />
      </main>
    );
  }

  return (
    <main className="page">
      <HeroSection />
      <IntroSection />
      <CalendarSection />
      <GallerySection />
      <LocationSection />
      <AccountSection />
      <GuestbookSection />
      <PhotoUploadSection />
      <FooterSection />
    </main>
  );
}

export default App;