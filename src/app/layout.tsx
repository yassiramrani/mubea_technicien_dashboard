import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'
import { Wrench, Users, QrCode, FileText } from 'lucide-react'

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
        <div className="app-container">
          <aside className="sidebar">
            <div>
              <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Mubea</h2>
              <p className="text-muted" style={{ fontSize: '0.875rem' }}>Tool Management</p>
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Link href="/" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                <Users size={18} /> Technicians
              </Link>
              <Link href="/tools" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                <Wrench size={18} /> Tools
              </Link>
              <Link href="/scanner" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                <QrCode size={18} /> Scanner
              </Link>
              <Link href="/logs" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                <FileText size={18} /> Logs & Reports
              </Link>
            </nav>
          </aside>
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
