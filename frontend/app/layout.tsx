"use client";

import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Provider } from "react-redux";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth-provider";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { PageSpinner } from "@/components/ui/page-spinner";
import { store } from "@/store";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>West Texas Pain Institute</title>
        <meta
          name="description"
          content="West Texas Pain Institute"
        />
        <link rel="icon" href="/halo-icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/halo-icon.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Provider store={store}>
          <Suspense fallback={<PageSpinner />}>
            <AuthProvider>
              <LayoutWrapper>{children}</LayoutWrapper>
            </AuthProvider>
          </Suspense>
        </Provider>
        <Toaster />
      </body>
    </html>
  );
}
