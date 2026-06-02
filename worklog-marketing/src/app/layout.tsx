import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Impactly AI | AI Self-Appraisal Generator & Weekly Work Log",
  description: "Stop stressing over annual appraisals. Impactly AI captures your weekly achievements, highlights your key metrics, and generates promotion-ready, structured self-evaluations automatically. 100% private and secure.",
  keywords: [
    "self appraisal generator",
    "AI self appraisal",
    "performance review generator",
    "work log software",
    "self evaluation examples",
    "employee appraisal software",
    "accomplishment tracker",
    "yearly review AI",
    "brag document software"
  ],
  authors: [{ name: "Impactly AI Team" }],
  robots: "index, follow",
  openGraph: {
    title: "Impactly AI | AI Self-Appraisal Generator & Weekly Work Log",
    description: "Stop stressing over annual appraisals. Impactly AI captures your weekly achievements, highlights your key metrics, and generates promotion-ready, structured self-evaluations automatically.",
    url: "https://impactlyai.com",
    siteName: "Impactly AI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Impactly AI | AI Self-Appraisal Generator & Weekly Work Log",
    description: "Stop stressing over annual appraisals. Impactly AI captures your weekly achievements, highlights your key metrics, and generates promotion-ready, structured self-evaluations automatically.",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth" suppressHydrationWarning>
      <body
        className={`${jakarta.variable} font-sans bg-[#0a0a0f] text-slate-100 min-h-full flex flex-col antialiased`}
      >
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-HW2VQ27KDY"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-HW2VQ27KDY');
          `}
        </Script>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
