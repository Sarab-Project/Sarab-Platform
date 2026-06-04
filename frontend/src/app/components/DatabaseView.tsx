import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Folder, Layers, LayoutGrid, Plus, UploadCloud, Search,
  ChevronRight, File, ArrowLeft, AlertCircle, Download, Loader, X,
  RefreshCw
} from 'lucide-react';
import {
  fetchSamples, fetchCollections, fetchFolders,
  fetchTags, downloadSample, downloadSamples, createCollection, fetchGroups,
  triggerDownload, searchSamples, createFolder,
  type Sample as ApiSample, type Collection, type Folder as ApiFolder,
  type Tag, type SearchSampleDto, type Group
} from '../services/api';
import { getErrorMessage } from '../services/error';
import { useAuth } from '../contexts/AuthContext';

type TabType = 'flat' | 'collections' | 'my-collection';

export function DatabaseView() {
  const [activeTab, setActiveTab] = useState<TabType>('flat');
  const [searchQuery, setSearchQuery] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState({
    title: '',
    description: '',
    selectedTagIds: [] as number[],
    eyeSide: '',
    gender: '',
    minAge: '',
    maxAge: '',
    city: '',
    condition: '',
    profession: '',
    notes: '',
  });
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const canManageContent = user?.role === 'Admin' || user?.role === 'Contributor';
  const canCreateCollection = user?.role === 'Admin';
  const canCreateFolder = canManageContent;
  const canViewWorkspace = canManageContent;

  useEffect(() => {
    if (!canViewWorkspace && activeTab === 'my-collection') {
      setActiveTab('flat');
    }
  }, [canViewWorkspace, activeTab]);

  // API State
  const [samples, setSamples] = useState<ApiSample[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
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
  const [creatorGroups, setCreatorGroups] = useState<Group[]>([]);
  const [newCollAllowedGroupIds, setNewCollAllowedGroupIds] = useState<number[]>([]);

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
      const [s, c, f, t] = await Promise.allSettled([
        fetchSamples(),
        fetchCollections(),
        fetchFolders(),
        fetchTags(),
      ]);
      if (s.status === 'fulfilled') setSamples(s.value);
      else if (s.status === 'rejected') setError(getErrorMessage(s.reason, 'Failed to load samples'));
      if (c.status === 'fulfilled') setCollections(c.value);
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
    if (trimmed.length === 0 &&
        !advancedFilters.title &&
        !advancedFilters.description &&
        !advancedFilters.selectedTagIds.length &&
        !advancedFilters.eyeSide &&
        !advancedFilters.gender &&
        !advancedFilters.minAge &&
        !advancedFilters.maxAge &&
        !advancedFilters.city &&
        !advancedFilters.condition &&
        !advancedFilters.profession &&
        !advancedFilters.notes) {
      setShowSuggestions(false);
      setSuggestions([]);
      setIsSearching(true);
      fetchSamples()
        .then(all => setSamples(all))
        .catch(() => {
          // keep current samples on failure
        })
        .finally(() => setIsSearching(false));
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
      try {
        const searchDto: SearchSampleDto = {
          keyword: trimmed || undefined,
          title: advancedFilters.title || undefined,
          description: advancedFilters.description || undefined,
          eyeSide: advancedFilters.eyeSide || undefined,
          gender: advancedFilters.gender || undefined,
          minAge: advancedFilters.minAge ? Number(advancedFilters.minAge) : undefined,
          maxAge: advancedFilters.maxAge ? Number(advancedFilters.maxAge) : undefined,
          city: advancedFilters.city || undefined,
          condition: advancedFilters.condition || undefined,
          profession: advancedFilters.profession || undefined,
          notes: advancedFilters.notes || undefined,
          tagIds: advancedFilters.selectedTagIds.length > 0 ? advancedFilters.selectedTagIds : undefined,
          pageSize: 50,
        };
        const results = await searchSamples(searchDto);
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
    setAdvancedFilters({
      title: '',
      description: '',
      selectedTagIds: [],
      eyeSide: '',
      gender: '',
      minAge: '',
      maxAge: '',
      city: '',
      condition: '',
      profession: '',
      notes: '',
    });
    setShowTagDropdown(false);
    setShowSuggestions(false);
    setSuggestions([]);
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

  const handleAdvancedFilterChange = (key: string, value: any) => {
    const newFilters = { ...advancedFilters, [key]: value };
    setAdvancedFilters(newFilters);

    // Trigger search with new filters
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const searchDto: SearchSampleDto = {
          keyword: searchQuery.trim() || undefined,
          title: newFilters.title || undefined,
          description: newFilters.description || undefined,
          eyeSide: newFilters.eyeSide || undefined,
          gender: newFilters.gender || undefined,
          minAge: newFilters.minAge ? Number(newFilters.minAge) : undefined,
          maxAge: newFilters.maxAge ? Number(newFilters.maxAge) : undefined,
          city: newFilters.city || undefined,
          condition: newFilters.condition || undefined,
          profession: newFilters.profession || undefined,
          notes: newFilters.notes || undefined,
          tagIds: newFilters.selectedTagIds.length > 0 ? newFilters.selectedTagIds : undefined,
          pageSize: 50,
        };
        const results = await searchSamples(searchDto);
        setSamples(results);
      } catch {
        // Fallback to local filter
      } finally {
        setIsSearching(false);
      }
    }, 300);
    setSearchTimeout(timeout);
  };

  // Local filter on top of API search
  const filteredSamples = useMemo(() => {
    return samples.filter(s => {
      const lowerQuery = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        s.title.toLowerCase().includes(lowerQuery) ||
        (s.description || '').toLowerCase().includes(lowerQuery) ||
        (s.status || '').toLowerCase().includes(lowerQuery) ||
        (s.city || '').toLowerCase().includes(lowerQuery) ||
        (s.gender || '').toLowerCase().includes(lowerQuery) ||
        (s.profession || '').toLowerCase().includes(lowerQuery) ||
        (s.notes || '').toLowerCase().includes(lowerQuery) ||
        (s.tags || []).some(t => t.name.toLowerCase().includes(lowerQuery));

      const matchesTitle = !advancedFilters.title || s.title.toLowerCase().includes(advancedFilters.title.toLowerCase());
      const matchesDescription = !advancedFilters.description || (s.description || '').toLowerCase().includes(advancedFilters.description.toLowerCase());
      const matchesEyeSide = !advancedFilters.eyeSide || (s.eyeSide || '').toLowerCase() === advancedFilters.eyeSide.toLowerCase();
      const matchesGender = !advancedFilters.gender || (s.gender || '').toLowerCase() === advancedFilters.gender.toLowerCase();
      const matchesAgeMin = !advancedFilters.minAge || (s.age !== null && s.age !== undefined && s.age >= Number(advancedFilters.minAge));
      const matchesAgeMax = !advancedFilters.maxAge || (s.age !== null && s.age !== undefined && s.age <= Number(advancedFilters.maxAge));
      const matchesCity = !advancedFilters.city || (s.city || '').toLowerCase().includes(advancedFilters.city.toLowerCase());
      const matchesCondition = !advancedFilters.condition || (s.status || '').toLowerCase().includes(advancedFilters.condition.toLowerCase());
      const matchesProfession = !advancedFilters.profession || (s.profession || '').toLowerCase().includes(advancedFilters.profession.toLowerCase());
      const matchesNotes = !advancedFilters.notes || (s.notes || '').toLowerCase().includes(advancedFilters.notes.toLowerCase());
      const matchesTags = !advancedFilters.selectedTagIds.length || (s.tags || []).some(t => advancedFilters.selectedTagIds.includes(t.id));

      return matchesSearch && matchesTitle && matchesDescription && matchesEyeSide && matchesGender && matchesAgeMin && matchesAgeMax && matchesCity && matchesCondition && matchesProfession && matchesNotes && matchesTags;
    });
  }, [samples, searchQuery, advancedFilters]);

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

  const toggleSelectAll = (scope?: ApiSample[]) => {
    const target = scope || filteredSamples;
    if (selectedSamples.size === target.length) {
      setSelectedSamples(new Set());
    } else {
      setSelectedSamples(new Set(target.map(s => s.id)));
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
          allowedGroupIds: newCollAllowedGroupIds,
      });
      setCollections(prev => [...prev, coll]);
      setShowCreateCollection(false);
      setNewCollName('');
      setNewCollDesc('');
        setNewCollAllowedGroupIds([]);
    } catch (err) {
      setCreateCollError(getErrorMessage(err, 'Failed to create collection'));
    } finally {
      setCreateCollLoading(false);
    }
  };

    useEffect(() => {
      if (!showCreateCollection) return;
      let mounted = true;
      (async () => {
        try {
          const groups = await fetchGroups();
          if (!mounted) return;
          const filtered = groups.filter(g => g.members?.some(m => m.user.id === user?.id));
          setCreatorGroups(filtered);
        } catch (err) {
          setCreatorGroups([]);
        }
      })();
      return () => { mounted = false; };
    }, [showCreateCollection, user]);

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
      setCreateFolderError(getErrorMessage(err, 'Failed to create folder'));
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
            <h2 className="mb-2 font-bold text-primary" style={{ fontSize: '1.75rem' }}>
              Sarab Research Database
            </h2>
            <p className="text-muted-foreground mb-6">
              Explore, manage, and contribute to ophthalmic research
            </p>

            <div className="max-w-3xl mx-auto relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by title, description, condition, tags, city, gender, profession, notes..."
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  className="w-full px-5 py-4 pl-12 pr-10 border-2 rounded-xl bg-background shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  style={{ borderColor: '#b8b8fe' }}
                />
                {isSearching ? (
                  <Loader className="absolute left-4 top-1/2 -translate-y-1/2 text-primary animate-spin" size={20} />
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

              <div className="mt-6 p-4 bg-card border border-border rounded-3xl">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-base font-semibold">Search filters</h3>
                    <p className="text-sm text-muted-foreground">Use specific fields for title, description, tags, eye side, gender, age, city, condition, profession, and notes.</p>
                  </div>
                  <button
                    onClick={handleClearSearch}
                    className="text-sm text-primary hover:text-primary/80"
                  >
                    Clear filters
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Title</label>
                    <input
                      type="text"
                      placeholder="Search by title"
                      value={advancedFilters.title}
                      onChange={(e) => handleAdvancedFilterChange('title', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <input
                      type="text"
                      placeholder="Search by description"
                      value={advancedFilters.description}
                      onChange={(e) => handleAdvancedFilterChange('description', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-medium mb-2">Tags</label>
                    <button
                      type="button"
                      onClick={() => setShowTagDropdown(!showTagDropdown)}
                      className="w-full text-left px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {advancedFilters.selectedTagIds.length > 0
                        ? tags.filter(tag => advancedFilters.selectedTagIds.includes(tag.id)).map(tag => tag.name).join(', ')
                        : 'Select tags'}
                    </button>
                    {showTagDropdown && (
                      <div className="absolute z-50 mt-2 w-full max-h-64 overflow-auto rounded-2xl border border-border bg-card p-3 shadow-lg">
                        <div className="grid grid-cols-2 gap-2">
                          {tags.map(tag => (
                            <label key={tag.id} className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-2 hover:bg-accent/10">
                              <input
                                type="checkbox"
                                checked={advancedFilters.selectedTagIds.includes(tag.id)}
                                onChange={(e) => {
                                  const newSelectedTagIds = e.target.checked
                                    ? [...advancedFilters.selectedTagIds, tag.id]
                                    : advancedFilters.selectedTagIds.filter(id => id !== tag.id);
                                  handleAdvancedFilterChange('selectedTagIds', newSelectedTagIds);
                                }}
                                className="w-4 h-4 accent-primary"
                              />
                              <span className="text-sm">{tag.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Eye Side</label>
                    <select
                      value={advancedFilters.eyeSide}
                      onChange={(e) => handleAdvancedFilterChange('eyeSide', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">Any</option>
                      <option value="Left">Left</option>
                      <option value="Right">Right</option>
                      <option value="Both">Both</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Gender</label>
                    <select
                      value={advancedFilters.gender}
                      onChange={(e) => handleAdvancedFilterChange('gender', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">Any</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-2">Min age</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="From"
                        value={advancedFilters.minAge}
                        onChange={(e) => handleAdvancedFilterChange('minAge', e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Max age</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="To"
                        value={advancedFilters.maxAge}
                        onChange={(e) => handleAdvancedFilterChange('maxAge', e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">City</label>
                    <input
                      type="text"
                      placeholder="Search by city"
                      value={advancedFilters.city}
                      onChange={(e) => handleAdvancedFilterChange('city', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Condition</label>
                    <input
                      type="text"
                      placeholder="Search by condition"
                      value={advancedFilters.condition}
                      onChange={(e) => handleAdvancedFilterChange('condition', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Profession</label>
                    <input
                      type="text"
                      placeholder="Search by profession"
                      value={advancedFilters.profession}
                      onChange={(e) => handleAdvancedFilterChange('profession', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Notes</label>
                    <input
                      type="text"
                      placeholder="Search by notes"
                      value={advancedFilters.notes}
                      onChange={(e) => handleAdvancedFilterChange('notes', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              </div>
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
            {canViewWorkspace && (
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
              <div className="inline-block w-12 h-12 border-4 border-muted border-t-primary rounded-full animate-spin mb-4" />
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
                      <span className="text-sm font-medium text-primary">
                        {selectedSamples.size} selected
                      </span>
                      <button
                        onClick={handleDownloadSelected}
                        disabled={downloadingAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
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
                      onClick={() => toggleSelectAll(filteredSamples)}
                      className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
                    >
                      {selectedSamples.size === filteredSamples.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
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
                {canCreateCollection && (
                  <button
                    onClick={() => setShowCreateCollection(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium bg-primary shadow-sm hover:bg-primary/90 transition-colors"
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
                      className="border border-border rounded-xl bg-card p-6 hover:shadow-md transition-all cursor-pointer group hover:border-primary/40"
                    >
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-muted">
                        <Layers size={22} className="text-primary group-hover:scale-110 transition-transform" />
                      </div>
                      <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">{collection.name}</h3>
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{collection.description || 'No description'}</p>
                      <div className="flex items-center justify-between text-xs pt-4 border-t border-border">
                        <span className="font-medium text-primary">
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
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Description</label>
                        <textarea
                          value={newCollDesc}
                          onChange={e => setNewCollDesc(e.target.value)}
                          placeholder="Optional description..."
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-20"
                        />
                      </div>
                      {creatorGroups.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Visible to groups (optional)</label>
                          <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded-md p-2 bg-input-background">
                            {creatorGroups.map(g => (
                              <label key={g.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={newCollAllowedGroupIds.includes(g.id)}
                                  onChange={e => {
                                    setNewCollAllowedGroupIds(prev => {
                                      if (e.target.checked) return [...prev, g.id];
                                      return prev.filter(id => id !== g.id);
                                    });
                                  }}
                                />
                                <span>{g.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
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
                          className="flex-1 px-4 py-2.5 rounded-lg text-white font-medium bg-primary hover:bg-primary/90 disabled:opacity-60 transition-colors"
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
                <div className="flex gap-2">
                  {canCreateFolder && (
                    <button
                      onClick={() => setShowCreateFolder(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium bg-primary shadow-sm hover:bg-primary/90 transition-colors"
                    >
                      <Plus size={14} />
                      New Folder
                    </button>
                  )}
                  {currentCollectionFolderId && canManageContent && (
                    <button
                      onClick={() => navigate(`/upload?collectionId=${currentCollectionId}&folderId=${currentCollectionFolderId}`)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium bg-primary shadow-sm hover:bg-primary/90 transition-colors"
                    >
                      <UploadCloud size={14} />
                      Upload Sample
                    </button>
                  )}
                </div>
              </div>

              {/* Collection Breadcrumbs */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-5 bg-card border border-border px-4 py-2.5 rounded-xl overflow-x-auto">
                <button
                  onClick={() => setCurrentCollectionId(null)}
                  className="hover:text-primary transition-colors whitespace-nowrap"
                >
                  Collections
                </button>
                <ChevronRight size={14} />
                <button
                  onClick={() => setCurrentCollectionFolderId(null)}
                  className={`hover:text-primary transition-colors whitespace-nowrap ${!currentCollectionFolderId ? 'font-medium text-foreground' : ''}`}
                >
                  {currentCollection?.name}
                </button>
                {collectionBreadcrumbs.map(crumb => (
                  <div key={crumb.id} className="flex items-center gap-2 shrink-0">
                    <ChevronRight size={14} />
                    <button
                      onClick={() => setCurrentCollectionFolderId(crumb.id)}
                      className={`hover:text-primary transition-colors whitespace-nowrap ${currentCollectionFolderId === crumb.id ? 'font-medium text-foreground' : ''}`}
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

              <div className="mb-5 flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-muted-foreground font-medium">
                    {displayedCollectionSamples.length} sample{displayedCollectionSamples.length !== 1 ? 's' : ''}
                  </span>
                  {selectedSamples.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary">
                        {selectedSamples.size} selected
                      </span>
                      <button
                        onClick={handleDownloadSelected}
                        disabled={downloadingAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
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
                  {displayedCollectionSamples.length > 0 && (
                    <button
                      onClick={() => toggleSelectAll(displayedCollectionSamples)}
                      className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
                    >
                      {selectedSamples.size === displayedCollectionSamples.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>
              </div>

              {displayedCollectionFolders.length === 0 && displayedCollectionSamples.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center">
                  <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 bg-muted text-primary">
                    <Folder size={32} />
                  </div>
                  <h3 className="font-semibold mb-2">Empty collection</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-6 text-sm">
                    Create a folder first, then upload samples inside that folder.
                  </p>
                  {canCreateFolder && (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => setShowCreateFolder(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white bg-primary shadow-sm hover:bg-primary/90 transition-colors"
                      >
                        <Plus size={16} />
                        Create Folder
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
                      className="border border-border rounded-xl bg-card p-4 hover:shadow-md transition-all cursor-pointer hover:border-primary/50 flex items-center gap-3"
                    >
                      <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 bg-muted text-primary">
                        <Folder size={22} className="text-primary" />
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
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Description</label>
                        <textarea
                          value={newFolderDesc}
                          onChange={e => setNewFolderDesc(e.target.value)}
                          placeholder="Optional description..."
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-20"
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
                          className="flex-1 px-4 py-2.5 rounded-lg text-white font-medium bg-primary hover:bg-primary/90 disabled:opacity-60 transition-colors"
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


          {/* ─── MY WORKSPACE ─── */}
          {!loading && canViewWorkspace && activeTab === 'my-collection' && (
            <div className="animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold mb-1">My Workspace</h3>
                  <p className="text-muted-foreground text-sm">Manage your personal samples and folders.</p>
                </div>
                <div className="flex gap-2">
                  {canCreateFolder && (
                    <button
                      onClick={() => setShowCreateFolder(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium bg-primary shadow-sm hover:bg-primary/90 transition-colors"
                    >
                      <Plus size={14} />
                      New Folder
                    </button>
                  )}
                  {canManageContent && (
                    <button
                      onClick={() => navigate(`/upload?folderId=${currentFolderId || ''}`)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium bg-primary shadow-sm hover:bg-primary/90 transition-colors"
                    >
                      <UploadCloud size={14} />
                      Upload Sample
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-5 bg-card border border-border px-4 py-2.5 rounded-xl overflow-x-auto">
                <button
                  onClick={() => setCurrentFolderId(null)}
                  className={`hover:text-primary transition-colors whitespace-nowrap ${currentFolderId === null ? 'font-medium text-foreground' : ''}`}
                >
                  My Workspace
                </button>
                {breadcrumbs.map(crumb => (
                  <div key={crumb.id} className="flex items-center gap-2 shrink-0">
                    <ChevronRight size={14} />
                    <button
                      onClick={() => setCurrentFolderId(crumb.id)}
                      className={`hover:text-primary transition-colors whitespace-nowrap ${currentFolderId === crumb.id ? 'font-medium text-foreground' : ''}`}
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

              <div className="mb-5 flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-muted-foreground font-medium">
                    {displayedMySamples.length} sample{displayedMySamples.length !== 1 ? 's' : ''}
                  </span>
                  {selectedSamples.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary">
                        {selectedSamples.size} selected
                      </span>
                      <button
                        onClick={handleDownloadSelected}
                        disabled={downloadingAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
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
                  {displayedMySamples.length > 0 && (
                    <button
                      onClick={() => toggleSelectAll(displayedMySamples)}
                      className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
                    >
                      {selectedSamples.size === displayedMySamples.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>
              </div>

              {displayedFolders.length === 0 && displayedMySamples.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center">
                  <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 bg-muted text-primary">
                    <Folder size={32} />
                  </div>
                  <h3 className="font-semibold mb-2">Empty workspace</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-6 text-sm">
                    Upload samples to populate your workspace.
                  </p>
                  {canManageContent && (
                    <button
                      onClick={() => navigate('/upload')}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white bg-primary shadow-sm hover:bg-primary/90 transition-colors"
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
                      className="border border-border rounded-xl bg-card p-4 hover:shadow-md transition-all cursor-pointer hover:border-primary/50 flex items-center gap-3"
                    >
                      <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 bg-muted text-primary">
                        <Folder size={22} className="text-primary" />
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
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Description</label>
                        <textarea
                          value={newFolderDesc}
                          onChange={e => setNewFolderDesc(e.target.value)}
                          placeholder="Optional description..."
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-20"
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
                          className="flex-1 px-4 py-2.5 rounded-lg text-white font-medium bg-primary hover:bg-primary/90 disabled:opacity-60 transition-colors"
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
        ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
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
        ${isSelected ? 'border-primary ring-2 ring-primary/15' : 'border-border hover:border-primary/40'}`}
    >
      {/* Checkbox */}
      <div
        className="absolute top-3 right-3 z-10"
        onClick={e => { e.stopPropagation(); onToggleSelection(); }}
      >
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all
            ${isSelected ? 'bg-primary border-primary' : 'bg-input-background border-border hover:border-primary'}`}
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
          <File size={15} className="text-primary shrink-0 mt-0.5" />
          <h3 className="text-sm font-medium line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {sample.title}
          </h3>
        </div>

        {/* Type badge */}
        <div className="mb-3">
          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium border border-border bg-muted text-primary">
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
          {(sample.downloadCount !== undefined || sample.viewCount !== undefined) && (
            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              {sample.downloadCount !== undefined && <span>{sample.downloadCount} downloads</span>}
              {sample.viewCount !== undefined && <span>{sample.viewCount} views</span>}
            </div>
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
