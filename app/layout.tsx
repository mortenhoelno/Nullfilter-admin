// app/layout.tsx

export const metadata = {
  title: "Nullfilter Admin",
  description: "Adminside for chatbotens dokumentopplasting",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body style={{ margin: 0, padding: 0, fontFamily: "Arial, sans-serif" }}>{children}</body>
    </html>
  )
}
