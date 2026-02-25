"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletBar } from "./WalletBar";

const NAV = [
    { href: "/markets", label: "Markets" },
    { href: "/portfolio", label: "Portfolio" },
];

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function Header() {
    const pathname = usePathname();

    return (
        <header className="w-full border-b border-white/[0.06] bg-[#080B10] sticky top-0 z-20">
            <div className="w-full max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">

                {/* Left: wordmark + nav */}
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex flex-col leading-tight group">
                        <span className="text-white font-bold text-base group-hover:text-orange-400 transition-colors">StarkBet</span>
                        <span className="text-gray-600 text-[11px]">Bitcoin-Native · ZK-Private · Starknet</span>
                    </Link>

                    <nav className="flex items-center gap-1">
                        {NAV.map(({ href, label }) => {
                            const active = pathname === href || pathname.startsWith(href + "/");
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${active
                                            ? "text-white bg-white/[0.06]"
                                            : "text-gray-500 hover:text-gray-200"
                                        }`}
                                >
                                    {label}
                                </Link>
                            );
                        })}
                    </nav>

                    {DEMO && (
                        <span className="sr-only">Demo Mode active</span>
                    )}
                </div>

                {/* Right: wallet bar */}
                <WalletBar />
            </div>
        </header>
    );
}
