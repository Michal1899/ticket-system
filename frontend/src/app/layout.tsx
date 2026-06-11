import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "System Biletowy",
  description: "Bezpieczny system rezerwacji biletów w czasie rzeczywistym",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="container">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
