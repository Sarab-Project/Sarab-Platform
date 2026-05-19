import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft, Download, FileImage, FileText, Film,
  File as FileIcon, AlertCircle, Loader, Tag as TagIcon
} from 'lucide-react';
import {
  fetchSampleById, downloadSample, downloadSampleFiles,
  fetchSampleFileBlob, triggerDownload, parseMetadata, fetchUserById,
  type Sample as ApiSample, type ResourceFile, type UserPublic
} from '../services/api';

interface FileItem {
  id: number;
  name: string;
  type: 'Image' | 'Video' | 'Document' | 'File';
  size: string;
  url?: string;
}

function getFileType(fileName: string): 'Image' | 'Video' | 'Document' | 'File' {
  const name = fileName.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|bmp|webp)$/.test(name)) return 'Image';
  if (/\.(mp4|avi|mov|webm|mkv|flv|wmv|m4v)$/.test(name)) return 'Video';
  if (/\.(pdf|doc|docx|txt|csv)$/.test(name)) return 'Document';
  return 'File';
}

export function SampleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [sample, setSample] = useState<ApiSample | null>(null);
  const [user, setUser] = useState<UserPublic | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<number | null>(null);

  const selectedResourceFile = sample?.files?.find(f => f.id === selectedFile?.id) ?? null;
  const additionalMetadata = sample
    ? Object.entries(parseMetadata(sample.metadata || '')).filter(
        ([key]) => !['EyeSide', 'Gender', 'Age', 'City', 'Status', 'Profession', 'Notes'].includes(key)
      )
    : [];

  const selectedFileMetadata = selectedResourceFile ? parseMetadata(selectedResourceFile.metadata || '') : {};
  const selectedFileAdditionalMetadata = selectedResourceFile
    ? Object.entries(selectedFileMetadata).filter(
        ([key]) => !['EyeSide', 'Gender', 'Age', 'City', 'Status', 'Profession', 'Notes'].includes(key)
      ) as [string, unknown][]
    : [];

  const getSelectedFileMetadataValue = (key: string) => {
    if (!selectedResourceFile) return null;
    const computedValue = (selectedResourceFile as any)[key];
    if (computedValue !== undefined && computedValue !== null) return computedValue;
    const rawValue = selectedFileMetadata[key] ?? selectedFileMetadata[key.toLowerCase()];
    return rawValue ?? null;
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSampleById(parseInt(id!));
        setSample(data);

        // Fetch user information
        try {
          const userData = await fetchUserById(data.createdBy);
          setUser(userData);
        } catch (userErr) {
          console.warn('Failed to load user information:', userErr);
          setUser(null);
        }

        const mapped: FileItem[] = (data.files || []).map((f: ResourceFile) => ({
          id: f.id,
          name: f.fileName,
          type: getFileType(f.fileName),
          size: f.size > 0 ? `${(f.size / 1048576).toFixed(2)} MB` : 'Unknown',
        }));
        setFiles(mapped);
        if (mapped.length > 0) setSelectedFile(mapped[0]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sample');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleDownloadAll = async () => {
    if (!sample) return;
    setDownloadingAll(true);
    try {
      const blob = await downloadSample(sample.id);
      triggerDownload(blob, `${sample.title.replace(/[^a-z0-9]/gi, '_')}.zip`);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleDownloadFile = async (file: FileItem) => {
    if (!sample) return;
    setDownloadingFileId(file.id);
    try {
      const blob = await fetchSampleFileBlob(sample.id, file.id);
      triggerDownload(blob, file.name);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloadingFileId(null);
    }
  };

  useEffect(() => {
    let activeUrl: string | null = null;

    const loadPreview = async () => {
      if (!sample || !selectedFile) {
        setPreviewUrl(null);
        return;
      }

      if (selectedFile.type !== 'Image' && selectedFile.type !== 'Video') {
        setPreviewUrl(null);
        return;
      }

      try {
        const blob = await fetchSampleFileBlob(sample.id, selectedFile.id);
        activeUrl = URL.createObjectURL(blob);
        setPreviewUrl(activeUrl);
      } catch (err) {
        console.error('Preview failed:', err);
        setPreviewUrl(null);
      }
    };

    loadPreview();

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [sample, selectedFile]);

  const renderPreview = () => {
    if (!selectedFile) return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-muted/20 rounded-xl border-2 border-dashed border-border text-muted-foreground">
        <FileIcon size={48} className="mb-3 opacity-40" />
        <p>Select a file to preview</p>
      </div>
    );

    if (selectedFile.type === 'Image') return (
      <div className="w-full min-h-[400px] flex items-center justify-center bg-black/5 rounded-xl overflow-hidden border border-border">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={selectedFile.name}
            className="max-w-full max-h-[600px] object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="text-muted-foreground text-sm">Loading preview…</div>
        )}
      </div>
    );

    if (selectedFile.type === 'Video') return (
      <div className="w-full min-h-[400px] flex items-center justify-center bg-black rounded-xl overflow-hidden border border-border">
        {previewUrl ? (
          <video
            key={previewUrl}
            src={previewUrl}
            controls
            className="max-w-full max-h-[600px] w-full"
          >
            <source src={previewUrl} type="video/mp4" />
            <source src={previewUrl} type="video/webm" />
            Your browser does not support video.
          </video>
        ) : (
          <div className="text-white/70 text-sm">Loading preview…</div>
        )}
      </div>
    );

    return (
      <div className="w-full min-h-[400px] flex flex-col items-center justify-center bg-card rounded-xl border border-border p-6 text-muted-foreground">
        <FileText size={48} className="mb-4 opacity-40" />
        <p className="mb-4 text-sm">Preview not available for this file type</p>
        <button
          onClick={() => handleDownloadFile(selectedFile)}
          className="flex items-center gap-2 px-4 py-2 bg-[#9481ff] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Download size={14} />
          Download to view
        </button>
      </div>
    );
  };

  const getFileIcon = (type: string) => {
    const cls = "text-[#9481ff]";
    if (type === 'Image') return <FileImage size={18} className={cls} />;
    if (type === 'Video') return <Film size={18} className={cls} />;
    if (type === 'Document') return <FileText size={18} className={cls} />;
    return <FileIcon size={18} className={cls} />;
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center py-20">
      <div className="text-center">
        <Loader size={32} className="mx-auto text-[#9481ff] animate-spin mb-3" />
        <p className="text-muted-foreground">Loading sample...</p>
      </div>
    </div>
  );

  if (error || !sample) return (
    <div className="flex-1 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft size={16} /> Back to Database
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={22} />
          <div>
            <h3 className="font-semibold text-red-900 mb-1">Error</h3>
            <p className="text-sm text-red-700">{error || 'Sample not found'}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Back */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#9481ff] mb-6 transition-colors font-medium"
        >
          <ArrowLeft size={16} />
          Back to Database
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h2 className="text-2xl font-bold">{sample.title}</h2>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDownloadAll}
                disabled={downloadingAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
                style={{ backgroundColor: '#9481ff' }}
              >
                {downloadingAll ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
                Download All
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
            {sample.downloadCount !== undefined && (
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1">
                <Download size={14} />
                {sample.downloadCount} downloads
              </span>
            )}
            {sample.viewCount !== undefined && (
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1">
                <span className="text-sm">👁️</span>
                {sample.viewCount} views
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              By {user ? `${user.firstName} ${user.lastName}` : `User #${sample.createdBy}`}
            </span>
            <span>•</span>
            <span>{new Date(sample.createdAt).toLocaleDateString()}</span>
            {sample.folderId && (
              <>
                <span>•</span>
                <span>Folder #{sample.folderId}</span>
              </>
            )}
          </div>
          {sample.description && (
            <p className="mt-3 text-muted-foreground">{sample.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main preview */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">
                  File Preview
                  {selectedFile && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({selectedFile.name})
                    </span>
                  )}
                </h3>
                {selectedFile && (
                  <button
                    onClick={() => handleDownloadFile(selectedFile)}
                    disabled={downloadingFileId === selectedFile.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-border text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
                  >
                    {downloadingFileId === selectedFile.id
                      ? <Loader size={13} className="animate-spin" />
                      : <Download size={13} />
                    }
                    Download
                  </button>
                )}
              </div>
              {renderPreview()}
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="border border-border rounded-xl bg-card p-5 shadow-sm">
                <h3 className="font-semibold mb-4">File Metadata</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {selectedResourceFile ? (
                    [
                      ['Gender', getSelectedFileMetadataValue('gender')],
                      ['Age', getSelectedFileMetadataValue('age') ? `${getSelectedFileMetadataValue('age')} years` : null],
                      ['City', getSelectedFileMetadataValue('city')],
                      ['Condition', getSelectedFileMetadataValue('status')],
                      ['Eye Side', getSelectedFileMetadataValue('eyeSide')],
                      ['Profession', getSelectedFileMetadataValue('profession')],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <div key={k as string}>
                        <div className="text-xs text-muted-foreground font-medium mb-0.5">{k}</div>
                        <div className="text-sm font-medium">{v}</div>
                      </div>
                    ))
                  ) : null}

                  {!selectedResourceFile && (
                    <div className="col-span-2 text-sm text-muted-foreground italic">Select a file to view metadata</div>
                  )}

                  {selectedResourceFile && selectedFileAdditionalMetadata.length === 0 && !getSelectedFileMetadataValue('gender') && !getSelectedFileMetadataValue('age') && !getSelectedFileMetadataValue('city') && !getSelectedFileMetadataValue('status') && !getSelectedFileMetadataValue('eyeSide') && !getSelectedFileMetadataValue('profession') && (
                    <div className="col-span-2 text-sm text-muted-foreground italic">No metadata provided for this file</div>
                  )}
                </div>
                {selectedResourceFile && selectedFileAdditionalMetadata.length > 0 && (
                  <div className="col-span-2 mt-4 border-t border-border pt-4">
                    <div className="text-xs text-muted-foreground font-medium mb-3">Additional metadata</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {selectedFileAdditionalMetadata.map(([key, value]) => (
                        <div key={key}>
                          <div className="text-xs text-muted-foreground font-medium mb-0.5">{key}</div>
                          <div className="text-sm font-medium break-words">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-border rounded-xl bg-card p-5 shadow-sm">
                <h3 className="font-semibold mb-4">Sample Info</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground font-medium mb-0.5">Sample ID</div>
                    <div className="text-sm font-medium">#{sample.id}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium mb-0.5">Files</div>
                    <div className="text-sm font-medium">{files.length} file{files.length !== 1 ? 's' : ''}</div>
                  </div>
                  {sample.downloadCount !== undefined && (
                    <div>
                      <div className="text-xs text-muted-foreground font-medium mb-0.5">Downloads</div>
                      <div className="text-sm font-medium">{sample.downloadCount}</div>
                    </div>
                  )}
                  {sample.viewCount !== undefined && (
                    <div>
                      <div className="text-xs text-muted-foreground font-medium mb-0.5">Views</div>
                      <div className="text-sm font-medium">{sample.viewCount}</div>
                    </div>
                  )}
                  {sample.notes && (
                    <div>
                      <div className="text-xs text-muted-foreground font-medium mb-0.5">Notes</div>
                      <div className="text-sm font-medium whitespace-pre-wrap">{sample.notes}</div>
                    </div>
                  )}
                  {additionalMetadata.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground font-medium mb-0.5">Additional Metadata</div>
                      <div className="text-sm font-medium">
                        {additionalMetadata.map(([key, value]) => (
                          <div key={key} className="mb-1">
                            <span className="font-semibold">{key}:</span> {String(value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Files */}
            <div className="border border-border rounded-xl bg-card p-5 shadow-sm">
              <h3 className="font-semibold mb-4">Files ({files.length})</h3>
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No files attached</p>
              ) : (
                <div className="space-y-2">
                  {files.map(file => (
                    <div
                      key={file.id}
                      onClick={() => setSelectedFile(file)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer
                        ${selectedFile?.id === file.id
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/20'
                          : 'border-border hover:bg-muted/40 hover:border-[#b8b8fe]'}`}
                    >
                      <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center
                        ${selectedFile?.id === file.id ? 'bg-primary/20' : 'bg-muted'}`}>
                        {getFileIcon(file.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-medium truncate ${selectedFile?.id === file.id ? 'text-[#9481ff]' : ''}`}>
                          {file.name}
                        </div>
                        <div className="text-xs text-muted-foreground">{file.size} · {file.type}</div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDownloadFile(file); }}
                        disabled={downloadingFileId === file.id}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-border transition-colors text-muted-foreground disabled:opacity-40"
                      >
                        {downloadingFileId === file.id
                          ? <Loader size={13} className="animate-spin" />
                          : <Download size={13} />
                        }
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="border border-border rounded-xl bg-card p-5 shadow-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TagIcon size={16} className="text-[#9481ff]" />
                Tags
              </h3>
              {sample.tags && sample.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {sample.tags.map(tag => (
                    <span
                      key={tag.id}
                      className="px-3 py-1 rounded-full text-xs font-medium border border-border bg-muted text-muted-foreground"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No tags</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
