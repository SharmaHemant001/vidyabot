import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { UserProvider } from "@/context/UserContext";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "VidyaBot 🧠 | Speak your doubt. Hear the answer. In your own language.",
  description: "VidyaBot is a patient, multilingual AI tutor for Indian school students in Class 6-12. Ask doubts in your regional language via text, notebook photo, or voice and get step-by-step explanations.",
  keywords: "VidyaBot, AI Tutor, Indian School Education, Multilingual AI, Doubt Solving, Class 6-12, Bharat AI, Education Technology",
  authors: [{ name: "VidyaBot Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${plusJakarta.variable} ${plusJakarta.className} antialiased min-h-screen bg-[#0D1B2A] text-white selection:bg-[#0D9488] selection:text-white`}
      >
        <UserProvider>
          <div className="animate-fade-in min-h-screen flex flex-col">
            {children}
          </div>
        </UserProvider>
      </body>
    </html>
  );
}

