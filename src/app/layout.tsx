import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Poppins, Fraunces } from "next/font/google";
import ScrollToTop from "@/components/public/ScrollToTop";
import { ThemeProvider } from "@/components/public/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-poppins', 
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  title: {
    template: "%s | BPR Adiartha Reksacitra",
    default: "BPR Adiartha Reksacitra - Your Trusted Financial Partner",
  },
  description: "Your trusted financial partner for a brighter future. Explore our range of banking services, from savings and loans to investment solutions, designed to help you achieve your financial goals with confidence.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={` ${poppins.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider // <html Ini Penting: akan menambahkan class="dark" ke <html> sesuai dengan globals.css Anda
          attribute="class"
          defaultTheme="system" // Bisa diganti "light" atau "dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <ScrollToTop />
        </ThemeProvider>
        
      </body>
    </html>
  );
}
