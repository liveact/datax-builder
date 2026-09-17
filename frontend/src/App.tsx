import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { isAuthenticated } from '@/api/auth'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BuilderPage } from '@/pages/BuilderPage'
import { LoginPage } from '@/pages/LoginPage'
import { BuilderProvider } from '@/stores/builder'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  return children
}

function RootRedirect() {
  return <Navigate to={isAuthenticated() ? '/builder' : '/login'} replace />
}

function AuthLogoutListener() {
  const navigate = useNavigate()
  useEffect(() => {
    const handler = () => navigate('/login', { replace: true })
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [navigate])
  return null
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <BuilderProvider>
          <AuthLogoutListener />
          <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/builder"
            element={
              <ProtectedRoute>
                <BuilderPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<RootRedirect />} />
          </Routes>
          <Toaster position="top-center" />
        </BuilderProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
