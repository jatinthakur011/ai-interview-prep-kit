import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/useAuth";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "AI Interview Prep Kit",
  description: "Turn a job description into a personalised interview preparation kit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <AuthProvider>
          <NavBar />
          <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
