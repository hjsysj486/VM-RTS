import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Building2, ClipboardList, LayoutDashboard, 
  Settings, Plus, Search, FileText, Bell, CheckCircle, 
  Clock, XCircle, ChevronDown, Upload, Download, LogOut
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, 
  addDoc, updateDoc 
} from 'firebase/firestore';

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyBFp-TBWuGeqG2vpSx9THydZPksKydIsq4",
  authDomain: "vm-rts.firebaseapp.com",
  projectId: "vm-rts",
  storageBucket: "vm-rts.firebasestorage.app",
  messagingSenderId: "464809141333",
  appId: "1:464809141333:web:4de6b96427c4336f0c20dc"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 캔버스 환경에서 부여되는 ID에 포함된 '/' 슬래시를 '-'로 치환하여 Firestore 경로 에러(홀수 세그먼트) 방지
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'vm-rts-default';
const safeAppId = rawAppId.replace(/\//g, '-'); 

const getColRef = (colName) => collection(db, 'artifacts', safeAppId, 'public', 'data', colName);
const getDocRef = (colName, id) => doc(db, 'artifacts', safeAppId, 'public', 'data', colName, id);

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [candidates, setCandidates] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [selfRecruiting, setSelfRecruiting] = useState([]);
  
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Custom Toast Message State (알림창 대체용)
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        const userUnsub = onSnapshot(getDocRef('users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            setAppUser({ id: docSnap.id, ...docSnap.data() });
          } else {
            setAppUser(null);
          }
          setIsAuthLoading(false);
        }, (err) => {
          console.error(err);
          setIsAuthLoading(false);
        });
        return () => userUnsub();
      } else {
        setAppUser(null);
        setIsAuthLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!authUser || !appUser || appUser.status !== 'approved') return;

    const unsubs = [];
    unsubs.push(onSnapshot(getColRef('candidates'), (snap) => {
      setCandidates(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.updatedAt - a.updatedAt));
    }, console.error));

    unsubs.push(onSnapshot(getColRef('organizations'), (snap) => {
      setOrganizations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, console.error));

    unsubs.push(onSnapshot(getColRef('events'), (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, console.error));

    unsubs.push(onSnapshot(getColRef('users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, console.error));

    unsubs.push(onSnapshot(getColRef('selfRecruiting'), (snap) => {
      setSelfRecruiting(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, console.error));

    return () => unsubs.forEach(unsub => unsub());
  }, [authUser, appUser]);

  const handleLogin = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      if (e.code === 'auth/admin-restricted-operation' || e.code === 'auth/unauthorized-domain') {
        showToast('파이어베이스 [승인된 도메인]에 현재 웹사이트 주소가 등록되지 않았습니다.');
      } else {
        showToast("로그인 실패: 이메일과 비밀번호를 다시 확인해주세요.");
      }
    }
  };

  const handleSignUp = async (formData) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      
      const isAdmin = users.length === 0; 
      await setDoc(getDocRef('users', user.uid), {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        role: isAdmin ? 'admin' : 'user',
        status: isAdmin ? 'approved' : 'pending',
        createdAt: Date.now()
      });
      showToast(isAdmin ? "관리자로 등록 및 로그인되었습니다." : "신청이 완료되었습니다. 관리자 승인을 기다려주세요.");
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        showToast("이미 가입된 이메일입니다. 하단의 '로그인하기'를 눌러주세요.");
      } else {
        console.error(e);
        showToast("오류가 발생했습니다.");
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const navigate = (view) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  const ToastComponent = () => toastMsg ? (
    <div className="fixed top-4 right-4 bg-slate-800 text-white px-6 py-3 rounded-lg shadow-xl z-50 animate-bounce">
      {toastMsg}
    </div>
  ) : null;

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!authUser) {
    return <><ToastComponent /><AuthScreen onLogin={handleLogin} onSignUp={handleSignUp} /></>;
  }

  if (authUser && !appUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <ToastComponent />
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">계정 정보 없음</h2>
          <p className="text-gray-600 mb-6">데이터베이스에서 사용자 정보를 찾을 수 없습니다.<br/>(데이터가 삭제되었거나 가입 중 오류가 발생했습니다)</p>
          <button onClick={handleLogout} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors">
            로그아웃 및 초기화
          </button>
        </div>
      </div>
    );
  }

  if (authUser && appUser && appUser.status === 'pending') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <ToastComponent />
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <Clock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">승인 대기 중</h2>
          <p className="text-gray-600 mb-6">관리자의 가입 승인이 필요합니다.<br/>승인 후 시스템을 이용하실 수 있습니다.</p>
          <div className="space-y-3">
            <button onClick={() => updateDoc(getDocRef('users', authUser.uid), { status: 'approved', role: 'admin' })} className="text-xs text-blue-600 underline block mx-auto">개발자 도구: 즉시 관리자 승인</button>
            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-800 underline block mx-auto">로그아웃</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-800 relative">
      <ToastComponent />
      
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-wider text-blue-400">VM-RTS <span className="text-xs text-gray-400">v1.2.0</span></h1>
          <button className="md:hidden text-gray-300 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}><XCircle /></button>
        </div>
        <nav className="p-4 space-y-2">
          <NavItem icon={<LayoutDashboard />} label="대시보드" active={currentView === 'dashboard'} onClick={() => navigate('dashboard')} />
          <NavItem icon={<Users />} label="외부 리크루팅 후보자" active={currentView === 'candidates'} onClick={() => navigate('candidates')} />
          <NavItem icon={<Building2 />} label="사업단 자체 리크루팅" active={currentView === 'self-recruiting'} onClick={() => navigate('self-recruiting')} />
          <NavItem icon={<FileText />} label="보고서" active={currentView === 'reports'} onClick={() => navigate('reports')} />
          
          {appUser?.role === 'admin' && (
            <>
              <div className="pt-4 mt-4 border-t border-slate-700 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">관리자 메뉴</div>
              <NavItem icon={<Settings />} label="시스템/조직 관리" active={currentView === 'admin'} onClick={() => navigate('admin')} />
            </>
          )}
        </nav>
        <div className="absolute bottom-0 w-full p-4 border-t border-slate-700 bg-slate-900">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">{appUser?.name?.[0]}</div>
              <div className="text-sm overflow-hidden">
                <p className="font-medium truncate">{appUser?.name}</p>
                <p className="text-slate-400 text-xs truncate">{appUser?.role === 'admin' ? '관리자' : '사용자'}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-white" title="로그아웃"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-600"><ChevronDown className="rotate-[-90deg]"/></button>
          <span className="font-bold">VM-RTS</span>
          <div className="w-6"></div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 md:p-6">
          {currentView === 'dashboard' && <Dashboard candidates={candidates} selfRecruiting={selfRecruiting} orgs={organizations} />}
          {currentView === 'candidates' && <CandidateManager candidates={candidates} appUser={appUser} events={events} orgs={organizations} showToast={showToast} />}
          {currentView === 'admin' && appUser?.role === 'admin' && <AdminPanel users={users} orgs={organizations} events={events} showToast={showToast} />}
          {currentView === 'self-recruiting' && <SelfRecruitingManager data={selfRecruiting} orgs={organizations} showToast={showToast} />}
          {currentView === 'reports' && <Reports candidates={candidates} selfRecruiting={selfRecruiting} orgs={organizations} events={events} />}
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {React.cloneElement(icon, { size: 20 })}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function AuthScreen({ onLogin, onSignUp }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', name: '', phone: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLoginMode) {
      onLogin(formData.email, formData.password);
    } else {
      onSignUp(formData);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-blue-900 mb-2">VM-RTS</h1>
          <p className="text-gray-500 text-sm">밸류마크 리크루팅 트레킹 시스템</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLoginMode && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input required type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
                <input required type="tel" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="010-0000-0000" onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input required type="email" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="name@valuemark.co.kr" onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input required type="password" minLength="6" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="6자리 이상 입력" onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors mt-6">
            {isLoginMode ? '로그인' : '사용 신청하기'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button type="button" onClick={() => setIsLoginMode(!isLoginMode)} className="text-sm text-gray-500 hover:text-blue-600 font-medium">
            {isLoginMode ? '계정이 없으신가요? 사용 신청하기' : '이미 계정이 있으신가요? 로그인하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ candidates, selfRecruiting, orgs }) {
  const stats = useMemo(() => {
    let meeting = 0, processing = 0, completed = 0, dropped = 0;
    let indMoves = 0, orgMoves = 0;
    
    candidates.forEach(c => {
      if (c.status === '미팅') meeting++;
      else if (c.status === '위촉진행') processing++;
      else if (c.status === '위촉완료') completed++;
      else if (c.status === '드랍/거절') dropped++;

      if (c.type === 'individual') indMoves++;
      else if (c.type === 'org') orgMoves++;
    });
    return { meeting, processing, completed, dropped, indMoves, orgMoves };
  }, [candidates]);

  const recentUpdates = candidates.slice(0, 5);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">대시보드</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="총 미팅진행" value={stats.meeting} icon={<Clock className="text-blue-500" />} color="bg-blue-50" />
        <StatCard title="위촉 진행중" value={stats.processing} icon={<ClipboardList className="text-yellow-500" />} color="bg-yellow-50" />
        <StatCard title="위촉 완료" value={stats.completed} icon={<CheckCircle className="text-green-500" />} color="bg-green-50" />
        <StatCard title="드랍/거절" value={stats.dropped} icon={<XCircle className="text-red-500" />} color="bg-red-50" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="개인 이동 건수" value={stats.indMoves} icon={<Users className="text-indigo-500" />} color="bg-indigo-50" />
        <StatCard title="조직 이동 건수" value={stats.orgMoves} icon={<Building2 className="text-purple-500" />} color="bg-purple-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-bold mb-4 flex items-center"><Bell className="mr-2 w-5 h-5 text-gray-500"/> 최근 업데이트된 후보자</h3>
          <div className="space-y-4">
            {recentUpdates.length === 0 ? <p className="text-gray-500 text-sm">최근 업데이트 내역이 없습니다.</p> : 
              recentUpdates.map(c => (
                <div key={c.id} className="flex justify-between items-center border-b pb-3 last:border-0">
                  <div>
                    <p className="font-medium">{c.name} <span className="text-xs text-gray-500 ml-1">({c.type === 'org' ? '조직' : '개인'})</span></p>
                    <p className="text-xs text-gray-500 line-clamp-1">{c.history?.[0]?.memo || '기록 없음'}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))
            }
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-bold mb-4">사업단별 배정 현황</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600">
                <tr><th className="p-2">사업부</th><th className="p-2">사업단</th><th className="p-2 text-right">배정 후보자 수</th></tr>
              </thead>
              <tbody>
                {Array.from(new Set(candidates.filter(c=>c.agency).map(c=>c.agency))).slice(0,5).map((agency, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2 text-gray-500">배정됨</td>
                    <td className="p-2 font-medium">{agency}</td>
                    <td className="p-2 text-right">{candidates.filter(c=>c.agency === agency).length}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    '미팅': 'bg-blue-100 text-blue-800',
    '위촉진행': 'bg-yellow-100 text-yellow-800',
    '위촉완료': 'bg-green-100 text-green-800',
    '드랍/거절': 'bg-red-100 text-red-800'
  };
  return <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>{status}</span>;
}

function CandidateManager({ candidates, appUser, events, orgs, showToast }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = candidates.filter(c => c.name.includes(searchTerm) || c.currentCo?.includes(searchTerm));

  const openNew = () => { setEditingDoc(null); setIsModalOpen(true); };
  const openEdit = (doc) => { setEditingDoc(doc); setIsModalOpen(true); };

  const handleSave = async (data) => {
    try {
      const payload = {
        ...data,
        updatedAt: Date.now(),
        updatedBy: appUser.name
      };
      
      if (editingDoc) {
        await updateDoc(getDocRef('candidates', editingDoc.id), payload);
      } else {
        await addDoc(getColRef('candidates'), {
          ...payload,
          createdAt: Date.now(),
          createdBy: appUser.name,
          history: []
        });
      }
      setIsModalOpen(false);
      showToast("정상적으로 저장되었습니다.");
    } catch (e) {
      console.error(e);
      showToast("저장에 실패했습니다.");
    }
  };

  const handleAddHistory = async (id, historyItem) => {
    try {
      const docRef = getDocRef('candidates', id);
      const cand = candidates.find(c => c.id === id);
      const newHistory = [{...historyItem, date: Date.now(), writer: appUser.name}, ...(cand.history || [])];
      await updateDoc(docRef, { history: newHistory, updatedAt: Date.now() });
      showToast("기록이 추가되었습니다.");
    } catch (e) {
      console.error(e);
      showToast("기록 추가에 실패했습니다.");
    }
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').filter(l => l.trim() !== '');
      showToast(`총 ${lines.length - 1}명의 후보자 데이터 업로드가 테스트 처리되었습니다.`);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">외부 리크루팅 후보자 관리</h2>
        <div className="flex space-x-2">
          <label className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 cursor-pointer text-sm">
            <Upload className="w-4 h-4 mr-1"/> 대량 등록 (CSV) <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
          </label>
          <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 text-sm">
            <Plus className="w-4 h-4 mr-1" /> 신규 등록
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center">
        <Search className="text-gray-400 w-5 h-5 mr-2" />
        <input type="text" placeholder="이름 또는 현 소속사 검색..." className="flex-1 outline-none" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 border-b">
              <tr>
                <th className="p-4 font-medium">구분</th>
                <th className="p-4 font-medium">이름/조직명</th>
                <th className="p-4 font-medium">현 소속사</th>
                <th className="p-4 font-medium">상태</th>
                <th className="p-4 font-medium">배정 사업단</th>
                <th className="p-4 font-medium">담당자</th>
                <th className="p-4 font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="p-4"><span className={`px-2 py-1 rounded text-xs ${c.type==='org'?'bg-purple-100 text-purple-800':'bg-indigo-100 text-indigo-800'}`}>{c.type === 'org' ? '조직' : '개인'}</span></td>
                  <td className="p-4 font-medium">{c.name} {c.type === 'org' && <span className="text-xs text-gray-400">({c.headcount}명)</span>}</td>
                  <td className="p-4 text-gray-600">{c.currentCo}</td>
                  <td className="p-4"><StatusBadge status={c.status} /></td>
                  <td className="p-4 text-gray-600">{c.agency || '-'}</td>
                  <td className="p-4 text-gray-600">{c.createdBy}</td>
                  <td className="p-4">
                    <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline text-sm font-medium">상세/수정</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-gray-500">등록된 후보자가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && <CandidateModal cand={editingDoc} onClose={() => setIsModalOpen(false)} onSave={handleSave} onAddHistory={handleAddHistory} events={events} orgs={orgs} />}
    </div>
  );
}

function CandidateModal({ cand, onClose, onSave, onAddHistory, events, orgs }) {
  const [activeTab, setActiveTab] = useState('info');
  const [formData, setFormData] = useState(cand || {
    type: 'individual', status: '미팅', name: '', phone: '', currentCo: '', 
    headcount: '', subsidy: '', eventId: '', agency: '', parentOrg: '', exp: '', nextActionDate: '', nextActionMemo: ''
  });
  const [newMemo, setNewMemo] = useState('');

  const isOrg = formData.type === 'org';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h3 className="text-lg font-bold">{cand ? '후보자 상세 및 수정' : '신규 후보자 등록'}</h3>
          <button onClick={onClose}><XCircle className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        
        {cand && (
          <div className="flex border-b">
            <button className={`flex-1 py-3 text-sm font-medium ${activeTab === 'info' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`} onClick={() => setActiveTab('info')}>기본 정보</button>
            <button className={`flex-1 py-3 text-sm font-medium ${activeTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`} onClick={() => setActiveTab('history')}>진행 히스토리</button>
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'info' ? (
            <form id="cand-form" onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4">
              {!cand && (
                <div className="flex space-x-4 mb-6">
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="type" checked={formData.type === 'individual'} onChange={() => setFormData({...formData, type: 'individual'})} />
                    <span>개인 이동</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="type" checked={formData.type === 'org'} onChange={() => setFormData({...formData, type: 'org'})} />
                    <span>조직 이동(조직장)</span>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{isOrg ? '조직명/조직장 이름' : '이름'}</label>
                  <input required className="w-full border p-2 rounded" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">연락처</label>
                  <input required className="w-full border p-2 rounded" value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">현 소속사</label>
                  <input required className="w-full border p-2 rounded" value={formData.currentCo} onChange={e=>setFormData({...formData, currentCo:e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">진행 상태</label>
                  <select className="w-full border p-2 rounded" value={formData.status} onChange={e=>setFormData({...formData, status:e.target.value})}>
                    <option value="미팅">미팅</option><option value="위촉진행">위촉진행</option>
                    <option value="위촉완료">위촉완료</option><option value="드랍/거절">드랍/거절</option>
                  </select>
                </div>

                {isOrg ? (
                  <>
                    <div><label className="block text-xs text-gray-500 mb-1">이동 인원 (명)</label><input type="number" className="w-full border p-2 rounded" value={formData.headcount} onChange={e=>setFormData({...formData, headcount:e.target.value})} /></div>
                  </>
                ) : (
                  <>
                    <div><label className="block text-xs text-gray-500 mb-1">소속 조직 (함께 이동시)</label><input className="w-full border p-2 rounded" value={formData.parentOrg} onChange={e=>setFormData({...formData, parentOrg:e.target.value})} /></div>
                    <div><label className="block text-xs text-gray-500 mb-1">경력 (년)</label><input className="w-full border p-2 rounded" value={formData.exp} onChange={e=>setFormData({...formData, exp:e.target.value})} /></div>
                  </>
                )}
                
                <div><label className="block text-xs text-gray-500 mb-1">요청 지원금 (억원)</label><input type="number" step="0.1" className="w-full border p-2 rounded" value={formData.subsidy} onChange={e=>setFormData({...formData, subsidy:e.target.value})} /></div>
                
                <div>
                  <label className="block text-xs text-gray-500 mb-1">참여 행사</label>
                  <select className="w-full border p-2 rounded" value={formData.eventId} onChange={e=>setFormData({...formData, eventId:e.target.value})}>
                    <option value="">선택안함</option>
                    {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">배정 사업단 (직접입력 또는 선택)</label>
                  <input className="w-full border p-2 rounded" placeholder="예: 서울1사업단" value={formData.agency} onChange={e=>setFormData({...formData, agency:e.target.value})} />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-bold mb-2 flex items-center text-blue-800"><Bell className="w-4 h-4 mr-1"/> 알림 설정 (크론잡 연동용)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">다음 일정/알림 날짜</label>
                    <input type="date" className="w-full border p-2 rounded" value={formData.nextActionDate} onChange={e=>setFormData({...formData, nextActionDate:e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">알림 내용</label>
                    <input className="w-full border p-2 rounded" placeholder="이메일로 발송될 내용" value={formData.nextActionMemo} onChange={e=>setFormData({...formData, nextActionMemo:e.target.value})} />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">* 설정된 날짜에 담당자 이메일로 알림이 발송됩니다.</p>
              </div>

            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input className="flex-1 border p-2 rounded text-sm" placeholder="새로운 미팅 내용이나 특이사항 입력..." value={newMemo} onChange={e=>setNewMemo(e.target.value)} onKeyPress={e => {if(e.key==='Enter') {e.preventDefault(); onAddHistory(cand.id, {memo: newMemo}); setNewMemo('');}}} />
                <button type="button" onClick={() => {onAddHistory(cand.id, {memo: newMemo}); setNewMemo('');}} className="bg-slate-800 text-white px-4 rounded text-sm whitespace-nowrap">기록 추가</button>
              </div>
              <div className="space-y-3 mt-4 border-l-2 border-gray-200 ml-2 pl-4">
                {cand?.history?.map((h, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white"></div>
                    <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border">{h.memo}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(h.date).toLocaleString()} · {h.writer}</p>
                  </div>
                ))}
                {(!cand?.history || cand.history.length === 0) && <p className="text-sm text-gray-500">기록이 없습니다.</p>}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t bg-gray-50 flex justify-end space-x-2 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-100">닫기</button>
          {activeTab === 'info' && <button form="cand-form" type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>}
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ users, orgs, events, showToast }) {
  const [tab, setTab] = useState('users');

  const handleUserApproval = async (id, status) => {
    try { 
      await updateDoc(getDocRef('users', id), { status });
      showToast("처리가 완료되었습니다.");
    } catch (e) { 
      showToast("처리 실패"); 
    }
  };

  const handleOrgCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').filter(l => l.trim() !== '');
      showToast(`총 ${lines.length - 1}개의 조직 데이터가 테스트 인식되었습니다.`);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">시스템 관리</h2>
      
      <div className="flex space-x-2 border-b">
        {['users', 'orgs', 'events'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 font-medium ${tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            {t === 'users' ? '사용자 관리' : t === 'orgs' ? '조직 데이터' : '행사 관리'}
          </button>
        ))}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        {tab === 'users' && (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b"><tr><th className="p-3">이름</th><th className="p-3">연락처</th><th className="p-3">상태</th><th className="p-3">권한</th><th className="p-3">작업</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b">
                  <td className="p-3">{u.name}</td><td className="p-3">{u.phone}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${u.status==='approved'?'bg-green-100 text-green-800':'bg-yellow-100 text-yellow-800'}`}>{u.status}</span></td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3 space-x-2">
                    {u.status === 'pending' && <button onClick={()=>handleUserApproval(u.id, 'approved')} className="text-blue-600 text-xs border border-blue-600 px-2 py-1 rounded hover:bg-blue-50">승인</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'orgs' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div>
                <h4 className="font-bold text-blue-900">조직 대량 등록 (CSV 형식)</h4>
                <p className="text-xs text-blue-700 mt-1">사업부, 사업단, 본부 순서로 작성된 CSV 파일을 업로드하세요.</p>
              </div>
              <div className="flex space-x-2">
                <button className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"><Download className="w-4 h-4 mr-1"/> 샘플 다운로드</button>
                <label className="flex items-center px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 cursor-pointer">
                  <Upload className="w-4 h-4 mr-1"/> 업로드 <input type="file" accept=".csv" className="hidden" onChange={handleOrgCSV} />
                </label>
              </div>
            </div>
            <p className="text-sm text-gray-500">현재 등록된 조직 수: {orgs.length}개</p>
          </div>
        )}

        {tab === 'events' && (
           <div className="space-y-4">
             <button className="bg-blue-600 text-white px-3 py-2 rounded text-sm" onClick={() => showToast('새 행사 추가 모달 (준비중)')}>+ 새 행사 추가</button>
             <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b"><tr><th className="p-3">행사명</th><th className="p-3">일자</th><th className="p-3">내용</th></tr></thead>
              <tbody>
                {events.map(e => <tr key={e.id} className="border-b"><td className="p-3">{e.name}</td><td className="p-3">{e.date}</td><td className="p-3">{e.details}</td></tr>)}
                {events.length === 0 && <tr><td colSpan="3" className="p-4 text-center text-gray-500">등록된 행사가 없습니다.</td></tr>}
              </tbody>
            </table>
           </div>
        )}
      </div>
    </div>
  );
}

function SelfRecruitingManager({ data, showToast }) {
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').filter(l => l.trim() !== '');
      showToast(`총 ${lines.length - 1}건의 데이터가 성공적으로 처리되었습니다.`);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">사업단 자체 리크루팅 관리 (월간)</h2>
        <div className="flex space-x-2">
           <button className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"><Download className="w-4 h-4 mr-1"/> 샘플 다운로드</button>
           <label className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm cursor-pointer hover:bg-slate-700">
             엑셀 대량 등록 <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
           </label>
        </div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center min-h-[300px]">
        <ClipboardList className="w-12 h-12 text-gray-300 mb-2"/>
        <p className="text-gray-500">사업단 자체 리크루팅 데이터가 없습니다.</p>
        <p className="text-sm text-gray-400 mt-1">엑셀 업로드를 통해 월별 데이터를 관리할 수 있습니다.</p>
      </div>
    </div>
  );
}

function Reports({ candidates }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">리크루팅 보고서</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border">
          <h3 className="font-bold border-b pb-2 mb-3">외부 리크루팅 요약</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex justify-between"><span>총 등록 후보자</span> <span>{candidates.length}명</span></li>
            <li className="flex justify-between"><span>위촉 완료</span> <span className="text-green-600 font-bold">{candidates.filter(c=>c.status==='위촉완료').length}명</span></li>
          </ul>
          <button className="w-full mt-4 bg-gray-50 border py-2 rounded text-sm hover:bg-gray-100">상세 보고서 보기</button>
        </div>
        <div className="bg-white p-5 rounded-xl border">
          <h3 className="font-bold border-b pb-2 mb-3">사업단 자체 리크루팅 요약</h3>
          <p className="text-sm text-gray-500 py-4 text-center">데이터 없음</p>
        </div>
      </div>
    </div>
  );
}