import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "./components/Header";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StarkBet — Bitcoin-Native Private Prediction Markets",
  description: "Privacy-first prediction markets powered by Bitcoin collateral and ZK proofs on Starknet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#080B10] text-white`}>
        <Providers>
          <Header />
          <main className="w-full min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
