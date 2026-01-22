
import React, { useState, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  LogOut, Shield, HardDrive, 
  Upload, Trash2, Loader2, FolderPlus, FileText, 
  Users, StickyNote, Folder, X,
  ChevronRight, ChevronUp, ChevronDown, DownloadCloud, Image as ImageIcon,
  AlertTriangle, ArrowLeft, Search, Home, Eye, History, Sparkles, File as FileIcon
} from 'lucide-react';
import SettingsModal from '../components/SettingsModal';
import UpgradeModal from '../components/UpgradeModal';
import FilePreviewModal from '../components/FilePreviewModal';

// --- Types ---
interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  mimeType: string;
  folderId: string | null;
  downloadURL: string;
  createdAt: { seconds: number };
}

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: { seconds: number };
}

type TabView = 'overview' | 'files' | 'notes' | 'team';
type SortKey = 'name' | 'size' | 'createdAt';
type SortDirection = 'asc' | 'desc';

interface DashboardProps {
  onNavigate: (path: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user, signOut } = useAuth();
  
  // Local Mock Data State (No Firestore/Storage)
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [currentFolder, setCurrentFolder] = useState<FolderItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // UI State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState<{ type: 'folder' | 'file' | null }>({ type: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleSignOut = async () => {
    await signOut();
    onNavigate('/');
  };

  const getInitials = (name?: string | null) => {
    const n = name || user?.email || 'U';
    return n.substring(0, 2).toUpperCase();
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 800)); // Simulate delay
    
    const id = Date.now().toString();
    const timestamp = { seconds: Math.floor(Date.now() / 1000) };

    if (modalOpen.type === 'folder') {
      const newFolder: FolderItem = {
        id,
        name: newItemName || 'Untitled Folder',
        parentId: currentFolder?.id || null,
        createdAt: timestamp
      };
      setFolders([newFolder, ...folders]);
    } else if (modalOpen.type === 'file' && selectedFile) {
      const newFile: FileItem = {
        id,
        name: newItemName || selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type.startsWith('image/') ? 'image' : 'doc',
        mimeType: selectedFile.type,
        folderId: currentFolder?.id || null,
        downloadURL: '#',
        createdAt: timestamp
      };
      setFiles([newFile, ...files]);
    }

    setModalOpen({ type: null });
    setIsSubmitting(false);
    setNewItemName('');
  };

  const renderFiles = () => {
    const displayFiles = files.filter(f => currentFolder ? f.folderId === currentFolder.id : !f.folderId);
    const displayFolders = folders.filter(f => currentFolder ? f.parentId === currentFolder.id : !f.parentId);

    return (
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden min-h-[400px]">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase">
          <div className="col-span-6">Name</div>
          <div className="col-span-4">Date</div>
          <div className="col-span-2 text-right">Size</div>
        </div>
        
        {displayFolders.length === 0 && displayFiles.length === 0 && (
          <div className="py-20 text-center">
            <FolderPlus className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500">No files or folders yet.</p>
          </div>
        )}

        {displayFolders.map(folder => (
          <div key={folder.id} onClick={() => setCurrentFolder(folder)} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer items-center">
            <div className="col-span-6 flex items-center gap-3">
              <Folder size={18} className="text-blue-500" />
              <span className="text-sm font-medium">{folder.name}</span>
            </div>
            <div className="col-span-4 text-xs text-slate-400">Folder</div>
            <div className="col-span-2 text-right text-xs text-slate-400">-</div>
          </div>
        ))}

        {displayFiles.map(file => (
          <div key={file.id} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-50 hover:bg-slate-50 items-center">
            <div className="col-span-6 flex items-center gap-3">
              {file.type === 'image' ? <ImageIcon size={18} className="text-purple-500" /> : <FileText size={18} className="text-emerald-500" />}
              <span className="text-sm font-medium">{file.name}</span>
            </div>
            <div className="col-span-4 text-xs text-slate-400">{new Date(file.createdAt.seconds * 1000).toLocaleDateString()}</div>
            <div className="col-span-2 text-right text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 pt-28 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
         <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">My Vault</h1>
            <p className="text-slate-500">Welcome to your secure workspace.</p>
         </div>
         <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full">
                <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold text-[10px]">{getInitials(user?.displayName)}</div>
                <span className="text-sm font-medium text-slate-700">{user?.email}</span>
             </div>
             <button onClick={handleSignOut} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><LogOut size={20} /></button>
         </div>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setModalOpen({ type: 'folder' })} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50">New Folder</button>
        <button onClick={() => setModalOpen({ type: 'file' })} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-500">Add File</button>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => {setCurrentFolder(null); setActiveTab('overview');}} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${activeTab === 'overview' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Overview</button>
        <button onClick={() => setActiveTab('files')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${activeTab === 'files' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Files</button>
      </div>

      {activeTab === 'files' ? renderFiles() : (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100">
            <Shield size={24} className="text-emerald-600 mb-4" />
            <h3 className="font-bold text-slate-900">Encrypted</h3>
            <p className="text-sm text-slate-500 mt-1">Local data protection active.</p>
          </div>
          <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
            <Users size={24} className="text-blue-600 mb-4" />
            <h3 className="font-bold text-slate-900">Collaboration</h3>
            <p className="text-sm text-slate-500 mt-1">Ready for team invites.</p>
          </div>
          <div className="bg-purple-50/50 p-6 rounded-2xl border border-purple-100">
            <HardDrive size={24} className="text-purple-600 mb-4" />
            <h3 className="font-bold text-slate-900">Cloud Storage</h3>
            <p className="text-sm text-slate-500 mt-1">Firestore sync pending setup.</p>
          </div>
        </div>
      )}

      {modalOpen.type && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/40" onClick={() => setModalOpen({ type: null })} />
             <div className="relative w-full max-w-md bg-white rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4 capitalize">New {modalOpen.type}</h3>
                <input 
                  type={modalOpen.type === 'file' ? 'file' : 'text'}
                  onChange={modalOpen.type === 'file' ? (e) => setSelectedFile(e.target.files?.[0] || null) : (e) => setNewItemName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl mb-4"
                  placeholder="Enter name..."
                />
                <div className="flex gap-3">
                   <button onClick={() => setModalOpen({ type: null })} className="flex-1 py-2 border rounded-xl">Cancel</button>
                   <button onClick={handleCreate} disabled={isSubmitting} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl">
                     {isSubmitting ? 'Processing...' : 'Create'}
                   </button>
                </div>
             </div>
         </div>
      )}

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} />
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
};

export default Dashboard;
