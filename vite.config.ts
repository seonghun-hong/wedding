import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages에 올릴 때 저장소 이름이 wedding이면 base를 아래처럼 사용하세요.
// 루트 도메인/커스텀 도메인을 쓰면 base: "/" 로 바꾸세요.
export default defineConfig({
  plugins: [react()],
  base: "/wedding/",
});
