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
};

export const metadata: Metadata = {
  metadataBase: new URL("https://impactlyai.com"),
  title: {
    default: "Impactly AI | AI Self-Appraisal Generator & Weekly Work Log",
    template: "%s | Impactly AI",
  },
  description: "Stop stressing over annual appraisals. Impactly AI captures your weekly achievements, highlights your key metrics, and generates promotion-ready, structured self-evaluations automatically. 100% private and secure.",
  authors: [{ name: "Impactly AI Team", url: "https://impactlyai.com" }],
  creator: "Impactly AI",
  publisher: "Impactly AI",
  applicationName: "Impactly AI",
  category: "Productivity",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    other: [{ rel: "mask-icon", url: "/favicon.svg", color: "#6366f1" }],
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://impactlyai.com",
    siteName: "Impactly AI",
    title: "Impactly AI | AI Self-Appraisal Generator & Weekly Work Log",
    description: "Stop stressing over annual appraisals. Impactly AI captures your weekly achievements, highlights your key metrics, and generates promotion-ready, structured self-evaluations automatically.",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Impactly AI — AI Self-Appraisal Generator",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Impactly AI | AI Self-Appraisal Generator & Weekly Work Log",
    description: "Stop stressing over annual appraisals. Impactly AI captures your weekly achievements and drafts promotion-ready self-evaluations in seconds.",
    images: ["/og-default.png"],
    creator: "@impactlyai",
  },
  other: {
    "theme-color": "#0a0a0f",
    "msapplication-TileColor": "#0a0a0f",
    "msapplication-TileImage": "/mstile-150x150.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://app.impactlyai.com" />
        <link rel="dns-prefetch" href="https://app.impactlyai.com" />
      </head>
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
