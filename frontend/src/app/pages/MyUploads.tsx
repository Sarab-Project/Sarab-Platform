import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { fetchSamples, downloadSample, triggerDownload, type Sample } from '../services/api';
import { getErrorMessage } from '../services/error';
import { Upload, Download, File, Loader, AlertCircle, Eye } from 'lucide-react';

export function MyUploads() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    loadSamples();
  }, [isAuthenticated, user]);

  async function loadSamples() {
    setLoading(true);
    setError('');
    try {
      const all = await fetchSamples();
      const mine = user ? all.filter(s => s.createdBy === user.id) : all;
      setSamples(mine);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load uploads'));
    } finally {
      setLoading(false);
    }
  }

  const handleDownload = async (sample: Sample) => {
    setDownloadingId(sample.id);
    try {
      const blob = await downloadSample(sample.id);
      triggerDownload(blob, `${sample.title.replace(/[^a-z0-9]/gi, '_')}.zip`);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const getFileTypeSummary = (sample: Sample) => {
    if (!sample.files?.length) return 'No files';
    const types = sample.files.map(f => {
      const name = f.fileName.toLowerCase();
      if (/\.(jpg|jpeg|png|gif|bmp|webp)$/.test(name)) return 'Image';
      if (/\.(mp4|avi|mov|webm|mkv|flv|wmv|m4v)$/.test(name)) return 'Video';
      return 'Document';
    });
    const counts: Record<string, number> = {};
    types.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).map(([t, c]) => `${c} ${t}${c > 1 ? 's' : ''}`).join(', ');
  };

  const totalFiles = samples.reduce((sum, s) => sum + (s.files?.length || 0), 0);
  const totalDownloads = samples.reduce((sum, s) => sum + (s.downloadCount || 0), 0);
  const totalViews = samples.reduce((sum, s) => sum + (s.viewCount || 0), 0);

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="mb-1 font-bold">My Uploads</h2>
            <p className="text-muted-foreground">Manage your contributed samples</p>
          </div>
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-white font-medium"
            style={{ backgroundColor: '#9481ff' }}
          >
            <Upload size={16} />
            Upload New Sample
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <div className="border border-border rounded-xl bg-card p-4">
            <div className="text-2xl font-bold mb-0.5" style={{ color: '#9481ff' }}>
              {loading ? '—' : samples.length}
            </div>
            <div className="text-sm text-muted-foreground">Total Samples</div>
          </div>
          <div className="border border-border rounded-xl bg-card p-4">
            <div className="text-2xl font-bold mb-0.5" style={{ color: '#9481ff' }}>
              {loading ? '—' : totalFiles}
            </div>
            <div className="text-sm text-muted-foreground">Total Files</div>
          </div>
          <div className="border border-border rounded-xl bg-card p-4">
            <div className="text-2xl font-bold mb-0.5" style={{ color: '#9481ff' }}>
              {loading ? '—' : totalDownloads}
            </div>
            <div className="text-sm text-muted-foreground">Downloads</div>
          </div>
          <div className="border border-border rounded-xl bg-card p-4">
            <div className="text-2xl font-bold mb-0.5" style={{ color: '#9481ff' }}>
              {loading ? '—' : totalViews}
            </div>
            <div className="text-sm text-muted-foreground">Views</div>
          </div>
          <div className="border border-border rounded-xl bg-card p-4">
            <div className="text-2xl font-bold mb-0.5" style={{ color: '#9481ff' }}>
              {loading ? '—' : samples.filter(s => s.status).length}
            </div>
            <div className="text-sm text-muted-foreground">With Condition</div>
          </div>
        </div>

        {loading && (
          <div className="text-center py-16">
            <Loader size={32} className="mx-auto text-[#9481ff] animate-spin mb-3" />
            <p className="text-muted-foreground">Loading your uploads...</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {!loading && !error && samples.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
            <Upload size={48} className="mx-auto text-muted-foreground mb-4 opacity-40" />
            <h3 className="font-semibold mb-2">No uploads yet</h3>
            <p className="text-muted-foreground mb-6">Start by uploading your first sample to the database.</p>
            <button
              onClick={() => navigate('/upload')}
              className="px-6 py-3 rounded-xl font-medium text-white"
              style={{ backgroundColor: '#9481ff' }}
            >
              Upload Your First Sample
            </button>
          </div>
        )}

        {!loading && samples.length > 0 && (
          <div className="border border-border rounded-xl bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border" style={{ backgroundColor: '#9481ff' }}>
                  <th className="px-6 py-3 text-left text-sm font-mediu">Title</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Files</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Condition</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Uploaded</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Downloads</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Views</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {samples.map(sample => (
                  <tr
                    key={sample.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/sample/${sample.id}`)}
                        className="text-sm font-medium hover:text-[#9481ff] transition-colors text-left line-clamp-1"
                      >
                        {sample.title}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <File size={14} />
                        {getFileTypeSummary(sample)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {sample.status ? (
                        <span
                          className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium"
                          style={{ backgroundColor: '#9481ff', color: '#ffffff', border: '1px solid #b8b8fe' }}
                        >
                          {sample.status}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(sample.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {sample.downloadCount || 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {sample.viewCount || 0}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/sample/${sample.id}`)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 border border-border rounded-lg hover:bg-muted transition-colors"
                        >
                          <Eye size={12} />
                          View
                        </button>
                        <button
                          onClick={() => handleDownload(sample)}
                          disabled={downloadingId === sample.id}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                        >
                          {downloadingId === sample.id ? (
                            <Loader size={12} className="animate-spin" />
                          ) : (
                            <Download size={12} />
                          )}
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
