import { Outlet, Link, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Upload, Database, Shield, Info, Users } from 'lucide-react';
import { ThemeToggle } from './ui/theme-toggle';

export function Layout() {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await logout();
    navigate('/signin');
  };

  const isActive = (path: string) =>
    location.pathname === path
      ? 'text-primary font-medium bg-primary/10 dark:bg-primary/20 shadow-sm'
      : 'text-foreground hover:text-primary';

  const roleLabel = user?.role || '';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/favicon.png" alt="Sarab logo" className="w-8 h-8 rounded-lg object-cover" />
              <span className="text-xl tracking-tight font-semibold text-[#9481ff]">Sarab</span>
            </Link>

            {isAuthenticated && (
              <nav className="hidden md:flex items-center gap-1">
                <Link to="/" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive('/')}`}>
                  <Database size={15} />
                  Database
                </Link>
                {(user?.role === 'Admin' || user?.role === 'Contributor') && (
                  <>
                    <Link to="/upload" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive('/upload')}`}>
                      <Upload size={15} />
                      Upload
                    </Link>
                    <Link to="/my-uploads" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive('/my-uploads')}`}>
                      <User size={15} />
                      My Uploads
                    </Link>
                  </>
                )}
                {user?.role === 'Admin' && (
                  <Link to="/admin" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive('/admin')}`}>
                    <Shield size={15} />
                    Admin
                  </Link>
                )}
                <Link to="/groups" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive('/groups')}`}>
                  <Users size={15} />
                  Groups
                </Link>
                <Link to="/about" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive('/about')}`}>
                  <Info size={15} />
                  About
                </Link>
              </nav>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isLoading ? (
              <div className="w-8 h-8 rounded-full border-2 border-primary-light border-t-primary animate-spin" />
            ) : isAuthenticated && user ? (
              <>
                <Link to="/profile" className="flex items-center gap-2.5 group">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-medium group-hover:text-primary transition-colors">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">{roleLabel}</div>
                  </div>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white bg-[#9481ff]"
                  >
                    {user.firstName?.[0]?.toUpperCase() || 'U'}
                  </div>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <LogOut size={14} />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/signup"
                  className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Sign Up
                </Link>
                <Link
                  to="/signin"
                  className="px-4 py-2 text-sm rounded-lg transition-colors text-primary-foreground bg-primary hover:bg-primary/90"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <Outlet />
    </div>
  );
}