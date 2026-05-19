import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { fetchCollections, uploadSample, fetchTags, type Collection, type FileMetadataInput, type Tag } from '../services/api';
import { UploadCloud, X, File as FileIcon, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { Badge } from '../components/ui/badge';

export function UploadSample() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [folderId, setFolderId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(null);
  const [fileMetadata, setFileMetadata] = useState<FileMetadataInput[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collections/Folders
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [collectionsLoading, setCollectionsLoading] = useState(true);

  // Tags
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    fetchCollections()
      .then(setCollections)
      .catch(() => {})
      .finally(() => setCollectionsLoading(false));
    
    fetchTags()
      .then(setAvailableTags)
      .catch(() => {})
      .finally(() => setTagsLoading(false));
  }, [isAuthenticated]);

  // Handle URL query params for pre-selection
  useEffect(() => {
    const collectionId = searchParams.get('collectionId');
    const folderIdParam = searchParams.get('folderId');

    if (folderIdParam) {
      setFolderId(folderIdParam);
    }

    if (collectionId) {
      setSelectedCollectionId(collectionId);
    } else if (folderIdParam && collections.length > 0) {
      const matchingCollection = collections.find(c => c.folders?.some(f => f.id.toString() === folderIdParam));
      if (matchingCollection) {
        setSelectedCollectionId(matchingCollection.id.toString());
      }
    }
  }, [searchParams, collections]);

  const isAllowedToUpload = user?.role === 'Contributor' || user?.role === 'Admin';

  const selectedCollection = collections.find(c => c.id.toString() === selectedCollectionId);
  const availableFolders = selectedCollection?.folders || [];

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const incomingFiles = Array.from(files);
    setSelectedFiles(prev => [...prev, ...incomingFiles]);
    setFileMetadata(prev => [...prev, ...incomingFiles.map(() => ({ }))]);
    setSelectedFileIndex(prev => prev === null ? 0 : prev);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFileMetadata(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  useEffect(() => {
    if (selectedFiles.length === 0) {
      setSelectedFileIndex(null);
      return;
    }
    setSelectedFileIndex(prev => (prev === null || prev >= selectedFiles.length ? 0 : prev));
  }, [selectedFiles]);

  const updateSelectedFileMetadata = (field: keyof FileMetadataInput, value: string) => {
    if (selectedFileIndex === null) return;
    setFileMetadata(prev => {
      const next = [...prev];
      next[selectedFileIndex] = {
        ...next[selectedFileIndex],
        [field]: field === 'age' ? (value ? Number(value) : undefined) : value,
      };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!folderId) {
      setError('Please select a folder.');
      return;
    }
    if (selectedFiles.length === 0) {
      setError('Please upload at least one file.');
      return;
    }

    setLoading(true);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 10, 85));
    }, 300);

    try {
      const metadataPayload = selectedFiles.map((_, index) => {
        const metadata = fileMetadata[index] || {};
        return {
          eyeSide: metadata.eyeSide || null,
          gender: metadata.gender || null,
          age: metadata.age ?? null,
          city: metadata.city || null,
          status: metadata.status || null,
          profession: metadata.profession || null,
          notes: metadata.notes || null,
        };
      });

      await uploadSample({
        title,
        description: description || undefined,
        folderId: parseInt(folderId),
        tags: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        files: selectedFiles,
        fileMetadataJson: JSON.stringify(metadataPayload),
      });

      clearInterval(progressInterval);
      setProgress(100);
      setSuccess(true);

      setTimeout(() => navigate('/my-uploads'), 1500);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (success) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h3 className="font-bold mb-2">Upload Successful!</h3>
          <p className="text-muted-foreground">Redirecting to your uploads...</p>
        </div>
      </div>
    );
  }

  if (!isAllowedToUpload) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background p-6">
        <div className="max-w-lg text-center border border-border rounded-2xl bg-card p-8 shadow-sm">
          <div className="mb-4 text-2xl font-semibold">Access Restricted</div>
          <p className="text-sm text-muted-foreground">
            Only contributor accounts may upload samples. Please sign in with a contributor account or create one from the sign-up page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Database
        </button>

        <div className="mb-6">
          <h2 className="mb-1 font-bold">Upload New Sample</h2>
          <p className="text-muted-foreground">Add a new ophthalmology sample to the research database</p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="border border-border rounded-xl bg-card p-6">
            <h3 className="font-semibold mb-5">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Sample Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Diabetic Retinopathy Stage 3"
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the sample, clinical information, imaging modality..."
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 min-h-24 resize-y"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Tags</label>
                {tagsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader size={14} className="animate-spin" />
                    Loading tags...
                  </div>
                ) : availableTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No tags available.</p>
                ) : (
                  <div className="p-3 border border-border rounded-lg bg-input-background">
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map(tag => {
                        const isSelected = selectedTagIds.includes(tag.id);
                        return (
                          <Badge
                            key={tag.id}
                            variant={isSelected ? "default" : "outline"}
                            className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                              isSelected
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : "border-border text-foreground hover:bg-accent hover:text-accent-foreground"
                            }`}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTagIds(prev => prev.filter(id => id !== tag.id));
                              } else {
                                setSelectedTagIds(prev => [...prev, tag.id]);
                              }
                            }}
                          >
                            {tag.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Select one or more predefined tags that describe the sample.
                </p>
              </div>
            </div>
          </div>

          {/* Organization */}
          <div className="border border-border rounded-xl bg-card p-6">
            <h3 className="font-semibold mb-5">
              Organization <span className="text-red-500">*</span>
            </h3>
            <div className="space-y-4">
              {collectionsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader size={14} className="animate-spin" />
                  Loading collections...
                </div>
              ) : collections.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  No collections available. Please create a collection first.
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Collection</label>
                    <select
                      value={selectedCollectionId}
                      onChange={e => { setSelectedCollectionId(e.target.value); setFolderId(''); }}
                      className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                    >
                      <option value="">Select a collection...</option>
                      {collections.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedCollectionId && (
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Folder <span className="text-red-500">*</span>
                      </label>
                      {availableFolders.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No folders in this collection.</p>
                      ) : (
                        <select
                          value={folderId}
                          onChange={e => setFolderId(e.target.value)}
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                          required
                        >
                          <option value="">Select a folder...</option>
                          {availableFolders.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* File Upload */}
          <div className="border border-border rounded-xl bg-card p-6">
            <h3 className="font-semibold mb-5">
              Files <span className="text-red-500">*</span>
            </h3>

            <div
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-[#9481ff] transition-colors"
              style={{ borderColor: selectedFiles.length ? '#9481ff' : '#b8b8fe', backgroundColor: '#f8f7ff30' }}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={40} className="mx-auto mb-3 text-[#9481ff] opacity-70" />
              <div className="text-sm font-medium mb-1">Click to upload or drag & drop</div>
              <div className="text-xs text-muted-foreground">Images, videos, PDFs — max 100MB per file</div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {selectedFiles.map((file, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedFileIndex(i)}
                    className={`w-full cursor-pointer text-left flex items-center gap-3 p-3 border rounded-lg transition-colors ${selectedFileIndex === i ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/70'}`}
                  >
                    <FileIcon size={18} className="text-[#9481ff] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{file.name}</div>
                      <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
                    </div>
                    {selectedFileIndex === i && (
                      <span className="text-xs text-primary font-medium">Selected</span>
                    )}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        removeFile(i);
                      }}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedFileIndex !== null ? (
              <div className="mt-6 border-t border-border pt-6">
                <h4 className="font-semibold mb-3">Metadata for selected file</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Eye Side</label>
                    <select
                      value={fileMetadata[selectedFileIndex]?.eyeSide || ''}
                      onChange={e => updateSelectedFileMetadata('eyeSide', e.target.value)}
                      className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                    >
                      <option value="">Select...</option>
                      <option value="Right">Right (OD)</option>
                      <option value="Left">Left (OS)</option>
                      <option value="Both">Both (OU)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Gender</label>
                    <select
                      value={fileMetadata[selectedFileIndex]?.gender || ''}
                      onChange={e => updateSelectedFileMetadata('gender', e.target.value)}
                      className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                    >
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Patient Age</label>
                    <input
                      type="number"
                      value={fileMetadata[selectedFileIndex]?.age ?? ''}
                      onChange={e => updateSelectedFileMetadata('age', e.target.value)}
                      placeholder="e.g., 58"
                      min={0}
                      max={150}
                      className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">City</label>
                    <input
                      type="text"
                      value={fileMetadata[selectedFileIndex]?.city || ''}
                      onChange={e => updateSelectedFileMetadata('city', e.target.value)}
                      placeholder="e.g., Cairo"
                      className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Condition / Status</label>
                    <input
                      type="text"
                      value={fileMetadata[selectedFileIndex]?.status || ''}
                      onChange={e => updateSelectedFileMetadata('status', e.target.value)}
                      placeholder="e.g., Diabetic Retinopathy"
                      className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Profession</label>
                    <input
                      type="text"
                      value={fileMetadata[selectedFileIndex]?.profession || ''}
                      onChange={e => updateSelectedFileMetadata('profession', e.target.value)}
                      placeholder="e.g., Engineer"
                      className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                    />
                  </div>

                  <div className="col-span-full">
                    <label className="block text-sm font-medium mb-1.5">Clinical Notes</label>
                    <textarea
                      value={fileMetadata[selectedFileIndex]?.notes || ''}
                      onChange={e => updateSelectedFileMetadata('notes', e.target.value)}
                      placeholder="Any additional clinical notes..."
                      className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 min-h-20 resize-y"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                Select a file to add metadata below.
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {loading && (
            <div className="border border-border rounded-xl bg-card p-4">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="font-medium">Uploading...</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, backgroundColor: '#9481ff' }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-lg transition-colors text-white font-medium disabled:opacity-60 flex items-center gap-2"
              style={{ backgroundColor: '#9481ff' }}
            >
              {loading ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadCloud size={16} />
                  Upload Sample
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
