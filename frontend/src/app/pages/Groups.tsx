import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchGroups, fetchGroupById, createGroup, inviteGroupMembers, removeMember, deleteGroup, leaveGroup,
  fetchUserById, type Group, type GroupMember
} from '../services/api';
import {
  Users, Plus, ChevronRight, Loader, AlertCircle, X,
  UserMinus, Crown, ArrowLeft
} from 'lucide-react';

const MEMBER_ROLES: Record<number, string> = {
  0: 'Owner',
  1: 'Contributor',
  2: 'Researcher',
  3: 'Guest',
};

const ROLE_COLORS: Record<number, { bg: string; text: string }> = {
  0: { bg: '#fee2e2', text: '#dc2626' },
  1: { bg: '#f8f7ff', text: '#9481ff' },
  2: { bg: '#f0fdf4', text: '#16a34a' },
  3: { bg: '#f9fafb', text: '#6b7280' },
};

export function Groups() {
  const { user, isAuthenticated } = useAuth();
  const canCreateGroup = user?.role === 'Admin' || user?.role === 'Contributor' || user?.role === 'Researcher';
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  // Create group
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Remove member
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);

  // Invite member
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Leave / Delete
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchGroups();
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }

  async function openGroupDetail(groupId: number) {
    setDetailLoading(true);
    setCreatorName(null);
    try {
      const detail = await fetchGroupById(groupId);
      setSelectedGroup(detail);
      const memberCreator = detail.members?.find(m => m.user.id === detail.createdBy)?.user;
      if (memberCreator) {
        setCreatorName(`${memberCreator.firstName} ${memberCreator.lastName}`);
      } else {
        try {
          const createdByUser = await fetchUserById(detail.createdBy);
          setCreatorName(`${createdByUser.firstName} ${createdByUser.lastName}`);
        } catch {
          setCreatorName(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load group details');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (newGroupName.length < 3) {
      setCreateError('Group name must be at least 3 characters.');
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    try {
      const newGroup = await createGroup({
        name: newGroupName,
        description: newGroupDesc || undefined,
        createdBy: user.id,
      });
      setGroups(prev => [...prev, newGroup]);
      setShowCreateForm(false);
      setNewGroupName('');
      setNewGroupDesc('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setCreateLoading(false);
    }
  }

  

  async function handleRemoveMember(userId: number) {
    if (!selectedGroup) return;
    if (!confirm('Remove this member from the group?')) return;
    setRemovingMemberId(userId);
    try {
      await removeMember(selectedGroup.id, userId);
      const updated = await fetchGroupById(selectedGroup.id);
      setSelectedGroup(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGroup) return;
    if (!inviteEmail.trim()) {
      setInviteError('Please enter a valid email address.');
      return;
    }

    setInviteLoading(true);
    setInviteError('');
    try {
      await inviteGroupMembers(selectedGroup.id, {
        members: [{ email: inviteEmail.trim(), role: 2 }],
      });
      const updated = await fetchGroupById(selectedGroup.id);
      setSelectedGroup(updated);
      setInviteEmail('');
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite user');
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleLeaveGroup() {
    if (!selectedGroup) return;
    if (!confirm('Are you sure you want to leave this group?')) return;
    setLeaving(true);
    try {
      await leaveGroup(selectedGroup.id);
      setSelectedGroup(null);
      await loadGroups();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to leave group');
    } finally {
      setLeaving(false);
    }
  }

  async function handleDeleteGroup() {
    if (!selectedGroup) return;
    if (!confirm('Delete this group? This action cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteGroup(selectedGroup.id);
      setSelectedGroup(null);
      await loadGroups();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete group');
    } finally {
      setDeleting(false);
    }
  }

  const isGroupOwner = (group: Group) => {
    if (!user) return false;
    const ownerMember = group.members?.find(m => m.role === 0);
    return ownerMember?.user.id === user.id;
  };

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            {selectedGroup ? (
              <div>
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
                >
                  <ArrowLeft size={14} />
                  Back to Groups
                </button>
                <h2 className="font-bold">{selectedGroup.name}</h2>
                {selectedGroup.description && (
                  <p className="text-muted-foreground">{selectedGroup.description}</p>
                )}
              </div>
            ) : (
              <div>
                <h2 className="mb-1 font-bold">Research Groups</h2>
                <p className="text-muted-foreground">Collaborate with researchers and contributors</p>
              </div>
            )}
          </div>
          {!selectedGroup && canCreateGroup && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors"
              style={{ backgroundColor: '#9481ff' }}
            >
              <Plus size={16} />
              Create Group
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Create Group Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold">Create New Group</h3>
                <button onClick={() => setShowCreateForm(false)}>
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Group Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    placeholder="e.g., Research Team Alpha"
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                    minLength={3}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Description</label>
                  <textarea
                    value={newGroupDesc}
                    onChange={e => setNewGroupDesc(e.target.value)}
                    placeholder="What does this group work on?"
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 min-h-20 resize-y"
                  />
                </div>
                {createError && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle size={13} /> {createError}
                  </p>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 px-4 py-2.5 rounded-lg text-white font-medium disabled:opacity-60"
                    style={{ backgroundColor: '#9481ff' }}
                  >
                    {createLoading ? 'Creating...' : 'Create Group'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Groups List */}
        {!selectedGroup && (
          <>
            {loading && (
              <div className="text-center py-16">
                <Loader size={32} className="mx-auto text-[#9481ff] animate-spin mb-3" />
                <p className="text-muted-foreground">Loading groups...</p>
              </div>
            )}

            {!loading && groups.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
                <Users size={48} className="mx-auto text-muted-foreground mb-4 opacity-40" />
                <h3 className="font-semibold mb-2">No groups yet</h3>
                <p className="text-muted-foreground mb-6">Create a group to collaborate with other researchers.</p>
                {canCreateGroup && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="px-6 py-3 rounded-xl font-medium text-white"
                    style={{ backgroundColor: '#9481ff' }}
                  >
                    Create First Group
                  </button>
                )}
              </div>
            )}

            {!loading && groups.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map(group => (
                  <div
                    key={group.id}
                    onClick={() => openGroupDetail(group.id)}
                    className="border border-border rounded-xl bg-card p-5 hover:shadow-md transition-all cursor-pointer hover:border-[#9481ff]/50 group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: '#f8f7ff', color: '#9481ff' }}
                      >
                        <Users size={20} />
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground group-hover:text-[#9481ff] transition-colors mt-1" />
                    </div>
                    <h3 className="font-semibold mb-1 group-hover:text-[#9481ff] transition-colors">{group.name}</h3>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{group.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-3 border-t border-border">
                      <span>{group.members?.length || 0} members</span>
                      <span>•</span>
                      <span>{new Date(group.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Group Detail */}
        {selectedGroup && (
          <div>
            {detailLoading ? (
              <div className="text-center py-16">
                <Loader size={32} className="mx-auto text-[#9481ff] animate-spin mb-3" />
                <p className="text-muted-foreground">Loading group details...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Members */}
                <div className="border border-border rounded-xl bg-card p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Users size={18} className="text-[#9481ff]" />
                      Members ({selectedGroup.members?.length || 0})
                    </h3>
                  </div>

                  {!selectedGroup.members || selectedGroup.members.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No members yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedGroup.members.map((member: GroupMember) => (
                        <div
                          key={member.user.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                              style={{ backgroundColor: '#9481ff' }}
                            >
                              {member.user.firstName?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className="text-sm font-medium flex items-center gap-1.5">
                                {member.user.firstName} {member.user.lastName}
                                {member.role === 0 && <Crown size={12} className="text-amber-500" />}
                              </div>
                              <div className="text-xs text-muted-foreground">{member.user.email}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs px-2.5 py-1 rounded-full font-medium"
                              style={ROLE_COLORS[member.role] || ROLE_COLORS[3]}
                            >
                              {MEMBER_ROLES[member.role] || 'Unknown'}
                            </span>
                            {isGroupOwner(selectedGroup) && member.role !== 0 && (
                              <button
                                onClick={() => handleRemoveMember(member.user.id)}
                                disabled={removingMemberId === member.user.id}
                                className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1"
                              >
                                {removingMemberId === member.user.id
                                  ? <Loader size={13} className="animate-spin" />
                                  : <UserMinus size={13} />
                                }
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isGroupOwner(selectedGroup) && (
                  <div className="border border-border rounded-xl bg-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Invite Member</h3>
                      <span className="text-xs text-muted-foreground">Invite by email</span>
                    </div>
                    <form onSubmit={handleInviteMember} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Email address</label>
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          placeholder="user@example.com"
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                          required
                        />
                      </div>
                      {inviteError && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle size={13} /> {inviteError}
                        </p>
                      )}
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={inviteLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-[#9481ff] hover:bg-[#7c6ff6] disabled:opacity-60"
                        >
                          {inviteLoading ? 'Inviting...' : 'Invite Member'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Group Info */}
                <div className="border border-border rounded-xl bg-card p-6">
                  <h3 className="font-semibold mb-4">Group Information</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Group ID</span>
                      <span className="font-medium">#{selectedGroup.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created By</span>
                      <span className="font-medium">{creatorName ?? 'Unknown user'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created At</span>
                      <span className="font-medium">{new Date(selectedGroup.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Members</span>
                      <span className="font-medium">{selectedGroup.members?.length || 0}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-3">
                    {isGroupOwner(selectedGroup) ? (
                      <button
                        onClick={handleDeleteGroup}
                        disabled={deleting}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium disabled:opacity-60"
                      >
                        {deleting ? 'Deleting...' : 'Delete Group'}
                      </button>
                    ) : (
                      isAuthenticated && selectedGroup.members?.some(m => m.user.id === user?.id) && (
                        <button
                          onClick={handleLeaveGroup}
                          disabled={leaving}
                          className="px-4 py-2 rounded-lg bg-yellow-600 text-white font-medium disabled:opacity-60"
                        >
                          {leaving ? 'Leaving...' : 'Leave Group'}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
