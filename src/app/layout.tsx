import type { Metadata } from 'next'
import './globals.css'
import Providers from './Providers'
import Sidebar from './Sidebar'

export const metadata: Metadata = {
  title: 'Mubea Technician Dashboard',
  description: 'Manage technicians and tools',
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
          <main className="main-content">
            {children}
          </main>
        </div>
        </Providers>
      </body>
    </html>
  )
}
