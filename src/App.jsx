import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, Circle, Trash2, Plus, Clock, Settings, RefreshCw, 
  AlertCircle, Sparkles, Server, Check, X, Search, Edit2, 
  ArrowUpDown, LogOut, User as UserIcon, Lock, Mail, ArrowRight, CheckSquare
} from 'lucide-react';

const getInitialApiUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  return 'http://localhost:5000';
};

export default function App() {
  // Auth State
  const [token, setToken] = useState(localStorage.getItem('taskflow_token') || null);
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('taskflow_user') || null);
  const [isAuthMode, setIsAuthMode] = useState('login'); // 'login' | 'register'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Todo State
  const [todos, setTodos] = useState([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [filter, setFilter] = useState('all'); 
  const [sortBy, setSortBy] = useState('newest'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  // Settings & Network State
  const [apiUrl, setApiUrl] = useState(getInitialApiUrl);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingApiUrl, setPendingApiUrl] = useState(getInitialApiUrl);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  });

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    const endpoint = isAuthMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setToken(data.token);
      setCurrentUser(data.email);
      localStorage.setItem('taskflow_token', data.token);
      localStorage.setItem('taskflow_user', data.email);
      setAuthPassword('');
      setAuthEmail('');
      setIsConnected(true);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setTodos([]);
    localStorage.removeItem('taskflow_token');
    localStorage.removeItem('taskflow_user');
  };

  const fetchTodos = async (targetUrl = apiUrl) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${targetUrl.replace(/\/$/, '')}/api/todos`, {
        method: 'GET',
        headers: getHeaders(),
      });

      if (response.status === 401) {
        handleLogout();
        throw new Error('Session expired');
      }

      if (!response.ok) throw new Error('Failed to fetch data');

      const data = await response.json();
      setTodos(data);
      setIsConnected(true);
    } catch (err) {
      console.warn('Backend issue:', err.message);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchTodos(apiUrl);
  }, [apiUrl, token]);

  const handleAddTodo = async (e) => {
    e.preventDefault();
    const trimmed = newTodoText.trim();
    if (!trimmed) return;

    const tempId = `local-${Date.now()}`;
    const newTodo = { _id: tempId, text: trimmed, completed: false, createdAt: new Date().toISOString() };
    setTodos((prev) => [newTodo, ...prev]);
    setNewTodoText('');

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ text: trimmed }),
      });

      if (response.status === 401) return handleLogout();
      if (!response.ok) throw new Error('Failed to create on server');
      
      const savedTodo = await response.json();
      setTodos((prev) => prev.map((t) => (t._id === tempId ? savedTodo : t)));
    } catch (err) {
      console.error('Error saving todo:', err);
      setTodos((prev) => prev.filter((t) => t._id !== tempId));
    }
  };

  const handleToggleTodo = async (todo) => {
    const updatedStatus = !todo.completed;
    setTodos((prev) => prev.map((t) => (t._id === todo._id ? { ...t, completed: updatedStatus } : t)));

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos/${todo._id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ completed: updatedStatus }),
      });
      if (response.status === 401) handleLogout();
    } catch (err) {
      setTodos((prev) => prev.map((t) => (t._id === todo._id ? { ...t, completed: todo.completed } : t)));
    }
  };

  const handleStartEdit = (todo) => {
    setEditingId(todo._id);
    setEditingText(todo.text);
  };

  const handleSaveEdit = async (id) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;

    const previousTodos = [...todos];
    setTodos((prev) => prev.map((t) => t._id === id ? { ...t, text: trimmed, updatedAt: new Date().toISOString() } : t));
    setEditingId(null);

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ text: trimmed }),
      });
      if (response.status === 401) handleLogout();
      if (!response.ok) throw new Error('Update failed');
    } catch (err) {
      setTodos(previousTodos);
    }
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    const targetId = deleteCandidate._id;
    setTodos((prev) => prev.filter((t) => t._id !== targetId));
    setDeleteCandidate(null);

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos/${targetId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (response.status === 401) handleLogout();
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const formatDateTime = (isoDate) => {
    if (!isoDate) return '';
    try {
      return new Date(isoDate).toLocaleString('th-TH', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  };

  const filteredTodos = useMemo(() => {
    const result = todos.filter((todo) => {
      const matchesFilter = filter === 'all' ? true : filter === 'active' ? !todo.completed : todo.completed;
      const matchesSearch = todo.text.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      if (sortBy === 'az') return a.text.localeCompare(b.text, undefined, { sensitivity: 'base' });
      if (sortBy === 'za') return b.text.localeCompare(a.text, undefined, { sensitivity: 'base' });
      if (sortBy === 'status') return Number(a.completed) - Number(b.completed);
      return 0;
    });
  }, [todos, filter, searchQuery, sortBy]);

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-900 to-indigo-950 flex flex-col items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
        <button
          onClick={() => setIsSettingsOpen(true)}
          title="API Configuration"
          className="absolute top-6 right-6 p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition backdrop-blur-md shadow-lg"
        >
          <Settings className="w-5 h-5" />
        </button>

        <div className="w-full max-w-md bg-slate-900/60 border border-white/10 p-8 rounded-3xl shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl shadow-xl shadow-indigo-500/30">
              <CheckSquare className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-center text-white tracking-tight mb-2">
            TaskFlow
          </h1>
          <p className="text-center text-slate-400 text-sm mb-8">
            {isAuthMode === 'login' ? 'ยินดีต้อนรับกลับมา! กรุณาเข้าสู่ระบบ' : 'สร้างบัญชีใหม่เพื่อเริ่มต้นใช้งาน'}
          </p>

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="อีเมลของคุณ"
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
              />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
              />
            </div>
            <button
              type="submit"
              disabled={isAuthLoading}
              className="mt-2 w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl py-3.5 text-sm font-semibold transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isAuthLoading ? 'กำลังดำเนินการ...' : (isAuthMode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก')}
              {!isAuthLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-8 text-center text-sm border-t border-white/5 pt-6">
            <span className="text-slate-400">
              {isAuthMode === 'login' ? "ยังไม่มีบัญชีใช่ไหม? " : "มีบัญชีอยู่แล้ว? "}
            </span>
            <button
              onClick={() => setIsAuthMode(isAuthMode === 'login' ? 'register' : 'login')}
              className="text-indigo-400 hover:text-indigo-300 font-semibold transition ml-1"
            >
              {isAuthMode === 'login' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </div>

        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
              <button onClick={() => setIsSettingsOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-white/5">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                <Server className="w-5 h-5 text-indigo-400" /> ตั้งค่า API URL
              </h2>
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-xs font-medium text-slate-300">Backend Server URL</label>
                <input
                  type="text"
                  value={pendingApiUrl}
                  onChange={(e) => setPendingApiUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono shadow-inner"
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:bg-white/5 transition">ยกเลิก</button>
                <button onClick={() => { setApiUrl(pendingApiUrl); setIsSettingsOpen(false); }} className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition">บันทึก</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-10 px-4 sm:px-6 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl shadow-xl shadow-indigo-500/25">
                <CheckSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white">TaskFlow</h1>
                <p className="text-xs text-indigo-400 font-medium">ระบบจัดการงานปลอดภัยด้วย JWT</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => fetchTodos(apiUrl)} title="รีเฟรชข้อมูล" className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition">
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
              <button onClick={() => setIsSettingsOpen(true)} title="ตั้งค่า" className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs px-4 py-3 rounded-2xl border bg-white/[0.02] backdrop-blur-md border-white/10">
            <div className="flex items-center gap-2.5 text-slate-300">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>เข้าสู่ระบบในนาม <strong className="text-white font-semibold">{currentUser}</strong></span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 font-medium transition bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/20">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </header>

        <form onSubmit={handleAddTodo} className="relative">
          <div className="flex items-center gap-2 p-2 bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="เพิ่มงานใหม่ของคุณวันนี้..."
              className="flex-1 bg-transparent px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none"
            />
            <button type="submit" disabled={!newTodoText.trim()} className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-40 cursor-pointer active:scale-95">
              <Plus className="w-4 h-4" /> <span>เพิ่มงาน</span>
            </button>
          </div>
        </form>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center bg-white/[0.03] border border-white/10 p-1 rounded-2xl text-xs">
            {['all', 'active', 'completed'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl transition font-semibold capitalize ${filter === f ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {f === 'all' ? 'ทั้งหมด' : f === 'active' ? 'ยังไม่เสร็จ' : 'เสร็จแล้ว'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 flex-1 sm:justify-end">
            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-2xl px-3 py-2 text-xs text-slate-300">
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent text-slate-200 focus:outline-none cursor-pointer">
                <option value="newest" className="bg-slate-900">ล่าสุดก่อน</option>
                <option value="oldest" className="bg-slate-900">เก่าสุดก่อน</option>
                <option value="az" className="bg-slate-900">ก &rarr; ฮ</option>
                <option value="za" className="bg-slate-900">ฮ &rarr; ก</option>
                <option value="status" className="bg-slate-900">งานค้างมาก่อน</option>
              </select>
            </div>
            <div className="relative flex-1 max-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ค้นหางาน..." className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {filteredTodos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-white/10 rounded-3xl bg-white/[0.01] text-center">
              <div className="p-4 bg-white/5 rounded-2xl mb-3 text-slate-500">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-semibold text-slate-300">ไม่พบรายการงาน</h3>
              <p className="text-xs text-slate-500 mt-1">เริ่มต้นสร้างรายการงานใหม่ของคุณได้เลยด้านบน</p>
            </div>
          ) : (
            filteredTodos.map((todo) => {
              const formattedDate = formatDateTime(todo.createdAt || todo.timestamp);
              const isEditing = editingId === todo._id;

              return (
                <div key={todo._id} className={`group flex items-start gap-3.5 p-4 rounded-2xl border transition-all ${todo.completed ? 'bg-white/[0.01] border-white/5 opacity-75' : 'bg-slate-900/60 border-white/10 hover:border-white/20 shadow-xl'}`}>
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <button onClick={() => handleToggleTodo(todo)} disabled={isEditing} className="mt-0.5 text-slate-500 hover:text-indigo-400 transition cursor-pointer">
                      {todo.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5" />}
                    </button>
                    <div className="flex flex-col gap-1.5 flex-1">
                      {isEditing ? (
                        <div className="flex flex-col gap-1.5">
                          <input
                            type="text" autoFocus value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(todo._id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="bg-slate-950 border border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none shadow-inner"
                          />
                        </div>
                      ) : (
                        <p onDoubleClick={() => !todo.completed && handleStartEdit(todo)} className={`text-sm break-words leading-relaxed ${todo.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          {todo.text}
                        </p>
                      )}
                      {formattedDate && !isEditing && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                          <Clock className="w-3 h-3 text-slate-600" /> {formattedDate} {todo.updatedAt && '(แก้ไขแล้ว)'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <button onClick={() => handleSaveEdit(todo._id)} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition cursor-pointer"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-2 text-slate-400 hover:bg-white/5 rounded-xl transition cursor-pointer"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleStartEdit(todo)} className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition opacity-80 sm:opacity-0 group-hover:opacity-100 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteCandidate(todo)} className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition opacity-80 sm:opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-white/5"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5"><Server className="w-5 h-5 text-indigo-400" /> ตั้งค่า API</h2>
            <div className="mt-4"><input type="text" value={pendingApiUrl} onChange={(e) => setPendingApiUrl(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 font-mono shadow-inner" /></div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:bg-white/5 transition">ยกเลิก</button>
              <button onClick={() => { setApiUrl(pendingApiUrl); setIsSettingsOpen(false); }} className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-bold text-white text-base mb-2">ยืนยันการลบงาน</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">ต้องการลบงาน "{deleteCandidate.text}" ใช่หรือไม่?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteCandidate(null)} className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:bg-white/5 transition">ยกเลิก</button>
              <button onClick={confirmDelete} className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition">ลบงาน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
