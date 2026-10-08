import type { Metadata, Viewport } from "next";
import { Inter, Krub, Roboto_Mono } from "next/font/google";
import { CommandPalette } from "@/components/command/command-palette";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE } from "@/lib/site";
import { THEME_COLOR, THEME_INIT_SCRIPT } from "@/lib/theme";
import { HotkeysProvider } from "@/providers/hotkeys-provider";
import { MotionProvider } from "@/providers/motion-provider";
import { QueryProvider } from "@/providers/query-provider";
import { StoreHydrator } from "@/providers/store-hydrator";
import "./globals.css";

// Inter for headings, Krub for text, Roboto Mono for figures and labels. Which one
// each class uses is decided in globals.css (--font-heading, --font-sans, --font-mono).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap", // a variable font: every weight from one file
});

const krub = Krub({
  variable: "--font-krub",
  subsets: ["latin"],
  weight: ["400", "500", "600"], // the three the UI uses (normal, medium, semibold)
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name}: ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Light is the server-rendered default. The inline script below adds the
    // `dark` class for a saved dark preference before first paint, hence
    // suppressHydrationWarning.
    <html
      lang="en"
      // CSS makes in-page scrolling smooth; this tells Next to still jump to the top
      // instantly on route changes (Next 16 stopped doing that on its own).
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${inter.variable} ${krub.variable} ${robotoMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <noscript>
          <style>{`[data-count="idle"]{opacity:1}`}</style>
        </noscript>
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-btn-primary focus:px-3 focus:py-2 focus:text-body-md focus:font-semibold focus:text-btn-primary-text"
        >
          Skip to content
        </a>
        <MotionProvider>
          <QueryProvider>
            <TooltipProvider>
              <StoreHydrator />
              <CommandPalette />
              <HotkeysProvider />
              <Header />
              <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
                {children}
              </main>
              <Footer />
            </TooltipProvider>
          </QueryProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
