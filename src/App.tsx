import React, { useState, useEffect, lazy, Suspense } from 'react';
import { NetworkProvider, useNetwork } from './context/NetworkContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { FirstRunSetup } from './views/FirstRunSetup';
import { DeviceRoleSetup } from './views/DeviceRoleSetup';
import { LoginView } from './views/LoginView';
import { Problem } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpdateNotification } from './components/UpdateNotification';

// Code-split heavy views to eliminate initial bundle lag and memory bloat
const StudentDashboard = lazy(() => import('./views/Student/StudentDashboard').then(m => ({ default: m.StudentDashboard })));
const ProblemDetail = lazy(() => import('./views/Student/ProblemDetail').then(m => ({ default: m.ProblemDetail })));
const ContestsView = lazy(() => import('./views/Student/ContestsView').then(m => ({ default: m.ContestsView })));
const SubmissionsHistory = lazy(() => import('./views/Student/SubmissionsHistory').then(m => ({ default: m.SubmissionsHistory })));
const LeaderboardView = lazy(() => import('./views/Student/LeaderboardView').then(m => ({ default: m.LeaderboardView })));
const BadgesView = lazy(() => import('./views/Student/BadgesView').then(m => ({ default: m.BadgesView })));

const ProblemManager = lazy(() => import('./views/Teacher/ProblemManager').then(m => ({ default: m.ProblemManager })));
const ContestManager = lazy(() => import('./views/Teacher/ContestManager').then(m => ({ default: m.ContestManager })));
const StudentManager = lazy(() => import('./views/Teacher/StudentManager').then(m => ({ default: m.StudentManager })));
const LiveMonitor = lazy(() => import('./views/Teacher/LiveMonitor').then(m => ({ default: m.LiveMonitor })));
const PlagiarismView = lazy(() => import('./views/Teacher/PlagiarismView').then(m => ({ default: m.PlagiarismView })));
const ClassManager = lazy(() => import('./views/Teacher/ClassManager').then(m => ({ default: m.ClassManager })));
const StatisticsView = lazy(() => import('./views/Teacher/StatisticsView').then(m => ({ default: m.StatisticsView })));
const JudgeSettings = lazy(() => import('./views/Teacher/JudgeSettings').then(m => ({ default: m.JudgeSettings })));

const ViewLoadingFallback = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '14px', color: 'var(--text-muted)' }}>
    <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Đang tải phân hệ...</div>
  </div>
);

const MainApp: React.FC = () => {
  const { user, role, isFirstRun, isLoading } = useAuth();
  const [deviceRole, setDeviceRole] = useState<'host' | 'student' | null>(() => {
    return (localStorage.getItem('schooljudge_device_role') as any) || null;
  });
  const [activeTab, setActiveTab] = useState<string>(role === 'host' ? 'contests-manage' : 'contests');
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);

  useEffect(() => {
    if ((window as any).electronAPI?.getAppRole) {
      (window as any).electronAPI.getAppRole().then((r: any) => {
        if (r && !deviceRole) {
          setDeviceRole(r);
          localStorage.setItem('schooljudge_device_role', r);
        }
      });
    }
  }, []);

  // Set appropriate default tab when user logs in or role changes
  useEffect(() => {
    if (role === 'host') {
      setActiveTab('contests-manage');
    } else {
      setActiveTab('contests');
    }
  }, [role, user?.id]);

  const handleSelectProblem = (problem: Problem) => {
    setSelectedProblem(problem);
    setActiveTab('problem-detail');
  };

  const handleBackToProblems = () => {
    setSelectedProblem(null);
    setActiveTab('contests');
  };

  // 0. Device Role Selection (Server vs Client) for internal LAN labs
  if (!deviceRole) {
    return <DeviceRoleSetup onSelectRole={(r) => setDeviceRole(r)} />;
  }

  if (isLoading) {
    return <ViewLoadingFallback />;
  }

  // 1. First-Run Setup Screen ONLY for Host/Teacher machine when no admin exists yet
  if (deviceRole === 'host' && isFirstRun) {
    return <FirstRunSetup />;
  }

  // 2. Login Screen if not authenticated
  if (!user) {
    return <LoginView />;
  }

  // 3. Authenticated App Layout (Role is determined automatically)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="app-container">
        <Suspense fallback={<ViewLoadingFallback />}>
          {/* Student Views (User Role) - Primary area is Contests & Exams */}
          {role === 'user' && (
            <>
              {(activeTab === 'contests' || activeTab === 'problems') && (
                <ContestsView />
              )}
              {activeTab === 'problem-detail' && selectedProblem && (
                <ProblemDetail problem={selectedProblem} onBack={handleBackToProblems} />
              )}
              {activeTab === 'leaderboard' && <LeaderboardView />}
              {activeTab === 'submissions' && <SubmissionsHistory />}
              {activeTab === 'badges' && <BadgesView />}
            </>
          )}

          {/* Teacher / Host Views (Host Role) */}
          {role === 'host' && (
            <>
              {activeTab === 'problems-manage' && <ProblemManager />}
              {activeTab === 'contests-manage' && (
                <ErrorBoundary fallbackTitle="Đã xảy ra sự cố trong Quản Lý Kỳ Thi">
                  <ContestManager />
                </ErrorBoundary>
              )}
              {activeTab === 'students' && <StudentManager />}
              {activeTab === 'live-monitor' && <LiveMonitor />}
              {activeTab === 'leaderboard' && <LeaderboardView />}
              {activeTab === 'anti-cheat' && <PlagiarismView />}
              {activeTab === 'classes' && <ClassManager />}
              {activeTab === 'statistics' && <StatisticsView />}
              {activeTab === 'settings' && <JudgeSettings />}
            </>
          )}
        </Suspense>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary fallbackTitle="Đã xảy ra sự cố trong ứng dụng">
      <NetworkProvider>
        <AuthProvider>
          <MainApp />
          {/* Auto-Update: Runs everywhere including before login & startup */}
          <UpdateNotification />
        </AuthProvider>
      </NetworkProvider>
    </ErrorBoundary>
  );
};

export default App;
