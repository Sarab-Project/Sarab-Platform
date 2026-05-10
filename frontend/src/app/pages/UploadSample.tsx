import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { fetchCollections, uploadSample, type Collection } from '../services/api';
import { UploadCloud, X, File as FileIcon, AlertCircle, CheckCircle, Loader } from 'lucide-react';

export function UploadSample() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [folderId, setFolderId] = useState('');
  const [eyeSide, setEyeSide] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');
  const [profession, setProfession] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collections/Folders
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [collectionsLoading, setCollectionsLoading] = useState(true);

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
  }, [isAuthenticated]);

  const selectedCollection = collections.find(c => c.id.toString() === selectedCollectionId);
  const availableFolders = selectedCollection?.folders || [];

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setSelectedFiles(prev => [...prev, ...Array.from(files)]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
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
      await uploadSample({
        title,
        description: description || undefined,
        folderId: parseInt(folderId),
        eyeSide: eyeSide || undefined,
        gender: gender || undefined,
        age: age ? parseInt(age) : undefined,
        city: city || undefined,
        status: status || undefined,
        profession: profession || undefined,
        notes: notes || undefined,
        files: selectedFiles,
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
                  <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-background">
                    <FileIcon size={18} className="text-[#9481ff] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{file.name}</div>
                      <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clinical Metadata */}
          <div className="border border-border rounded-xl bg-card p-6">
            <h3 className="font-semibold mb-5">Clinical Metadata <span className="text-xs font-normal text-muted-foreground">(optional)</span></h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Eye Side</label>
                <select
                  value={eyeSide}
                  onChange={e => setEyeSide(e.target.value)}
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
                  value={gender}
                  onChange={e => setGender(e.target.value)}
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
                  value={age}
                  onChange={e => setAge(e.target.value)}
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
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="e.g., Cairo"
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Condition / Status</label>
                <input
                  type="text"
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  placeholder="e.g., Diabetic Retinopathy"
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Profession</label>
                <input
                  type="text"
                  value={profession}
                  onChange={e => setProfession(e.target.value)}
                  placeholder="e.g., Engineer"
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                />
              </div>

              <div className="col-span-full">
                <label className="block text-sm font-medium mb-1.5">Clinical Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional clinical notes..."
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 min-h-20 resize-y"
                />
              </div>
            </div>
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
