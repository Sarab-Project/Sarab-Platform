import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchCollections,
  fetchSampleById,
  updateSample,
  type Collection,
  type Sample,
  type ResourceFile,
} from '../services/api';
import { ArrowLeft, AlertCircle, Loader, UploadCloud, X } from 'lucide-react';
import { getErrorMessage } from '../services/error';

export function EditSample() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [sample, setSample] = useState<Sample | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [folderId, setFolderId] = useState('');
  const [eyeSide, setEyeSide] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');
  const [profession, setProfession] = useState('');
  const [notes, setNotes] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [deletedFiles, setDeletedFiles] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const selectedCollection = collections.find(c => c.id.toString() === selectedCollectionId);
  const availableFolders = selectedCollection?.folders || [];

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const sampleId = parseInt(id || '0');
        const [sampleData, collectionData] = await Promise.all([
          fetchSampleById(sampleId),
          fetchCollections(),
        ]);

        setSample(sampleData);
        setTitle(sampleData.title);
        setDescription(sampleData.description || '');
        setFolderId(sampleData.folderId?.toString() || '');
        setEyeSide(sampleData.eyeSide || '');
        setGender(sampleData.gender || '');
        setAge(sampleData.age?.toString() || '');
        setCity(sampleData.city || '');
        setStatus(sampleData.status || '');
        setProfession(sampleData.profession || '');
        setNotes(sampleData.notes || '');
        setCollections(collectionData);

        const matchingCollection = collectionData.find(c =>
          c.folders?.some(f => f.id === sampleData.folderId),
        );
        if (matchingCollection) {
          setSelectedCollectionId(matchingCollection.id.toString());
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load sample for editing.'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, isAuthenticated, navigate]);

  const handleNewFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    setNewFiles(prev => [...prev, ...incoming]);
  };

  const handleRemoveNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleDeleteFile = (fileId: number) => {
    setDeletedFiles(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId],
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!sample) return;
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await updateSample(sample.id, {
        title: title.trim(),
        description,
        folderId: folderId ? parseInt(folderId) : undefined,
        eyeSide: eyeSide || null,
        gender: gender || null,
        age: age ? Number(age) : null,
        city: city || null,
        status: status || null,
        profession: profession || null,
        notes: notes || null,
        newFiles: newFiles.length > 0 ? newFiles : undefined,
        deletedFiles: deletedFiles.length > 0 ? deletedFiles : undefined,
      });
      setSuccess(true);
      setTimeout(() => navigate(`/sample/${sample.id}`), 1200);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save changes.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 bg-background">
        <div className="text-center">
          <Loader size={32} className="mx-auto text-[#9481ff] animate-spin mb-3" />
          <p className="text-muted-foreground">Loading sample details...</p>
        </div>
      </div>
    );
  }

  if (!sample) {
    return (
      <div className="flex-1 bg-background">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#9481ff] mb-6">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Could not find the sample to edit.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#9481ff] mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Sample
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold">Edit Sample</h2>
          <p className="text-muted-foreground">Update the sample details and save changes.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Changes saved successfully. Redirecting back to the sample...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border border-border rounded-xl bg-card p-6">
            <h3 className="font-semibold mb-4">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 min-h-[120px] resize-y"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Collection</label>
                  <select
                    value={selectedCollectionId}
                    onChange={e => setSelectedCollectionId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                  >
                    <option value="">Select a collection</option>
                    {collections.map(collection => (
                      <option key={collection.id} value={collection.id}>{collection.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Folder</label>
                  <select
                    value={folderId}
                    onChange={e => setFolderId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                  >
                    <option value="">Select a folder</option>
                    {availableFolders.map(folder => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-xl bg-card p-6">
            <h3 className="font-semibold mb-4">Metadata</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">Eye Side</label>
                <input
                  type="text"
                  value={eyeSide}
                  onChange={e => setEyeSide(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Gender</label>
                <input
                  type="text"
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Age</label>
                <input
                  type="number"
                  min="0"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Status</label>
                <input
                  type="text"
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Profession</label>
                <input
                  type="text"
                  value={profession}
                  onChange={e => setProfession(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 min-h-[100px] resize-y"
              />
            </div>
          </div>

          {sample.tags?.length > 0 && (
            <div className="border border-border rounded-xl bg-card p-6">
              <h3 className="font-semibold mb-4">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {sample.tags.map(tag => (
                  <span key={tag.id} className="rounded-full border border-border bg-muted px-3 py-1 text-sm text-muted-foreground">
                    {tag.name}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Tags are shown as read-only while editing.</p>
            </div>
          )}

          <div className="border border-border rounded-xl bg-card p-6">
            <h3 className="font-semibold mb-4">Files</h3>
            <div className="space-y-4">
              {sample.files?.filter(file => !file.isDeleted).length ? (
                <div className="space-y-3">
                  {sample.files.filter(file => !file.isDeleted).map(file => (
                    <label key={file.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{file.fileName}</span>
                        <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{(file.size / 1048576).toFixed(2)} MB</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={deletedFiles.includes(file.id)}
                          onChange={() => toggleDeleteFile(file.id)}
                          className="h-4 w-4 rounded border-border text-[#ef4444] focus:ring-[#ef4444]/40"
                        />
                        <span className="text-sm text-muted-foreground">Remove</span>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active files are attached to this sample.</p>
              )}
            </div>
            <div className="mt-6 border-t border-border pt-6">
              <label className="block text-sm font-medium mb-2">Add New Files</label>
              <input
                type="file"
                multiple
                onChange={e => handleNewFiles(e.target.files)}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-[#9481ff] file:px-4 file:py-2 file:text-sm file:text-white"
              />
              {newFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {newFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                      <div>
                        <div className="text-sm font-medium">{file.name}</div>
                        <div className="text-xs text-muted-foreground">{(file.size / 1048576).toFixed(2)} MB</div>
                      </div>
                      <button type="button" onClick={() => handleRemoveNewFile(index)} className="text-muted-foreground hover:text-foreground">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#9481ff] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? <Loader size={16} className="animate-spin" /> : <><UploadCloud size={16} /> Save Changes</>}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/sample/${sample.id}`)}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
