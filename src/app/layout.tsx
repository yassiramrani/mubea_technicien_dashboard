import type { Metadata } from 'next'
import './globals.css'
import Providers from './Providers'
import Sidebar from './Sidebar'

export const metadata: Metadata = {
  title: 'Mubea Workshop Tool Tracking',
  description:
    'Mubea Workshop Tool Tracking: follow which workshop tool is out, who has it and since when',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
        <div className="app-container">
          <Sidebar />
          <main id="main-content" className="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
        </Providers>
      </body>
    </html>
  )
}
