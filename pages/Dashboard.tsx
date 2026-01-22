
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  LogOut, Shield, HardDrive, 
  Upload, Trash2, Loader2, FolderPlus, FileText, 
  Users, StickyNote, Folder, X,
  ChevronRight, Search, Home, Plus,
  Download, AlertCircle, LayoutGrid, List
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import UpgradeModal from '../components/UpgradeModal';

// --- Types ---
interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  folderId: string | null;
  storagePath: string;
  downloadURL: string;
  createdAt: Timestamp;
}

interface FolderItem {
  id: string;
  name: string;
  createdAt: Timestamp;
}

interface NoteItem {
  id: string;
  title: string;
  content: string;
  createdAt: Timestamp;
}

interface MemberItem {
  id: string;
  name: string;
  role: string;
  createdAt: Timestamp;
}

type TabView = 'overview' | 'files' | 'notes' | 'team';

interface DashboardProps {
  onNavigate: (path: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const FILE_LIMIT = 5;
  
  // Data State
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  
  // UI State
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  
  // Modal & Confirmation States
  const [modalOpen, setModalOpen] = useState<{ 
    type: 'folder' | 'file' | 'note' | 'member' | null 
  }>({ type: null });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    type: 'folders' | 'files' | 'notes' | 'teamMembers';
    name: string;
    storagePath?: string;
  } | null>(null);

  // Form States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    content: '',
    role: 'Viewer'
  });

  // Derived state
  const hasReachedLimit = files.length >= FILE_LIMIT;

  // --- Firestore Listeners ---
  useEffect(() => {
    if (!user) return;

    const basePath = `users/${user.uid}`;
    
    // Listen to Folders
    const qFolders = query(collection(db, `${basePath}/folders`), orderBy('createdAt', 'desc'));
    const unsubFolders = onSnapshot(qFolders, (snapshot) => {
      setFolders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FolderItem)));
    });

    // Listen to Files
    const qFiles = query(collection(db, `${basePath}/files`), orderBy('createdAt', 'desc'));
    const unsubFiles = onSnapshot(qFiles, (snapshot) => {
      setFiles(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FileItem)));
    });

    // Listen to Notes
    const qNotes = query(collection(db, `${basePath}/notes`), orderBy('createdAt', 'desc'));
    const unsubNotes = onSnapshot(qNotes, (snapshot) => {
      setNotes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NoteItem)));
    });

    // Listen to Team Members
    const qMembers = query(collection(db, `${basePath}/teamMembers`), orderBy('createdAt', 'desc'));
    const unsubMembers = onSnapshot(qMembers, (snapshot) => {
      setMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MemberItem)));
      setIsLoading(false);
    });

    return () => {
      unsubFolders();
      unsubFiles();
      unsubNotes();
      unsubMembers();
    };
  }, [user]);

  // --- Handlers ---
  const handleSignOut = async () => {
    await signOut();
    onNavigate('/');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !modalOpen.type) return;
    
    setIsSubmitting(true);
    const basePath = `users/${user.uid}`;

    try {
      if (modalOpen.type === 'folder') {
        await addDoc(collection(db, `${basePath}/folders`), {
          name: formData.name || 'Untitled Folder',
          createdAt: serverTimestamp()
        });
      } else if (modalOpen.type === 'file') {
        if (!selectedFile) return;
        if (hasReachedLimit) {
            setIsUpgradeModalOpen(true);
            return;
        }

        const fileId = doc(collection(db, 'temp')).id;
        const storagePath = `user_uploads/${user.uid}/${fileId}-${selectedFile.name}`;
        const storageRef = ref(storage, storagePath);
        
        const uploadTask = uploadBytesResumable(storageRef, selectedFile);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => reject(error),
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              await addDoc(collection(db, `${basePath}/files`), {
                name: selectedFile.name,
                size: selectedFile.size,
                type: selectedFile.type,
                storagePath: storagePath,
                downloadURL: downloadURL,
                folderId: currentFolderId,
                createdAt: serverTimestamp()
              });
              resolve(true);
            }
          );
        });
      } else if (modalOpen.type === 'note') {
        await addDoc(collection(db, `${basePath}/notes`), {
          title: formData.title || 'Untitled Note',
          content: formData.content,
          createdAt: serverTimestamp()
        });
      } else if (modalOpen.type === 'member') {
        await addDoc(collection(db, `${basePath}/teamMembers`), {
          name: formData.name,
          role: formData.role,
          createdAt: serverTimestamp()
        });
      }
      
      setModalOpen({ type: null });
      setFormData({ name: '', title: '', content: '', role: 'Viewer' });
      setSelectedFile(null);
      setUploadProgress(0);
    } catch (err) {
      console.error("Error creating document: ", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeletion = async () => {
    if (!user || !deleteConfirmation) return;
    
    setIsSubmitting(true);
    try {
      if (deleteConfirmation.type === 'files' && deleteConfirmation.storagePath) {
        const fileRef = ref(storage, deleteConfirmation.storagePath);
        await deleteObject(fileRef);
      }
      await deleteDoc(doc(db, `users/${user.uid}/${deleteConfirmation.type}`, deleteConfirmation.id));
      setDeleteConfirmation(null);
    } catch (err) {
      console.error("Error deleting: ", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFiles = files.filter(f => 
    (currentFolderId ? f.folderId === currentFolderId : !f.folderId) &&
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFolders = folders.filter(f => 
    !currentFolderId && f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Render Sections ---

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
          <HardDrive size={24} />
        </div>
        <div className="flex items-baseline gap-2">
            <div className="text-4xl font-extrabold text-slate-900 mb-1">{files.length}</div>
            <div className="text-sm font-bold text-slate-400">/ {FILE_LIMIT} limit</div>
        </div>
        <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Assets</div>
        <button onClick={() => setActiveTab('files')} className="mt-6 text-emerald-600 text-sm font-bold flex items-center gap-2 hover:translate-x-1 transition-transform">
          View all files <ChevronRight size={16} />
        </button>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
          <StickyNote size={24} />
        </div>
        <div className="text-4xl font-extrabold text-slate-900 mb-1">{notes.length}</div>
        <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Secure Notes</div>
        <button onClick={() => setActiveTab('notes')} className="mt-6 text-blue-600 text-sm font-bold flex items-center gap-2 hover:translate-x-1 transition-transform">
          View all notes <ChevronRight size={16} />
        </button>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
          <Users size={24} />
        </div>
        <div className="text-4xl font-extrabold text-slate-900 mb-1">{members.length}</div>
        <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Team Members</div>
        <button onClick={() => setActiveTab('team')} className="mt-6 text-purple-600 text-sm font-bold flex items-center gap-2 hover:translate-x-1 transition-transform">
          Manage team <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  const renderFiles = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
           <button 
             onClick={() => setCurrentFolderId(null)}
             className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${!currentFolderId ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-500'}`}
           >
             <Home size={16} /> Root
           </button>
           {currentFolderId && (
             <>
               <ChevronRight size={14} className="text-slate-300" />
               <span className="font-bold text-slate-900">
                 {folders.find(f => f.id === currentFolderId)?.name}
               </span>
             </>
           )}
        </div>
        <div className="flex flex-col sm:flex-row items-end gap-3 w-full sm:w-auto">
            {hasReachedLimit && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-100 rounded-lg animate-in fade-in slide-in-from-right-2">
                <AlertCircle size={14} className="text-amber-600" />
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">You’ve reached the free plan limit.</span>
                <button 
                    onClick={() => setIsUpgradeModalOpen(true)}
                    className="text-[10px] font-black text-amber-900 hover:underline underline-offset-2 ml-1"
                >
                    UPGRADE
                </button>
              </div>
            )}
            <div className="flex gap-2 w-full sm:w-auto">
                <button 
                    onClick={() => setModalOpen({ type: 'folder' })}
                    className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
                    <FolderPlus size={18} /> New Folder
                </button>
                <button 
                    onClick={() => setModalOpen({ type: 'file' })}
                    disabled={hasReachedLimit}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                        hasReachedLimit 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none' 
                            : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/10'
                    }`}
                >
                    <Plus size={18} /> Add File
                </button>
            </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden min-h-[400px]">
        {filteredFolders.length === 0 && filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <HardDrive className="text-slate-300" size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No assets found</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto mt-2">Start by creating a folder or uploading your first secure file.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredFolders.map(folder => (
              <div key={folder.id} onClick={() => setCurrentFolderId(folder.id)} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer group transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                    <Folder size={20} fill="currentColor" className="opacity-20" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{folder.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Folder</div>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmation({ id: folder.id, type: 'folders', name: folder.name }); }}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {filteredFiles.map(file => (
              <div key={file.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 group transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{file.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type.split('/')[1]?.toUpperCase() || 'FILE'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <a 
                    href={file.downloadURL} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <Download size={16} />
                  </a>
                  <button 
                    onClick={() => setDeleteConfirmation({ id: file.id, type: 'files', name: file.name, storagePath: file.storagePath })}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderNotes = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Secure Notes</h2>
        <button 
          onClick={() => setModalOpen({ type: 'note' })}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
        >
          <Plus size={18} /> New Note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-20 text-center">
          <StickyNote className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">No notes yet</h3>
          <p className="text-slate-500 text-sm mt-2">Capture ideas and sensitive data securely.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map(note => (
            <div key={note.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all relative group">
              <button 
                onClick={() => setDeleteConfirmation({ id: note.id, type: 'notes', name: note.title })}
                className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={16} />
              </button>
              <h4 className="font-bold text-slate-900 mb-2 pr-8">{note.title}</h4>
              <p className="text-sm text-slate-500 line-clamp-4 leading-relaxed">{note.content}</p>
              <div className="mt-4 pt-4 border-t border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {note.createdAt ? new Date(note.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTeam = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Team Management</h2>
        <button 
          onClick={() => setModalOpen({ type: 'member' })}
          className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-500 transition-colors flex items-center gap-2 shadow-lg shadow-purple-900/10"
        >
          <Plus size={18} /> Add Member
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {members.length === 0 ? (
          <div className="py-24 text-center">
            <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Workspace is empty</h3>
            <p className="text-slate-500 text-sm mt-2">Invite your team to start collaborating securely.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map(member => (
              <div key={member.id} className="px-8 py-5 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center font-bold text-sm">
                    {member.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{member.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        member.role === 'Admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {member.role}
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setDeleteConfirmation({ id: member.id, type: 'teamMembers', name: member.name })}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Decrypting Vault...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 pt-32 min-h-screen relative">
      
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
         <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-950 tracking-tight">VaultFlow Dashboard</h1>
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <Shield size={16} className="text-emerald-500" /> Secure workspace for <span className="text-slate-900 font-bold">{user?.email}</span>
            </p>
         </div>
         <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center font-bold text-xs">
                {user?.email?.substring(0, 2).toUpperCase()}
              </div>
              <div className="text-xs font-bold text-slate-900 truncate max-w-[150px]">{user?.email}</div>
            </div>
            <button 
              onClick={handleSignOut} 
              className="p-3 text-slate-400 hover:text-red-600 bg-white border border-slate-200 rounded-2xl hover:bg-red-50 transition-all shadow-sm"
              title="Sign Out"
            >
              <LogOut size={22} />
            </button>
         </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl w-fit mb-10 shadow-inner">
         {(['overview', 'files', 'notes', 'team'] as const).map(tab => (
            <button 
              key={tab} 
              onClick={() => { setActiveTab(tab); setCurrentFolderId(null); }} 
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all capitalize ${activeTab === tab ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
                {tab}
            </button>
         ))}
      </div>

      {/* Tab Search Bar (Active for Files/Notes) */}
      {(activeTab === 'files' || activeTab === 'notes') && (
        <div className="relative mb-8 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder={`Search ${activeTab}...`} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-400 shadow-sm"
          />
        </div>
      )}

      {/* Content Rendering */}
      <div className="pb-20">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'files' && renderFiles()}
        {activeTab === 'notes' && renderNotes()}
        {activeTab === 'team' && renderTeam()}
      </div>

      {/* --- Delete Confirmation Modal --- */}
      {deleteConfirmation && (
         <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-in fade-in" />
             <div className="relative w-full max-sm bg-white rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in-95">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Are you sure?</h3>
                <p className="text-slate-500 text-sm mb-8">
                  You are about to permanently delete <strong>{deleteConfirmation.name}</strong>. This action cannot be undone.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setDeleteConfirmation(null)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDeletion}
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-500 transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : 'Delete'}
                  </button>
                </div>
             </div>
         </div>
      )}

      {/* --- Action Modals --- */}
      {modalOpen.type && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => !isSubmitting && setModalOpen({ type: null })} />
             <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-8 pt-8 pb-4 flex justify-between items-center">
                   <h3 className="text-2xl font-black text-slate-900 capitalize">
                     {modalOpen.type === 'member' ? 'Invite Member' : `New ${modalOpen.type}`}
                   </h3>
                   <button onClick={() => setModalOpen({ type: null })} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
                </div>
                
                <form onSubmit={handleCreate} className="p-8 space-y-6">
                   {modalOpen.type === 'folder' && (
                      <div className="space-y-2">
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Folder Name</label>
                         <input 
                           type="text" 
                           value={formData.name} 
                           onChange={(e) => setFormData({...formData, name: e.target.value})} 
                           placeholder="Strategy 2024" 
                           className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" 
                           autoFocus 
                           required
                         />
                      </div>
                   )}

                   {modalOpen.type === 'file' && (
                      <div className="space-y-6">
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Select Asset</label>
                            <div 
                              onClick={() => fileInputRef.current?.click()}
                              className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group"
                            >
                               <input 
                                 type="file" 
                                 ref={fileInputRef}
                                 className="hidden" 
                                 onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                               />
                               {selectedFile ? (
                                 <div className="flex flex-col items-center">
                                    <FileText className="text-emerald-500 mb-2" size={32} />
                                    <span className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{selectedFile.name}</span>
                                    <span className="text-xs text-slate-400">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                                 </div>
                               ) : (
                                 <div className="flex flex-col items-center">
                                    <Upload className="text-slate-300 group-hover:text-emerald-500 transition-colors mb-2" size={32} />
                                    <span className="text-sm font-bold text-slate-500">Click to choose a file</span>
                                    <span className="text-xs text-slate-400">Securely upload to your vault</span>
                                 </div>
                               )}
                            </div>
                         </div>
                         
                         {isSubmitting && uploadProgress > 0 && (
                            <div className="space-y-2">
                               <div className="flex justify-between items-center text-xs font-bold">
                                  <span className="text-emerald-600">Uploading...</span>
                                  <span className="text-slate-500">{Math.round(uploadProgress)}%</span>
                               </div>
                               <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-emerald-500 transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                  />
                               </div>
                            </div>
                         )}
                      </div>
                   )}

                   {modalOpen.type === 'note' && (
                      <div className="space-y-6">
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Note Title</label>
                            <input 
                              type="text" 
                              value={formData.title} 
                              onChange={(e) => setFormData({...formData, title: e.target.value})} 
                              placeholder="Encryption Keys" 
                              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" 
                              required
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Content</label>
                            <textarea 
                              value={formData.content} 
                              onChange={(e) => setFormData({...formData, content: e.target.value})} 
                              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all h-32 resize-none" 
                              placeholder="Type your sensitive data here..." 
                            />
                         </div>
                      </div>
                   )}

                   {modalOpen.type === 'member' && (
                      <div className="space-y-6">
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                            <input 
                              type="text" 
                              value={formData.name} 
                              onChange={(e) => setFormData({...formData, name: e.target.value})} 
                              placeholder="Sarah Jenkins" 
                              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" 
                              required
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Workspace Role</label>
                            <select 
                              value={formData.role} 
                              onChange={(e) => setFormData({...formData, role: e.target.value})} 
                              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all bg-white"
                            >
                               <option value="Viewer">Viewer</option>
                               <option value="Editor">Editor</option>
                               <option value="Admin">Admin</option>
                            </select>
                         </div>
                      </div>
                   )}

                   <div className="pt-4 flex gap-4">
                      <button 
                        type="button"
                        onClick={() => setModalOpen({ type: null })} 
                        className="flex-1 py-4 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={isSubmitting || (modalOpen.type === 'file' && !selectedFile)} 
                        className="flex-1 py-4 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10"
                      >
                         {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : 'Create Securely'}
                      </button>
                   </div>
                </form>
             </div>
         </div>
      )}

      <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} />
    </div>
  );
};

export default Dashboard;
