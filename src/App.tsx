import { useEffect, useState } from "react";
import "./styles/invitation.css";

import { HeroSection } from "./components/HeroSection";
import { IntroSection } from "./components/IntroSection";
import { CalendarSection } from "./components/CalendarSection";
import { GallerySection } from "./components/GallerySection";
import { LocationSection } from "./components/LocationSection";
import { AccountSection } from "./components/AccountSection";
import { GuestbookSection } from "./components/GuestbookSection";
import { AdminGuestbookPage } from "./components/AdminGuestbookPage";
import {
  PhotoUploadSection,
  PhotoUploadPage,
  MyPhotosPage,
  AdminPhotosPage,
} from "./components/PhotoUploadSection";
import { FooterSection } from "./components/FooterSection";

function App() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash);
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });

      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, [route]);

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

  if (route === "#admin") {
    return (
      <main className="page">
        <AdminPhotosPage />
      </main>
    );
  }

  if (route === "#admin-guestbook") {
    return (
      <main className="page">
        <AdminGuestbookPage />
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