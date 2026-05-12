import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Folder, Users, Layers, LayoutGrid, Plus, UploadCloud, Search, Filter,
  ChevronRight, File, ArrowLeft, AlertCircle, Download, Loader, X,
  RefreshCw
} from 'lucide-react';
import {
  fetchSamples, fetchCollections, fetchGroups, fetchFolders,
  downloadSample, downloadSamples, downloadCollections, createCollection,
  triggerDownload, searchSamples, createFolder,
  type Sample as ApiSample, type Collection, type Folder as ApiFolder,
  type Group, type Tag
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type TabType = 'flat' | 'collections' | 'groups' | 'my-collection';

export function DatabaseView() {
  const [activeTab, setActiveTab] = useState<TabType>('flat');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const canManageContent = user?.role === 'Admin' || user?.role === 'Contributor';

  // API State
  const [samples, setSamples] = useState<ApiSample[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [folders, setFolders] = useState<ApiFolder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection State
  const [selectedSamples, setSelectedSamples] = useState<Set<number>>(new Set());
  const [downloadingAll, setDownloadingAll] = useState(false);

  // My Collection folder navigation
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);

  // Collection browsing state
  const [currentCollectionId, setCurrentCollectionId] = useState<number | null>(null);
  const [currentCollectionFolderId, setCurrentCollectionFolderId] = useState<number | null>(null);

  // Collection creation
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollName, setNewCollName] = useState('');
  const [newCollDesc, setNewCollDesc] = useState('');
  const [createCollLoading, setCreateCollLoading] = useState(false);
  const [createCollError, setCreateCollError] = useState('');

  // Folder creation
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [createFolderLoading, setCreateFolderLoading] = useState(false);
  const [createFolderError, setCreateFolderError] = useState('');

  // Search debounce
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [s, c, g, f, t] = await Promise.allSettled([
        fetchSamples(),
        fetchCollections(),
        fetchGroups(),
        fetchFolders(),
        fetchTags(),
      ]);
      if (s.status === 'fulfilled') setSamples(s.value);
      else if (s.status === 'rejected') setError(s.reason?.message || 'Failed to fetch samples');
      if (c.status === 'fulfilled') setCollections(c.value);
      if (g.status === 'fulfilled') setGroups(g.value);
      if (f.status === 'fulfilled') setFolders(f.value);
      if (t.status === 'fulfilled') setTags(t.value);
    } finally {
      setLoading(false);
    }
  }

  // Debounced search
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (searchTimeout) clearTimeout(searchTimeout);

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setShowSuggestions(false);
      setSuggestions([]);
      return;
    }

    // Generate suggestions
    const lowerQuery = trimmed.toLowerCase();
    const tagSuggestions = tags
      .filter(tag => tag.name.toLowerCase().includes(lowerQuery))
      .map(tag => tag.name)
      .slice(0, 5);

    const commonSuggestions = [
      'image', 'video', 'document',
      'male', 'female',
      'glaucoma', 'diabetic retinopathy', 'macular degeneration',
      'left', 'right'
    ].filter(s => s.includes(lowerQuery)).slice(0, 3);

    const allSuggestions = [...tagSuggestions, ...commonSuggestions].slice(0, 8);
    setSuggestions(allSuggestions);
    setShowSuggestions(allSuggestions.length > 0);

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      setShowSuggestions(false);
      try {
        const results = await searchSamples({ keyword: query, pageSize: 50 });
        setSamples(results);
      } catch {
        // Fallback to local filter
      } finally {
        setIsSearching(false);
      }
    }, 400);
    setSearchTimeout(timeout);
  };

  const handleClearSearch = async () => {
    setSearchQuery('');
    setIsSearching(true);
    try {
      const all = await fetchSamples();
      setSamples(all);
    } catch {
      // keep current
    } finally {
      setIsSearching(false);
    }
  };

  // Local filter on top of API search
  const filteredSamples = useMemo(() => {
    return samples.filter(s => {
      const matchesSearch = !searchQuery ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.status || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.gender || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.tags || []).some(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesGender = !filterGender || s.gender === filterGender;
      const matchesStatus = !filterStatus || (s.status || '').toLowerCase().includes(filterStatus.toLowerCase());
      return matchesSearch && matchesGender && matchesStatus;
    });
  }, [samples, searchQuery, filterGender, filterStatus]);

  // Folder breadcrumbs
  const currentFolderObj = folders.find(f => f.id === currentFolderId);
  const breadcrumbs = useMemo(() => {
    const crumbs: ApiFolder[] = [];
    let curr = currentFolderObj;
    while (curr) {
      crumbs.unshift(curr);
      const parentId = curr.parentId;
      curr = parentId ? folders.find(f => f.id === parentId) : undefined;
    }
    return crumbs;
  }, [currentFolderObj, folders]);

  const displayedFolders = folders.filter(f => f.parentId === currentFolderId);
  const displayedMySamples = samples.filter(s =>
    s.createdBy === user?.id && s.folderId === currentFolderId
  );

  // Collection browsing
  const currentCollection = collections.find(c => c.id === currentCollectionId);
  const collectionBreadcrumbs = useMemo(() => {
    if (!currentCollection) return [];
    const crumbs: ApiFolder[] = [];
    let curr = folders.find(f => f.id === currentCollectionFolderId);
    while (curr) {
      crumbs.unshift(curr);
      curr = curr.parentId ? folders.find(f => f.id === curr!.parentId) : undefined;
    }
    return crumbs;
  }, [currentCollection, currentCollectionFolderId, folders]);

  const displayedCollectionFolders = folders.filter(f =>
    f.collectionId === currentCollectionId && f.parentId === currentCollectionFolderId
  );
  const displayedCollectionSamples = samples.filter(s =>
    s.folderId === currentCollectionFolderId
  );

  const toggleSelection = (id: number) => {
    setSelectedSamples(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedSamples.size === filteredSamples.length) {
      setSelectedSamples(new Set());
    } else {
      setSelectedSamples(new Set(filteredSamples.map(s => s.id)));
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedSamples.size === 0) return;
    setDownloadingAll(true);
    try {
      const ids = Array.from(selectedSamples);
      if (ids.length === 1) {
        const blob = await downloadSample(ids[0]);
        const sample = samples.find(s => s.id === ids[0]);
        triggerDownload(blob, `${(sample?.title || 'sample').replace(/[^a-z0-9]/gi, '_')}.zip`);
      } else {
        const blob = await downloadSamples(ids);
        triggerDownload(blob, 'samples.zip');
      }
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreateCollLoading(true);
    setCreateCollError('');
    try {
      const coll = await createCollection({
        name: newCollName,
        description: newCollDesc || undefined,
        createdBy: user.id,
        ownerType: 0,
        ownerId: user.id,
      });
      setCollections(prev => [...prev, coll]);
      setShowCreateCollection(false);
      setNewCollName('');
      setNewCollDesc('');
    } catch (err) {
      setCreateCollError(err instanceof Error ? err.message : 'Failed to create collection');
    } finally {
      setCreateCollLoading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreateFolderLoading(true);
    setCreateFolderError('');

    const parentId = activeTab === 'my-collection' ? currentFolderId : currentCollectionFolderId;
    const collectionId = activeTab === 'my-collection'
      ? (user.role === 'Admin' ? null : collections.find(c => c.name === 'Private' && c.ownerId === user.id)?.id)
      : currentCollectionId;

    if (!collectionId) {
      setCreateFolderError('No collection selected');
      setCreateFolderLoading(false);
      return;
    }

    try {
      const folder = await createFolder({
        name: newFolderName,
        parentId: parentId || undefined,
        collectionId,
        createdBy: user.id,
      });
      setFolders(prev => [...prev, folder]);
      setShowCreateFolder(false);
      setNewFolderName('');
      setNewFolderDesc('');
    } catch (err) {
      setCreateFolderError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setCreateFolderLoading(false);
    }
  };

  const getFileTypeBadge = (sample: ApiSample) => {
    if (!sample.files?.length) return 'No files';
    const f = sample.files[0].fileName.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|bmp|webp)$/.test(f)) return 'Image';
    if (/\.(mp4|avi|mov|webm|mkv|flv|wmv|m4v)$/.test(f)) return 'Video';
    if (/\.(pdf|doc|docx|txt)$/.test(f)) return 'Document';
    return 'File';
  };

  return (
    <div className="flex flex-col bg-background">
      {/* Search + Tabs */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="text-center mb-8">
            <h2 className="mb-2 font-bold" style={{ fontSize: '1.75rem', color: '#9481ff' }}>
              Sarab Research Database
            </h2>
            <p className="text-muted-foreground mb-6">
              Explore, manage, and contribute to ophthalmic research
            </p>

            <div className="max-w-3xl mx-auto relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by title, condition, tags, city, gender, profession, notes..."
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  className="w-full px-5 py-4 pl-12 pr-10 border-2 rounded-xl bg-background shadow-sm focus:outline-none focus:ring-2 focus:ring-[#9481ff]/30 focus:border-[#9481ff] transition-all"
                  style={{ borderColor: '#b8b8fe' }}
                />
                {isSearching ? (
                  <Loader className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9481ff] animate-spin" size={20} />
                ) : (
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                )}
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSearchQuery(suggestion);
                        setShowSuggestions(false);
                        handleSearchChange(suggestion);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <Search size={16} className="inline mr-2" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1">
            <TabButton
              active={activeTab === 'flat'}
              onClick={() => setActiveTab('flat')}
              icon={<LayoutGrid size={16} />}
              label="Flat View"
            />
            <TabButton
              active={activeTab === 'collections' && !currentCollectionId}
              onClick={() => { setActiveTab('collections'); setCurrentCollectionId(null); setCurrentCollectionFolderId(null); }}
              icon={<Layers size={16} />}
              label="Collections"
            />
            <TabButton active={activeTab === 'groups'} onClick={() => setActiveTab('groups')} icon={<Users size={16} />} label="Groups" />
            {isAuthenticated && (
              <TabButton
                active={activeTab === 'my-collection'}
                onClick={() => { setActiveTab('my-collection'); setCurrentFolderId(null); }}
                icon={<Folder size={16} />}
                label="My Workspace"
              />
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <h3 className="font-medium text-red-900 mb-1 text-sm">Error Loading Data</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button onClick={loadData} className="text-red-600 hover:text-red-800 text-xs flex items-center gap-1">
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-20">
              <div className="inline-block w-12 h-12 border-4 border-[#b8b8fe] border-t-[#9481ff] rounded-full animate-spin mb-4" />
              <p className="text-muted-foreground">Loading database...</p>
            </div>
          )}

          {/* ─── FLAT VIEW ─── */}
          {!loading && activeTab === 'flat' && (
            <div className="animate-in fade-in duration-200">
              <div className="mb-5 flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-muted-foreground font-medium">
                    {filteredSamples.length} sample{filteredSamples.length !== 1 ? 's' : ''}
                  </span>
                  {selectedSamples.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: '#9481ff' }}>
                        {selectedSamples.size} selected
                      </span>
                      <button
                        onClick={handleDownloadSelected}
                        disabled={downloadingAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#9481ff] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
                      >
                        {downloadingAll ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
                        Download
                      </button>
                      <button
                        onClick={() => setSelectedSamples(new Set())}
                        className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {filteredSamples.length > 0 && (
                    <button
                      onClick={toggleSelectAll}
                      className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
                    >
                      {selectedSamples.size === filteredSamples.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                  <Filter size={14} className="text-muted-foreground" />
                  <select
                    value={filterGender}
                    onChange={e => setFilterGender(e.target.value)}
                    className="px-3 py-1.5 border border-border rounded-lg bg-card text-sm focus:outline-none"
                  >
                    <option value="">All Genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Filter condition..."
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="px-3 py-1.5 border border-border rounded-lg bg-card text-sm focus:outline-none w-36"
                  />
                </div>
              </div>

              {filteredSamples.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
                  <Search size={48} className="mx-auto text-muted-foreground mb-4 opacity-40" />
                  <h3 className="font-semibold mb-1">No samples found</h3>
                  <p className="text-muted-foreground text-sm">Try adjusting your search or filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredSamples.map(sample => (
                    <SampleCard
                      key={sample.id}
                      sample={sample}
                      fileTypeBadge={getFileTypeBadge(sample)}
                      onClick={() => navigate(`/sample/${sample.id}`)}
                      isSelected={selectedSamples.has(sample.id)}
                      onToggleSelection={() => toggleSelection(sample.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── COLLECTIONS ─── */}
          {!loading && activeTab === 'collections' && !currentCollectionId && (
            <div className="animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-5">
                <span className="text-sm text-muted-foreground font-medium">
                  {collections.length} collection{collections.length !== 1 ? 's' : ''}
                </span>
                {canManageContent && (
                  <button
                    onClick={() => setShowCreateCollection(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ backgroundColor: '#9481ff' }}
                  >
                    <Plus size={14} />
                    New Collection
                  </button>
                )}
              </div>

              {collections.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
                  <Layers size={48} className="mx-auto text-muted-foreground mb-4 opacity-40" />
                  <h3 className="font-semibold mb-1">No collections yet</h3>
                  <p className="text-muted-foreground text-sm">Collections will appear here once created.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {collections.map(collection => (
                    <div
                      key={collection.id}
                      onClick={() => { setCurrentCollectionId(collection.id); setCurrentCollectionFolderId(null); }}
                      className="border border-border rounded-xl bg-card p-6 hover:shadow-md transition-all cursor-pointer group hover:border-[#9481ff]/40"
                    >
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#f8f7ff' }}>
                        <Layers size={22} style={{ color: '#9481ff' }} className="group-hover:scale-110 transition-transform" />
                      </div>
                      <h3 className="font-semibold mb-1 group-hover:text-[#9481ff] transition-colors">{collection.name}</h3>
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{collection.description || 'No description'}</p>
                      <div className="flex items-center justify-between text-xs pt-4 border-t border-border">
                        <span className="font-medium" style={{ color: '#9481ff' }}>
                          {collection.folders?.length || 0} folders
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(collection.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create Collection Modal */}
              {showCreateCollection && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                  <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-bold">New Collection</h3>
                      <button onClick={() => setShowCreateCollection(false)}>
                        <X size={20} className="text-muted-foreground" />
                      </button>
                    </div>
                    <form onSubmit={handleCreateCollection} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={newCollName}
                          onChange={e => setNewCollName(e.target.value)}
                          placeholder="e.g., Retinal Disease Collection"
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Description</label>
                        <textarea
                          value={newCollDesc}
                          onChange={e => setNewCollDesc(e.target.value)}
                          placeholder="Optional description..."
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 min-h-20"
                        />
                      </div>
                      {createCollError && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle size={13} /> {createCollError}
                        </p>
                      )}
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setShowCreateCollection(false)}
                          className="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={createCollLoading}
                          className="flex-1 px-4 py-2.5 rounded-lg text-white font-medium disabled:opacity-60"
                          style={{ backgroundColor: '#9481ff' }}
                        >
                          {createCollLoading ? 'Creating...' : 'Create'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── COLLECTION FOLDER VIEW ─── */}
          {!loading && activeTab === 'collections' && currentCollectionId && (
            <div className="animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold mb-1">{currentCollection?.name}</h3>
                  <p className="text-muted-foreground text-sm">Browse folders and samples in this collection.</p>
                </div>
                {canManageContent && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCreateFolder(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
                      style={{ backgroundColor: '#9481ff' }}
                    >
                      <Plus size={14} />
                      New Folder
                    </button>
                    <button
                      onClick={() => navigate(`/upload?folderId=${currentCollectionFolderId || ''}&collectionId=${currentCollectionId}`)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
                      style={{ backgroundColor: '#9481ff' }}
                    >
                      <UploadCloud size={14} />
                      Upload Sample
                    </button>
                  </div>
                )}
              </div>

              {/* Collection Breadcrumbs */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-5 bg-card border border-border px-4 py-2.5 rounded-xl overflow-x-auto">
                <button
                  onClick={() => setCurrentCollectionId(null)}
                  className="hover:text-[#9481ff] transition-colors whitespace-nowrap"
                >
                  Collections
                </button>
                <ChevronRight size={14} />
                <button
                  onClick={() => setCurrentCollectionFolderId(null)}
                  className={`hover:text-[#9481ff] transition-colors whitespace-nowrap ${!currentCollectionFolderId ? 'font-medium text-foreground' : ''}`}
                >
                  {currentCollection?.name}
                </button>
                {collectionBreadcrumbs.map(crumb => (
                  <div key={crumb.id} className="flex items-center gap-2 shrink-0">
                    <ChevronRight size={14} />
                    <button
                      onClick={() => setCurrentCollectionFolderId(crumb.id)}
                      className={`hover:text-[#9481ff] transition-colors whitespace-nowrap ${currentCollectionFolderId === crumb.id ? 'font-medium text-foreground' : ''}`}
                    >
                      {crumb.name}
                    </button>
                  </div>
                ))}
                {currentCollectionFolderId && (
                  <button
                    onClick={() => setCurrentCollectionFolderId(collectionBreadcrumbs[collectionBreadcrumbs.length - 2]?.id || null)}
                    className="ml-auto flex items-center gap-1.5 text-xs bg-muted hover:bg-border px-2 py-1 rounded-md transition-colors shrink-0"
                  >
                    <ArrowLeft size={12} />
                    Up
                  </button>
                )}
              </div>

              {displayedCollectionFolders.length === 0 && displayedCollectionSamples.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center">
                  <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ backgroundColor: '#f8f7ff' }}>
                    <Folder size={32} style={{ color: '#9481ff' }} />
                  </div>
                  <h3 className="font-semibold mb-2">Empty collection</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-6 text-sm">
                    Add folders and upload samples to populate this collection.
                  </p>
                  {canManageContent && (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => setShowCreateFolder(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white"
                        style={{ backgroundColor: '#9481ff' }}
                      >
                        <Plus size={16} />
                        Create Folder
                      </button>
                      <button
                        onClick={() => navigate(`/upload?folderId=${currentCollectionFolderId || ''}&collectionId=${currentCollectionId}`)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white"
                        style={{ backgroundColor: '#9481ff' }}
                      >
                        <UploadCloud size={16} />
                        Upload Sample
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {displayedCollectionFolders.map(folder => (
                    <div
                      key={folder.id}
                      onClick={() => setCurrentCollectionFolderId(folder.id)}
                      className="border border-border rounded-xl bg-card p-4 hover:shadow-md transition-all cursor-pointer hover:border-[#9481ff]/50 flex items-center gap-3"
                    >
                      <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#f8f7ff' }}>
                        <Folder size={22} fill="#e5e0ff" stroke="#9481ff" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium truncate text-sm">{folder.name}</h4>
                        {folder.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{folder.description}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {displayedCollectionSamples.map(sample => (
                    <SampleCard
                      key={sample.id}
                      sample={sample}
                      fileTypeBadge={getFileTypeBadge(sample)}
                      onClick={() => navigate(`/sample/${sample.id}`)}
                      isSelected={selectedSamples.has(sample.id)}
                      onToggleSelection={() => toggleSelection(sample.id)}
                    />
                  ))}
                </div>
              )}

              {/* Create Folder Modal */}
              {showCreateFolder && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                  <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-bold">New Folder</h3>
                      <button onClick={() => setShowCreateFolder(false)}>
                        <X size={20} className="text-muted-foreground" />
                      </button>
                    </div>
                    <form onSubmit={handleCreateFolder} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={e => setNewFolderName(e.target.value)}
                          placeholder="e.g., Patient Records"
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Description</label>
                        <textarea
                          value={newFolderDesc}
                          onChange={e => setNewFolderDesc(e.target.value)}
                          placeholder="Optional description..."
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 min-h-20"
                        />
                      </div>
                      {createFolderError && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle size={13} /> {createFolderError}
                        </p>
                      )}
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setShowCreateFolder(false)}
                          className="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={createFolderLoading}
                          className="flex-1 px-4 py-2.5 rounded-lg text-white font-medium disabled:opacity-60"
                          style={{ backgroundColor: '#9481ff' }}
                        >
                          {createFolderLoading ? 'Creating...' : 'Create'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── GROUPS ─── */}
          {!loading && activeTab === 'groups' && (
            <div className="animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-5">
                <span className="text-sm text-muted-foreground font-medium">
                  {groups.length} group{groups.length !== 1 ? 's' : ''}
                </span>
                {isAuthenticated && (
                  <button
                    onClick={() => navigate('/groups')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ backgroundColor: '#9481ff' }}
                  >
                    <Users size={14} />
                    Manage Groups
                  </button>
                )}
              </div>

              {groups.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
                  <Users size={48} className="mx-auto text-muted-foreground mb-4 opacity-40" />
                  <h3 className="font-semibold mb-1">No groups yet</h3>
                  <p className="text-muted-foreground text-sm">Groups will appear here once created.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {groups.map(group => (
                    <div
                      key={group.id}
                      onClick={() => navigate('/groups')}
                      className="border border-border rounded-xl bg-card p-5 hover:shadow-md transition-all cursor-pointer hover:border-[#9481ff]/40 group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted">
                          <Users size={18} className="text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold group-hover:text-[#9481ff] transition-colors">{group.name}</h3>
                          <p className="text-xs text-muted-foreground">{group.members?.length || 0} members</p>
                        </div>
                      </div>
                      {group.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>
                      )}
                      <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                        Created {new Date(group.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── MY WORKSPACE ─── */}
          {!loading && activeTab === 'my-collection' && (
            <div className="animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold mb-1">My Workspace</h3>
                  <p className="text-muted-foreground text-sm">Manage your personal samples and folders.</p>
                </div>
                {canManageContent && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCreateFolder(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
                      style={{ backgroundColor: '#9481ff' }}
                    >
                      <Plus size={14} />
                      New Folder
                    </button>
                    <button
                      onClick={() => navigate(`/upload?folderId=${currentFolderId || ''}`)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
                      style={{ backgroundColor: '#9481ff' }}
                    >
                      <UploadCloud size={14} />
                      Upload Sample
                    </button>
                  </div>
                )}
              </div>

              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-5 bg-card border border-border px-4 py-2.5 rounded-xl overflow-x-auto">
                <button
                  onClick={() => setCurrentFolderId(null)}
                  className={`hover:text-[#9481ff] transition-colors whitespace-nowrap ${currentFolderId === null ? 'font-medium text-foreground' : ''}`}
                >
                  My Workspace
                </button>
                {breadcrumbs.map(crumb => (
                  <div key={crumb.id} className="flex items-center gap-2 shrink-0">
                    <ChevronRight size={14} />
                    <button
                      onClick={() => setCurrentFolderId(crumb.id)}
                      className={`hover:text-[#9481ff] transition-colors whitespace-nowrap ${currentFolderId === crumb.id ? 'font-medium text-foreground' : ''}`}
                    >
                      {crumb.name}
                    </button>
                  </div>
                ))}
                {currentFolderId !== null && (
                  <button
                    onClick={() => setCurrentFolderId(currentFolderObj?.parentId || null)}
                    className="ml-auto flex items-center gap-1.5 text-xs bg-muted hover:bg-border px-2 py-1 rounded-md transition-colors shrink-0"
                  >
                    <ArrowLeft size={12} />
                    Up
                  </button>
                )}
              </div>

              {displayedFolders.length === 0 && displayedMySamples.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center">
                  <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ backgroundColor: '#f8f7ff' }}>
                    <Folder size={32} style={{ color: '#9481ff' }} />
                  </div>
                  <h3 className="font-semibold mb-2">Empty workspace</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-6 text-sm">
                    Upload samples to populate your workspace.
                  </p>
                  {canManageContent && (
                    <button
                      onClick={() => navigate('/upload')}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white"
                      style={{ backgroundColor: '#9481ff' }}
                    >
                      <Plus size={16} />
                      Upload Sample
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {displayedFolders.map(folder => (
                    <div
                      key={folder.id}
                      onClick={() => setCurrentFolderId(folder.id)}
                      className="border border-border rounded-xl bg-card p-4 hover:shadow-md transition-all cursor-pointer hover:border-[#9481ff]/50 flex items-center gap-3"
                    >
                      <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#f8f7ff' }}>
                        <Folder size={22} fill="#e5e0ff" stroke="#9481ff" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium truncate text-sm">{folder.name}</h4>
                        {folder.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{folder.description}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {displayedMySamples.map(sample => (
                    <SampleCard
                      key={sample.id}
                      sample={sample}
                      fileTypeBadge={getFileTypeBadge(sample)}
                      onClick={() => navigate(`/sample/${sample.id}`)}
                      isSelected={selectedSamples.has(sample.id)}
                      onToggleSelection={() => toggleSelection(sample.id)}
                    />
                  ))}
                </div>
              )}

              {/* Create Folder Modal for My Workspace */}
              {showCreateFolder && activeTab === 'my-collection' && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                  <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-bold">New Folder</h3>
                      <button onClick={() => setShowCreateFolder(false)}>
                        <X size={20} className="text-muted-foreground" />
                      </button>
                    </div>
                    <form onSubmit={handleCreateFolder} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={e => setNewFolderName(e.target.value)}
                          placeholder="e.g., Patient Records"
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Description</label>
                        <textarea
                          value={newFolderDesc}
                          onChange={e => setNewFolderDesc(e.target.value)}
                          placeholder="Optional description..."
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 min-h-20"
                        />
                      </div>
                      {createFolderError && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle size={13} /> {createFolderError}
                        </p>
                      )}
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setShowCreateFolder(false)}
                          className="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={createFolderLoading}
                          className="flex-1 px-4 py-2.5 rounded-lg text-white font-medium disabled:opacity-60"
                          style={{ backgroundColor: '#9481ff' }}
                        >
                          {createFolderLoading ? 'Creating...' : 'Create'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap
        ${active ? 'bg-[#9481ff] text-white shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function SampleCard({
  sample, fileTypeBadge, onClick, isSelected, onToggleSelection
}: {
  sample: ApiSample;
  fileTypeBadge: string;
  onClick: () => void;
  isSelected: boolean;
  onToggleSelection: () => void;
}) {
  return (
    <div
      className={`border rounded-xl bg-card p-4 hover:shadow-lg transition-all cursor-pointer flex flex-col relative group
        ${isSelected ? 'border-[#9481ff] ring-2 ring-[#9481ff]/15' : 'border-border hover:border-[#9481ff]/40'}`}
    >
      {/* Checkbox */}
      <div
        className="absolute top-3 right-3 z-10"
        onClick={e => { e.stopPropagation(); onToggleSelection(); }}
      >
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all
            ${isSelected ? 'bg-[#9481ff] border-[#9481ff]' : 'bg-white border-border hover:border-[#9481ff]'}`}
        >
          {isSelected && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      <div className="flex-1" onClick={onClick}>
        {/* Title */}
        <div className="flex items-start gap-2 mb-2 pr-7">
          <File size={15} className="text-[#9481ff] shrink-0 mt-0.5" />
          <h3 className="text-sm font-medium line-clamp-2 leading-snug group-hover:text-[#9481ff] transition-colors">
            {sample.title}
          </h3>
        </div>

        {/* Type badge */}
        <div className="mb-3">
          <span
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: '#f8f7ff', color: '#9481ff', border: '1px solid #b8b8fe' }}
          >
            {fileTypeBadge}
          </span>
        </div>

        {/* Meta */}
        <div className="space-y-1 text-xs text-muted-foreground">
          {sample.status && <div className="truncate">{sample.status}</div>}
          {sample.age > 0 && <div>Age {sample.age}{sample.gender ? ` · ${sample.gender}` : ''}</div>}
          {sample.city && <div>{sample.city}</div>}
          {sample.files?.length > 0 && (
            <div>{sample.files.length} file{sample.files.length !== 1 ? 's' : ''}</div>
          )}
        </div>

        {/* Tags */}
        {sample.tags && sample.tags.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-1">
            {sample.tags.slice(0, 3).map(tag => (
              <span
                key={tag.id}
                className="px-1.5 py-0.5 rounded text-xs border border-border bg-muted/50 text-muted-foreground"
              >
                {tag.name}
              </span>
            ))}
            {sample.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{sample.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
