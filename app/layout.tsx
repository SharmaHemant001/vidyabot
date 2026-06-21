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
  title: 'VidyaBot 🧠 | AI Tutor for Bharat',
  description: 'Free AI tutor for Indian students Class 6-12. Ask doubts in Hindi, Tamil, Bengali via text, photo or voice.',
  openGraph: {
    title: 'VidyaBot — AI Doubt Solving Tutor for Bharat',
    description: 'Free multilingual AI tutor for 250M+ Indian students. Ask in your language, get explained — not just answered.',
    url: 'https://vidyabot-zeta.vercel.app',
    siteName: 'VidyaBot',
    images: [
      {
        url: 'https://vidyabot-zeta.vercel.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'VidyaBot — AI Tutor for Bharat',
      }
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VidyaBot — AI Tutor for Bharat',
    description: 'Free multilingual AI tutor for Indian students. Text, photo, or voice doubts in 22 Indian languages.',
    images: ['https://vidyabot-zeta.vercel.app/og-image.png'],
  },
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

