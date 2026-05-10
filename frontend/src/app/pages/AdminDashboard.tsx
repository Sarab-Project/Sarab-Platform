import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchUsers, fetchSamples, fetchCollections, fetchGroups,
  updateUser, deleteUser, type UserPublic, type Sample, type Collection, type Group
} from '../services/api';
import {
  Users, Layers, Database, Shield, Loader, AlertCircle,
  Trash2, Edit, Check, X, RefreshCw, ChevronDown
} from 'lucide-react';

const ROLE_MAP: Record<number, string> = { 0: 'Admin', 1: 'Contributor', 2: 'Researcher' };
const ROLE_COLORS: Record<number, { bg: string; text: string }> = {
  0: { bg: '#fee2e2', text: '#dc2626' },
  1: { bg: '#f8f7ff', text: '#9481ff' },
  2: { bg: '#f0fdf4', text: '#16a34a' },
};

export function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'collections' | 'groups'>('overview');

  // Data
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit user state
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState<number>(2);
  const [editLoading, setEditLoading] = useState(false);

  // Delete state
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/signin'); return; }
    if (user?.role !== 'Admin') { navigate('/'); return; }
    loadAllData();
  }, [isAuthenticated, user]);

  async function loadAllData() {
    setLoading(true);
    setError('');
    try {
      const [u, s, c, g] = await Promise.allSettled([
        fetchUsers(),
        fetchSamples(),
        fetchCollections(),
        fetchGroups(),
      ]);
      if (u.status === 'fulfilled') setUsers(u.value);
      if (s.status === 'fulfilled') setSamples(s.value);
      if (c.status === 'fulfilled') setCollections(c.value);
      if (g.status === 'fulfilled') setGroups(g.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const handleRoleUpdate = async (userId: number) => {
    setEditLoading(true);
    try {
      await updateUser(userId, { role: editRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: editRole } : u));
      setEditingUserId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    setDeletingUserId(userId);
    try {
      await deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <Database size={15} /> },
    { key: 'users', label: 'Users', icon: <Users size={15} /> },
    { key: 'collections', label: 'Collections', icon: <Layers size={15} /> },
    { key: 'groups', label: 'Groups', icon: <Users size={15} /> },
  ] as const;

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="mb-1 font-bold flex items-center gap-2">
              <Shield size={22} className="text-[#9481ff]" />
              Admin Dashboard
            </h2>
            <p className="text-muted-foreground">Manage users, collections, and platform settings</p>
          </div>
          <button
            onClick={loadAllData}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-[#9481ff] text-[#9481ff]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-16">
            <Loader size={32} className="mx-auto text-[#9481ff] animate-spin mb-3" />
            <p className="text-muted-foreground">Loading data...</p>
          </div>
        )}

        {!loading && activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Samples', value: samples.length, icon: <Database size={20} /> },
                { label: 'Total Users', value: users.length, icon: <Users size={20} /> },
                { label: 'Collections', value: collections.length, icon: <Layers size={20} /> },
                { label: 'Groups', value: groups.length, icon: <Users size={20} /> },
              ].map(stat => (
                <div key={stat.label} className="border border-border rounded-xl bg-card p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-[#9481ff] opacity-70">{stat.icon}</div>
                  </div>
                  <div className="text-3xl font-bold mb-1" style={{ color: '#9481ff' }}>{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Recent users */}
            <div className="border border-border rounded-xl bg-card p-6">
              <h3 className="font-semibold mb-4">Recent Users</h3>
              {users.slice(0, 5).map(u => (
                <div key={u.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
                    style={{ backgroundColor: '#9481ff' }}
                  >
                    {u.firstName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.firstName} {u.lastName}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={ROLE_COLORS[u.role] || ROLE_COLORS[2]}
                  >
                    {ROLE_MAP[u.role] || 'Unknown'}
                  </span>
                </div>
              ))}
            </div>

            {/* Recent samples */}
            <div className="border border-border rounded-xl bg-card p-6">
              <h3 className="font-semibold mb-4">Recent Samples</h3>
              {samples.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.files?.length || 0} files • {new Date(s.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  {s.status && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: '#f8f7ff', color: '#9481ff', border: '1px solid #b8b8fe' }}
                    >
                      {s.status}
                    </span>
                  )}
                </div>
              ))}
              {samples.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No samples yet.</p>
              )}
            </div>
          </div>
        )}

        {!loading && activeTab === 'users' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-muted-foreground">{users.length} user{users.length !== 1 ? 's' : ''}</div>
            </div>

            {users.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
                <Users size={40} className="mx-auto text-muted-foreground opacity-40 mb-3" />
                <p className="text-muted-foreground">No users found.</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border" style={{ backgroundColor: '#f8f7ff' }}>
                      <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Email</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Role</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Joined</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                              style={{ backgroundColor: '#9481ff' }}
                            >
                              {u.firstName?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="text-sm font-medium">{u.firstName} {u.lastName}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{u.email}</td>
                        <td className="px-6 py-4">
                          {editingUserId === u.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={editRole}
                                onChange={e => setEditRole(parseInt(e.target.value))}
                                className="text-xs px-2 py-1 border border-border rounded bg-input-background"
                              >
                                <option value={0}>Admin</option>
                                <option value={1}>Contributor</option>
                                <option value={2}>Researcher</option>
                              </select>
                              <button
                                onClick={() => handleRoleUpdate(u.id)}
                                disabled={editLoading}
                                className="text-green-600 hover:text-green-700 disabled:opacity-50"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <span
                              className="text-xs px-2.5 py-1 rounded-full font-medium"
                              style={ROLE_COLORS[u.role] || ROLE_COLORS[2]}
                            >
                              {ROLE_MAP[u.role] || 'Unknown'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: u.isActive ? '#f0fdf4' : '#fef2f2',
                              color: u.isActive ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {u.id !== user?.id && (
                              <>
                                <button
                                  onClick={() => { setEditingUserId(u.id); setEditRole(u.role); }}
                                  className="flex items-center gap-1 text-xs px-2.5 py-1 border border-border rounded hover:bg-muted transition-colors"
                                >
                                  <Edit size={11} />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  disabled={deletingUserId === u.id}
                                  className="flex items-center gap-1 text-xs px-2.5 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                                >
                                  {deletingUserId === u.id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                  Delete
                                </button>
                              </>
                            )}
                            {u.id === user?.id && (
                              <span className="text-xs text-muted-foreground italic">(you)</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'collections' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-muted-foreground">{collections.length} collection{collections.length !== 1 ? 's' : ''}</div>
            </div>

            {collections.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
                <Layers size={40} className="mx-auto text-muted-foreground opacity-40 mb-3" />
                <p className="text-muted-foreground">No collections yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {collections.map(c => (
                  <div key={c.id} className="border border-border rounded-xl bg-card p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">{c.name}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Owner: {c.ownerType === 0 ? `User #${c.ownerId}` : `Group #${c.ownerId}`}
                          {' '} • Created {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: '#f8f7ff', color: '#9481ff', border: '1px solid #b8b8fe' }}
                      >
                        {c.ownerType === 0 ? 'Personal' : 'Group'}
                      </span>
                    </div>
                    {c.description && (
                      <p className="text-sm text-muted-foreground mb-2">{c.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{c.folders?.length || 0} folders</span>
                      <span>{c.downloadCount || 0} downloads</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'groups' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-muted-foreground">{groups.length} group{groups.length !== 1 ? 's' : ''}</div>
            </div>

            {groups.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
                <Users size={40} className="mx-auto text-muted-foreground opacity-40 mb-3" />
                <p className="text-muted-foreground">No groups yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups.map(g => (
                  <div key={g.id} className="border border-border rounded-xl bg-card p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold">{g.name}</h3>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#f8f7ff', color: '#9481ff', border: '1px solid #b8b8fe' }}
                      >
                        {g.members?.length || 0} members
                      </span>
                    </div>
                    {g.description && (
                      <p className="text-sm text-muted-foreground mb-3">{g.description}</p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(g.createdAt).toLocaleDateString()} • By user #{g.createdBy}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
