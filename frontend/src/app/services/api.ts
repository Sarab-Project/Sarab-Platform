import { getStoredToken } from '../contexts/AuthContext';

export const API_BASE_URL = 'http://localhost:5027/api';
export const STATIC_BASE_URL = 'http://localhost:5027';

export interface ResourceFile {
  id: number;
  fileName: string;
  fileType: number; // 0 = Image, 1 = Video, 2 = Document
  filePath: string;
  size: number;
  sampleId?: number;
  isDeleted?: boolean;
  uploadedBy?: number;
  createdAt?: string;
  uploadedAt: string;
  deletedAt?: string;
}

export interface Sample {
  id: number;
  title: string;
  folderId: number | null;
  folder?: any;
  description: string | null;
  createdBy: number;
  downloadCount?: number;
  metadata?: string;
  eyeSide?: string | null;
  gender: string | null;
  age: number;
  city: string | null;
  status: string | null;
  profession?: string | null;
  notes: string | null;
  files: ResourceFile[];
  tags: Tag[];
  isDeleted?: boolean;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface Collection {
  id: number;
  name: string;
  description: string | null;
  createdBy: number;
  ownerId: number;
  ownerType: number; // 0 = User, 1 = Group
  templateId?: number;
  downloadCount?: number;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  folders?: CollectionFolder[];
}

export interface CollectionFolder {
  id: number;
  name: string;
  description?: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Folder {
  id: number;
  name: string;
  description?: string;
  parentId: number | null;
  collectionId: number;
  createdBy?: number;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  children?: Folder[];
  samples?: Sample[];
}

export interface GroupMember {
  role: number; // 0=Owner, 1=Contributor, 2=Researcher, 3=Guest
  joinedAt: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    profileImagePath: string | null;
  };
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  createdBy: number;
  isDeleted?: boolean;
  createdAt: string;
  deletedAt?: string;
  members?: GroupMember[];
  collections?: any[];
}

export interface UserPublic {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: number; // 0=Admin, 1=Contributor, 2=Researcher
  profileImagePath: string | null;
  createdAt: string;
  isActive: boolean;
}

export interface SearchSampleDto {
  gender?: string;
  city?: string;
  status?: string;
  minAge?: number;
  maxAge?: number;
  keyword?: string;
  tagIds?: number[];
  page?: number;
  pageSize?: number;
}

export interface DownloadSamplesDto {
  sampleIds: number[];
}

export interface DownloadFilesDto {
  fileIds: number[];
}

export interface UploadSampleDto {
  title: string;
  description?: string;
  folderId: number;
  eyeSide?: string;
  gender?: string;
  age?: number;
  city?: string;
  status?: string;
  profession?: string;
  notes?: string;
  tags?: string[];
  files: File[];
}

export interface CreateCollectionDto {
  name: string;
  description?: string;
  createdBy: number;
  ownerType: number;
  ownerId: number;
  templateId?: number;
}

export interface CreateGroupDto {
  name: string;
  description?: string;
  createdBy: number;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  role?: number;
}

// ==================== HELPERS ====================

function getAuthHeaders(isFormData = false): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body.message || Object.values(body.errors || {}).flat().join(', ') || errMsg;
    } catch {
      // no-op
    }
    throw new Error(errMsg);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json() as Promise<T>;
  return res.blob() as unknown as Promise<T>;
}

export function parseMetadata(metadataString: string): Record<string, any> {
  try {
    return JSON.parse(metadataString);
  } catch {
    return {};
  }
}

// ==================== AUTH API ====================

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<any>(res);
}

export async function apiSignup(firstName: string, lastName: string, email: string, password: string, role: 'Researcher' | 'Contributor') {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, lastName, email, password, role }),
  });
  return handleResponse<any>(res);
}

// ==================== USERS API ====================

export async function fetchUsers(): Promise<UserPublic[]> {
  const res = await fetch(`${API_BASE_URL}/users`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<UserPublic[]>(res);
}

export async function fetchUserById(id: number): Promise<UserPublic> {
  const res = await fetch(`${API_BASE_URL}/users/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<UserPublic>(res);
}

export async function updateUser(id: number, dto: UpdateUserDto): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(dto),
  });
  return handleResponse<{ message: string }>(res);
}

export async function deleteUser(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse<void>(res);
}

export async function reviewUserDocument(
  documentId: number,
  status: number,
  rejectionReason?: string
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/users/documents/${documentId}/review`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status, rejectionReason: rejectionReason || null }),
  });
  return handleResponse<{ message: string }>(res);
}

// ==================== SAMPLES API ====================

export async function fetchSamples(): Promise<Sample[]> {
  const res = await fetch(`${API_BASE_URL}/samples`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Sample[]>(res);
}

export async function fetchSampleById(id: number): Promise<Sample> {
  const res = await fetch(`${API_BASE_URL}/samples/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Sample>(res);
}

export async function fetchSampleFileBlob(sampleId: number, fileId: number): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/samples/${sampleId}/files/${fileId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to load file (${res.status})`);
  }
  return await res.blob();
}

export async function searchSamples(dto: SearchSampleDto): Promise<Sample[]> {
  const res = await fetch(`${API_BASE_URL}/samples/search`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(dto),
  });
  return handleResponse<Sample[]>(res);
}

export async function uploadSample(dto: UploadSampleDto): Promise<Sample> {
  const formData = new FormData();
  formData.append('title', dto.title);
  if (dto.description) formData.append('description', dto.description);
  formData.append('folderId', dto.folderId.toString());
  if (dto.eyeSide) formData.append('eyeSide', dto.eyeSide);
  if (dto.gender) formData.append('gender', dto.gender);
  if (dto.age !== undefined) formData.append('age', dto.age.toString());
  if (dto.city) formData.append('city', dto.city);
  if (dto.status) formData.append('status', dto.status);
  if (dto.profession) formData.append('profession', dto.profession);
  if (dto.notes) formData.append('notes', dto.notes);
  dto.files.forEach(file => formData.append('files', file));

  const res = await fetch(`${API_BASE_URL}/samples/upload`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: formData,
  });
  return handleResponse<Sample>(res);
}

export async function downloadSample(sampleId: number): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/samples/${sampleId}/download`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.blob();
}

export async function downloadSamples(sampleIds: number[]): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/samples/download`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ sampleIds }),
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.blob();
}

export async function downloadSampleFiles(sampleId: number, fileIds: number[]): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/samples/${sampleId}/files/download`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ fileIds }),
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.blob();
}

// ==================== COLLECTIONS API ====================

export async function fetchCollections(): Promise<Collection[]> {
  const res = await fetch(`${API_BASE_URL}/collections`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Collection[]>(res);
}

export async function fetchCollectionById(id: number): Promise<Collection> {
  const res = await fetch(`${API_BASE_URL}/collections/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Collection>(res);
}

export async function createCollection(dto: CreateCollectionDto): Promise<Collection> {
  const res = await fetch(`${API_BASE_URL}/collections`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(dto),
  });
  return handleResponse<Collection>(res);
}

export async function downloadCollection(id: number): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/collections/${id}/download`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.blob();
}

export async function downloadCollections(collectionIds: number[]): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/collections/download`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ collectionIds }),
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.blob();
}

// ==================== FOLDERS API ====================

export async function fetchFolders(): Promise<Folder[]> {
  const res = await fetch(`${API_BASE_URL}/folders`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Folder[]>(res);
}

export async function fetchFolderById(id: number): Promise<Folder> {
  const res = await fetch(`${API_BASE_URL}/folders/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Folder>(res);
}

export interface CreateFolderDto {
  name: string;
  parentId?: number;
  collectionId: number;
  createdBy: number;
}

export async function createFolder(dto: CreateFolderDto): Promise<Folder> {
  const res = await fetch(`${API_BASE_URL}/folders`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(dto),
  });
  return handleResponse<Folder>(res);
}

// ==================== GROUPS API ====================

export async function fetchGroups(): Promise<Group[]> {
  const res = await fetch(`${API_BASE_URL}/groups`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Group[]>(res);
}

export async function fetchGroupById(id: number): Promise<Group> {
  const res = await fetch(`${API_BASE_URL}/groups/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Group>(res);
}

export async function createGroup(dto: CreateGroupDto): Promise<Group> {
  const res = await fetch(`${API_BASE_URL}/groups`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(dto),
  });
  return handleResponse<Group>(res);
}

export async function changeMemberRole(
  groupId: number,
  userId: number,
  newRole: number
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/groups/${groupId}/members/${userId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ newRole }),
  });
  return handleResponse<{ message: string }>(res);
}

export async function removeMember(
  groupId: number,
  userId: number
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse<{ message: string }>(res);
}

// ==================== TAGS API ====================

export async function fetchTags(): Promise<Tag[]> {
  const res = await fetch(`${API_BASE_URL}/tags`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Tag[]>(res);
}

// ==================== DOWNLOAD HELPER ====================

export function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
