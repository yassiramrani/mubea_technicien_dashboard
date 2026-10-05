import type { Metadata } from 'next'
import './globals.css'
import Providers from './Providers'
import Sidebar from './Sidebar'

export const metadata: Metadata = {
  title: 'Mubea Maintenance Inventory',
  description: 'Mubea Maintenance Inventory: manage technicians, tools, labels and reports',
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
