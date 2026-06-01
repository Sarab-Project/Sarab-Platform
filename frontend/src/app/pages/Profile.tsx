import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateUser } from '../services/api';
import { getErrorMessage } from '../services/error';
import { CheckCircle, AlertCircle, User } from 'lucide-react';

const ROLE_LABELS: Record<number, string> = { 0: 'Admin', 1: 'Contributor', 2: 'Researcher' };

export function Profile() {
  const { user, updateUser: updateAuthUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setEmail(user.email);
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaveLoading(true);
    setSaveSuccess(false);
    setSaveError('');
    try {
      await updateUser(user.id, { firstName, lastName, email });
      updateAuthUser({ firstName, lastName, email });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Failed to save changes'));
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters');
      return;
    }
    setPwLoading(true);
    setPwSuccess(false);
    setPwError('');
    try {
      await updateUser(user.id, { password: newPassword });
      setPwSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      setPwError(getErrorMessage(err, 'Failed to update password'));
    } finally {
      setPwLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Please sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6">
          <h2 className="mb-1 font-bold">Profile Settings</h2>
          <p className="text-muted-foreground">Manage your account information</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Info */}
            <div className="border border-border rounded-xl bg-card p-6">
              <h3 className="mb-5 font-semibold">Personal Information</h3>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                      required
                      minLength={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Role</label>
                  <input
                    type="text"
                    value={user.role}
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-muted cursor-not-allowed text-muted-foreground"
                    disabled
                  />
                  <p className="text-xs text-muted-foreground mt-1">Contact an administrator to change your role</p>
                </div>

                {saveError && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle size={14} /> {saveError}
                  </div>
                )}
                {saveSuccess && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle size={14} /> Profile updated successfully!
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-6 py-2.5 rounded-lg transition-colors text-white font-medium disabled:opacity-60"
                  style={{ backgroundColor: '#9481ff' }}
                >
                  {saveLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>

            {/* Change Password */}
            <div className="border border-border rounded-xl bg-card p-6">
              <h3 className="mb-5 font-semibold">Change Password</h3>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your new password"
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                    required
                  />
                </div>

                {pwError && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle size={14} /> {pwError}
                  </div>
                )}
                {pwSuccess && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle size={14} /> Password updated successfully!
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pwLoading}
                  className="px-6 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors font-medium disabled:opacity-60"
                >
                  {pwLoading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="border border-border rounded-xl bg-card p-6 text-center">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold text-white"
                style={{ backgroundColor: '#9481ff' }}
              >
                {user.firstName?.[0]?.toUpperCase() || 'U'}
              </div>
              <h3 className="font-semibold mb-0.5">{user.firstName} {user.lastName}</h3>
              <div
                className="inline-block px-3 py-1 rounded-full text-xs font-medium mt-2"
                style={{ backgroundColor: '#f8f7ff', color: '#9481ff', border: '1px solid #b8b8fe' }}
              >
                {user.role}
              </div>
            </div>

            <div className="border border-border rounded-xl bg-card p-6">
              <h3 className="font-semibold mb-4">Account Info</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-start text-sm gap-2">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium text-right break-all">{user.email}</span>
                </div>
                <div className="flex justify-between items-start text-sm gap-2">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium">{user.role}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
