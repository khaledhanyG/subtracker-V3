import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { Wallets } from './components/Wallets';
import { Subscriptions } from './components/Subscriptions';
import { Departments } from './components/Departments';
import { Qoyod } from './components/Qoyod';
import { InvoiceOCR } from './components/InvoiceOCR';
import { Auth } from './components/Auth';
import { AppState, WalletType, Wallet, Department, Account, Subscription } from './types';
import { LayoutDashboard, WalletCards, List, Users, BookOpen, FileText, LogOut, Loader2 } from 'lucide-react';
import api, { clearToken } from './services/api';

const INITIAL_STATE: AppState = {
  wallets: [],
  departments: [],
  accounts: [],
  subscriptions: [],
  transactions: []
};

import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  // Authentication State
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Data State
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [loadingData, setLoadingData] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'wallets' | 'subscriptions' | 'departments' | 'qoyod' | 'ocr'>('dashboard');

  const checkAuth = async () => {
    const token = localStorage.getItem('subtracker_token');
    if (token) {
      try {
        // Optionally verify token or just load data
        await loadData();
        setIsAuthenticated(true);
        // You might want to decode token to get user name if not stored
      } catch (e) {
        console.error("Auth failed", e);
        clearToken();
        setIsAuthenticated(false);
      }
    }
    setIsAuthChecking(false);
  };

  const loadData = async () => {
    setLoadingData(true);
    try {
      const res = await api.get('/data');
      const fixNumbers = (item: any, fields: string[]) => {
        const newItem = { ...item };
        fields.forEach(f => {
          if (newItem[f]) newItem[f] = parseFloat(newItem[f]);
        });
        return newItem;
      };

      if (!res.data || !res.data.wallets) {
        throw new Error("Invalid API response format");
      }

      setState({
        wallets: (res.data.wallets || []).map((w: any) => fixNumbers(w, ['balance'])),
        subscriptions: (res.data.subscriptions || []).map((s: any) => fixNumbers(s, ['baseAmount', 'lastPaymentAmount'])),
        transactions: (res.data.transactions || []).map((t: any) => fixNumbers(t, ['amount', 'vatAmount'])),
        departments: res.data.departments || [],
        accounts: res.data.accounts || []
      });
    } catch (e) {
      console.error("Failed to load data", e);
      // If 401, logout
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    setIsAuthenticated(true);
    loadData();
  };

  const handleLogout = () => {
    clearToken();
    setIsAuthenticated(false);
    setUser(null);
    setState(INITIAL_STATE);
  };

  // --- Actions (API Calls) ---

  const addWallet = async (wallet: Wallet) => {
    try {
      await api.post('/wallets', wallet);
      loadData();
    } catch (e) { console.error(e); alert('Failed to add wallet'); }
  };

  const updateWallet = async (id: string, updates: Partial<Wallet>) => {
    try {
      await api.put('/wallets', { id, ...updates });
      loadData();
    } catch (e) { console.error(e); alert('Failed to update wallet'); }
  };

  const deleteWallet = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(`/wallets?id=${id}`);
      loadData();
    } catch (e) { console.error(e); alert('Failed to delete wallet'); }
  };

  const fundMainWallet = async (amount: number) => {
    try {
      const mainWallet = state.wallets.find(w => w.type === 'MAIN');
      if (!mainWallet) {
        alert("Main wallet not found! Please contact support.");
        return;
      }

      await api.post('/transactions', {
        type: 'DEPOSIT_FROM_BANK',
        amount,
        toWalletId: mainWallet.id,
        date: new Date().toISOString(),
        description: 'Bank Deposit'
      });
      loadData();
    } catch (e: any) {
      console.error("Fund wallet error:", e);
      const msg = e.response?.data?.error || e.message || 'Failed to fund wallet';
      alert(`Error: ${msg}`);
    }
  };

  const transferFunds = async (fromId: string, toId: string, amount: number) => {
    try {
      await api.post('/transactions', {
        type: 'INTERNAL_TRANSFER',
        amount,
        fromWalletId: fromId,
        toWalletId: toId,
        date: new Date().toISOString(),
        description: 'Internal Transfer'
      });
      loadData();
    } catch (e) { console.error(e); alert('Transfer failed'); }
  };

  const editTransaction = async (txId: number, updates: any) => {
    try {
      await api.put('/transactions', { id: txId, ...updates });
      loadData();
    } catch (e) { console.error(e); alert('Failed to update transaction'); }
  };

  const deleteTransaction = async (txId: number) => {
    if (!confirm('Revert this transaction?')) return;
    try {
      await api.delete(`/transactions?id=${txId}`);
      loadData();
    } catch (e) { console.error(e); alert('Failed to revert transaction'); }
  };

  const addSubscription = async (subData: any) => {
    try {
      await api.post('/subscriptions', subData);
      loadData();
    } catch (e) { console.error(e); alert('Failed to add subscription'); }
  };

  const updateSubscription = async (id: string, updates: Partial<Subscription>) => {
    try {
      await api.put('/subscriptions', { id, ...updates });
      loadData();
    } catch (e) { console.error(e); alert('Failed to update subscription'); }
  };

  const deleteSubscription = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(`/subscriptions?id=${id}`);
      loadData();
    } catch (e) { console.error(e); alert('Failed to delete subscription'); }
  };

  const recordPayment = async (subscriptionId: string, walletId: string, amount: number, date: string, nextRenewalDate: string, vatAmount?: number) => {
    try {
      await api.post('/transactions', {
        type: 'SUBSCRIPTION_PAYMENT',
        amount,
        fromWalletId: walletId,
        subscriptionId,
        date,
        nextRenewalDate,
        vatAmount,
        description: 'Subscription Payment'
      });
      loadData();
    } catch (e) { console.error(e); alert('Payment failed'); }
  };

  const recordRefund = async (subscriptionId: string, walletId: string, amount: number, date: string) => {
    try {
      await api.post('/transactions', {
        type: 'REFUND',
        amount,
        toWalletId: walletId,
        subscriptionId,
        date,
        description: 'Refund'
      });
      loadData();
    } catch (e) { console.error(e); alert('Refund failed'); }
  };

  // Departments
  const addDepartment = async (name: string, color: string) => {
    try { await api.post('/departments', { name, color }); loadData(); } catch (e) { alert('Error'); }
  };

  const updateDepartment = (id: string, updates: Partial<Department>) => {
    // Implement API
    console.log("Update Dept not implemented");
  };

  const deleteDepartment = async (id: string) => {
    try { await api.delete(`/departments?id=${id}`); loadData(); } catch (e) { alert('Error'); }
  };

  // Accounts
  const addAccount = async (name: string, code: string) => {
    try { await api.post('/accounts', { name, code }); loadData(); } catch (e) { alert('Error'); }
  };

  const updateAccount = (id: string, updates: Partial<Account>) => {
    console.log("Update Account not implemented");
  };

  const deleteAccount = async (id: string) => {
    try { await api.delete(`/accounts?id=${id}`); loadData(); } catch (e) { alert('Error'); }
  };

  // --- Auth Gate ---
  if (isAuthChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  }

  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-10 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 text-indigo-600">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
            <span className="text-xl font-bold tracking-tight text-gray-900">SubTrack AI</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button
            onClick={() => setActiveTab('wallets')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'wallets' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <WalletCards size={20} /> Wallets & Funds
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'subscriptions' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <List size={20} /> Subscriptions
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'departments' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Users size={20} /> Departments
          </button>
          <button
            onClick={() => setActiveTab('qoyod')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'qoyod' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <BookOpen size={20} /> Qoyod
          </button>
          <button
            onClick={() => setActiveTab('ocr')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'ocr' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <FileText size={20} /> Invoice OCR
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
            <p className="text-xs font-medium opacity-80 mb-1">Total Balance</p>
            <p className="text-lg font-bold">{state.wallets.reduce((acc, w) => acc + parseFloat(w.balance as any), 0).toLocaleString()} SAR</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 capitalize">{activeTab === 'ocr' ? 'Invoice OCR Scanner' : activeTab}</h1>
            <p className="text-gray-500 text-sm mt-1">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border shadow-sm">
              <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs">U</div>
              <span className="text-sm font-medium text-gray-700">{user?.name || 'User'}</span>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-600 transition" title="Logout">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {loadingData ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>
        ) : (
          <div className="animation-fade-in">
            {activeTab === 'dashboard' && <Dashboard state={state} />}
            {activeTab === 'wallets' && (
              <Wallets
                state={state}
                onAddWallet={addWallet}
                onUpdateWallet={updateWallet}
                onDeleteWallet={deleteWallet}
                onTransfer={transferFunds}
                onFundMain={fundMainWallet}
                onEditTransaction={editTransaction}
                onDeleteTransaction={deleteTransaction}
              />
            )}
            {activeTab === 'subscriptions' && (
              <Subscriptions
                state={state}
                onAddSubscription={addSubscription}
                onDeleteSubscription={deleteSubscription}
                onRecordPayment={recordPayment}
                onUpdateSubscription={updateSubscription}
                onEditTransaction={editTransaction}
                onDeleteTransaction={deleteTransaction}
                onRecordRefund={recordRefund}
              />
            )}
            {activeTab === 'departments' && (
              <Departments
                departments={state.departments}
                onAdd={addDepartment}
                onUpdate={updateDepartment}
                onDelete={deleteDepartment}
              />
            )}
            {activeTab === 'qoyod' && (
              <Qoyod
                accounts={state.accounts}
                onAdd={addAccount}
                onUpdate={updateAccount}
                onDelete={deleteAccount}
              />
            )}
            {activeTab === 'ocr' && <InvoiceOCR accounts={state.accounts} />}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
