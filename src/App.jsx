import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, Circle, Trash2, Plus, Clock, Settings, RefreshCw, 
  AlertCircle, Sparkles, Server, Check, X, Search, Edit2, 
  ArrowUpDown, LogOut, User as UserIcon, Lock, Mail, ArrowRight, CheckSquare, Layers, ShieldCheck
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

  const completedCount = todos.filter(t => t.completed).length;
  const progressPercentage = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  if (!token) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        <button
          onClick={() => setIsSettingsOpen(true)}
          title="ตั้งค่า API"
          className="absolute top-6 right-6 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all shadow-xl backdrop-blur-xl"
        >
          <Settings className="w-5 h-5" />
        </button>

        <div className="w-full max-w-md bg-slate-900/50 border border-slate-800/80 p-8 rounded-[2rem] shadow-2xl backdrop-blur-2xl relative">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/25 mb-4 ring-1 ring-white/20">
              <CheckSquare className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">TaskFlow Workspace</h1>
            <p className="text-sm text-slate-400 mt-1">
              {isAuthMode === 'login' ? 'ลงชื่อเข้าใช้เพื่อจัดการงานของคุณ' : 'สร้างบัญชีผู้ใช้ใหม่'}
            </p>
          </div>

          <div className="flex bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800 mb-6">
            <button
              onClick={() => setIsAuthMode('login')}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all ${isAuthMode === 'login' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              onClick={() => setIsAuthMode('register')}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all ${isAuthMode === 'register' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              สมัครสมาชิก
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3.5 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 ml-1">อีเมล</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 ml-1">รหัสผ่าน</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthLoading}
              className="w-full mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              {isAuthLoading ? 'กำลังตรวจสอบ...' : (isAuthMode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก')}
              {!isAuthLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>

        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
              <button onClick={() => setIsSettingsOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800/50">
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-base font-bold text-white flex items-center gap-2.5 mb-4">
                <Server className="w-4 h-4 text-cyan-400" /> ตั้งค่า Server URL
              </h2>
              <input
                type="text"
                value={pendingApiUrl}
                onChange={(e) => setPendingApiUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition">ยกเลิก</button>
                <button onClick={() => { setApiUrl(pendingApiUrl); setIsSettingsOpen(false); }} className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20">บันทึก</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col items-center py-8 px-4 sm:px-6 font-sans selection:bg-cyan-500 selection:text-slate-950">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        
        {/* Top Header Card */}
        <header className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
              <CheckSquare className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white">TaskFlow</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">PRO</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                เข้าสู่ระบบโดย: <span className="text-slate-200 font-medium">{currentUser}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button 
              onClick={() => fetchTodos(apiUrl)} 
              title="รีเฟรชข้อมูล" 
              className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)} 
              title="ตั้งค่าระบบ" 
              className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={handleLogout} 
              title="ออกจากระบบ" 
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span>ออก</span>
            </button>
          </div>
        </header>

        {/* Progress Overview Bar */}
        {todos.length > 0 && (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-lg flex flex-col gap-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">ความคืบหน้าภาพรวม</span>
              <span className="text-cyan-400 font-bold">{completedCount} / {todos.length} งาน ({progressPercentage}%)</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Add Todo Form */}
        <form onSubmit={handleAddTodo} className="relative">
          <div className="flex items-center gap-2 p-2 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="พิมพ์งานที่ต้องการทำวันนี้..."
              className="flex-1 bg-transparent px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none"
            />
            <button 
              type="submit" 
              disabled={!newTodoText.trim()} 
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-40 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" /> 
              <span>เพิ่มงาน</span>
            </button>
          </div>
        </form>

        {/* Filter and Control Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center bg-slate-900/60 border border-slate-800 p-1 rounded-2xl text-xs backdrop-blur-md">
            {[
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'active', label: 'ค้างอยู่' },
              { id: 'completed', label: 'เสร็จแล้ว' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl transition-all font-semibold ${filter === tab.id ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 sm:justify-end">
            <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-2xl px-3.5 py-2 text-xs text-slate-300">
              <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
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
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="ค้นหางาน..." 
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition-all" 
              />
            </div>
          </div>
        </div>

        {/* Todo List Cards */}
        <div className="flex flex-col gap-3">
          {filteredTodos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-slate-800 rounded-3xl bg-slate-900/20 text-center">
              <div className="p-4 bg-slate-800/50 rounded-2xl mb-3 text-slate-500">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-semibold text-slate-300">ไม่พบรายการงาน</h3>
              <p className="text-xs text-slate-500 mt-1">เริ่มต้นเพิ่มงานชิ้นแรกของคุณได้เลยข้างบนนี้</p>
            </div>
          ) : (
            filteredTodos.map((todo) => {
              const formattedDate = formatDateTime(todo.createdAt || todo.timestamp);
              const isEditing = editingId === todo._id;

              return (
                <div 
                  key={todo._id} 
                  className={`group flex items-start gap-3.5 p-4 rounded-2xl border transition-all backdrop-blur-xl ${
                    todo.completed 
                      ? 'bg-slate-900/20 border-slate-800/40 opacity-60' 
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 shadow-xl'
                  }`}
                >
                  <button 
                    onClick={() => handleToggleTodo(todo)} 
                    disabled={isEditing} 
                    className="mt-0.5 text-slate-500 hover:text-cyan-400 transition cursor-pointer shrink-0"
                  >
                    {todo.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5" />}
                  </button>

                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        type="text" 
                        autoFocus 
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(todo._id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="bg-slate-950 border border-cyan-500 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none shadow-inner"
                      />
                    ) : (
                      <p 
                        onDoubleClick={() => !todo.completed && handleStartEdit(todo)} 
                        className={`text-sm break-words leading-relaxed select-none ${todo.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}
                      >
                        {todo.text}
                      </p>
                    )}

                    {formattedDate && !isEditing && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                        <Clock className="w-3 h-3 text-slate-600" /> 
                        <span>{formattedDate}</span> 
                        {todo.updatedAt && <span className="text-[10px] text-cyan-500/80">(แก้ไขแล้ว)</span>}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isEditing ? (
                      <>
                        <button onClick={() => handleSaveEdit(todo._id)} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition cursor-pointer"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-xl transition cursor-pointer"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleStartEdit(todo)} className="p-2 text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-xl transition opacity-80 sm:opacity-0 group-hover:opacity-100 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
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

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800/50"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white flex items-center gap-2.5 mb-4">
              <Server className="w-4 h-4 text-cyan-400" /> ตั้งค่า API URL
            </h2>
            <input 
              type="text" 
              value={pendingApiUrl} 
              onChange={(e) => setPendingApiUrl(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500" 
            />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition">ยกเลิก</button>
              <button onClick={() => { setApiUrl(pendingApiUrl); setIsSettingsOpen(false); }} className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-bold text-white text-base mb-2">ยืนยันการลบงาน</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">ต้องการลบงาน "{deleteCandidate.text}" นี้ใช่หรือไม่?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteCandidate(null)} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition">ยกเลิก</button>
              <button onClick={confirmDelete} className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 transition shadow-lg shadow-rose-600/20">ลบงาน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
