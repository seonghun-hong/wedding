import { HeroSection } from "./components/HeroSection";
import { IntroSection } from "./components/IntroSection";
import { CalendarSection } from "./components/CalendarSection";
import { GallerySection } from "./components/GallerySection";
import { LocationSection } from "./components/LocationSection";
import { AccountSection } from "./components/AccountSection";
import { GuestbookSection } from "./components/GuestbookSection";
import { PhotoUploadSection } from "./components/PhotoUploadSection";
import { FooterSection } from "./components/FooterSection";

export default function App() {
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
