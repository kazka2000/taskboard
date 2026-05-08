import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Board } from './features/Board';
import { Admin } from './pages/Admin';
import { Header } from './components/Header';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import './App.css';

import { AcceptInvite } from './pages/AcceptInvite';
import { PublicBoard } from './pages/PublicBoard';

import { LanguageProvider } from './context/LanguageContext';

function App() {
  return (
    <Router>
      <ToastProvider>
        <LanguageProvider>
          <ProjectProvider>
            <NotificationProvider>
              <Routes>
                <Route path="/public/:token" element={<PublicBoard />} />
                <Route path="/invite/:token" element={<AcceptInvite />} />
                <Route path="/*" element={<AuthWrapper />} />
              </Routes>
            </NotificationProvider>
          </ProjectProvider>
        </LanguageProvider>
      </ToastProvider>
    </Router>
  );
}

function AuthWrapper() {
  const { currentUser } = useProject();

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div className="app-container">
      <Header />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/project/:projectId" element={<Board />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
}

export default App;
