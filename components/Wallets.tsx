import React, { useState } from 'react';
import { AppState, Wallet, WalletType, Transaction, TransactionType, EntityStatus } from '../types';
import { Plus, ArrowRightLeft, Download, Trash2, CreditCard, History, ArrowDownLeft, Edit2, Save, X, AlertTriangle } from 'lucide-react';

interface WalletsProps {
  state: AppState;
  onAddWallet: (wallet: Wallet) => void;
  onUpdateWallet: (id: string, updates: Partial<Wallet>) => void;
  onDeleteWallet: (id: string) => void;
  onTransfer: (fromId: string, toId: string, amount: number, date: string) => void;
  onFundMain: (amount: number) => void;
  onEditTransaction: (id: number, updates: Partial<Transaction>) => void;
  onDeleteTransaction: (id: number) => void;
}

export const Wallets: React.FC<WalletsProps> = ({ state, onAddWallet, onUpdateWallet, onDeleteWallet, onTransfer, onFundMain, onEditTransaction, onDeleteTransaction }) => {
  const [showAddCard, setShowAddCard] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showFund, setShowFund] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Delete Modal State
  const [deleteWalletId, setDeleteWalletId] = useState<string | null>(null);
  const [deleteTxId, setDeleteTxId] = useState<number | null>(null); // For transaction deletion
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Transfer Form State
  const [transferAmount, setTransferAmount] = useState('');
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);

  // Create Card Form State
  const [newCardName, setNewCardName] = useState('');
  const [newCardHolder, setNewCardHolder] = useState('');
  const [newCardStatus, setNewCardStatus] = useState<EntityStatus>(EntityStatus.ACTIVE);

  // Edit Card State
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [editWalletName, setEditWalletName] = useState('');
  const [editWalletHolder, setEditWalletHolder] = useState('');
  const [editWalletStatus, setEditWalletStatus] = useState<EntityStatus>(EntityStatus.ACTIVE);


  // Fund Form State
  const [fundAmount, setFundAmount] = useState('');

  // Edit Transaction State
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editTxData, setEditTxData] = useState<{
    amount: string;
    date: string;
    description: string;
    fromId: string;
    toId: string;
  }>({ amount: '', date: '', description: '', fromId: '', toId: '' });


  // Filters
  const [filterWalletId, setFilterWalletId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const mainWallet = state.wallets.find(w => w.type === WalletType.MAIN);
  const employeeWallets = state.wallets.filter(w => w.type === WalletType.EMPLOYEE);
  const allWallets = state.wallets;

  const relevantTransactions = state.transactions
    .filter(t => t.type !== TransactionType.SUBSCRIPTION_PAYMENT)
    .filter(t => {
      // Wallet Filter
      if (filterWalletId) {
        if (t.fromWalletId !== filterWalletId && t.toWalletId !== filterWalletId) return false;
      }
      // Date Filter
      if (filterStartDate) {
        if (new Date(t.date) < new Date(filterStartDate)) return false;
      }
      if (filterEndDate) {
        const d = new Date(t.date);
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    onAddWallet({
      id: crypto.randomUUID(),
      name: newCardName,
      type: WalletType.EMPLOYEE,
      balance: 0,
      holderName: newCardHolder,
      status: newCardStatus
    });
    setNewCardName('');
    setNewCardHolder('');
    setNewCardStatus(EntityStatus.ACTIVE);
    setShowAddCard(false);
  };

  const startEditingWallet = (w: Wallet) => {
    setEditingWallet(w);
    setEditWalletName(w.name);
    setEditWalletHolder(w.holderName || '');
    setEditWalletStatus(w.status);
  };

  const handleUpdateWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingWallet) {
      onUpdateWallet(editingWallet.id, {
        name: editWalletName,
        holderName: editWalletHolder,
        status: editWalletStatus
      });
      setEditingWallet(null);
    }
  };

  const promptDeleteWallet = (id: string) => {
    setDeleteWalletId(id);
    setDeleteConfirmText('');
  };

  const promptDeleteTx = (id: number) => {
    setDeleteTxId(id);
    setDeleteConfirmText('');
  };

  const confirmDelete = () => {
    if (deleteConfirmText.toLowerCase() === 'delete') {
      if (deleteWalletId) {
        onDeleteWallet(deleteWalletId);
        setDeleteWalletId(null);
      }
      if (deleteTxId) {
        onDeleteTransaction(deleteTxId);
        setDeleteTxId(null);
      }
    }
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferFromId && transferToId) {
      onTransfer(transferFromId, transferToId, parseFloat(transferAmount), new Date(transferDate).toISOString());
      setTransferAmount('');
      setTransferToId('');
      setTransferFromId('');
      setTransferDate(new Date().toISOString().split('T')[0]);
      setShowTransfer(false);
    }
  };

  const handleFund = (e: React.FormEvent) => {
    e.preventDefault();
    onFundMain(parseFloat(fundAmount));
    setFundAmount('');
    setShowFund(false);
  };

  const startEditingTx = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setEditTxData({
      amount: tx.amount.toString(),
      date: tx.date.split('T')[0],
      description: tx.description,
      fromId: tx.fromWalletId || '',
      toId: tx.toWalletId || ''
    });
  };

  const saveEditingTx = () => {
    if (editingTxId) {
      onEditTransaction(editingTxId, {
        amount: parseFloat(editTxData.amount),
        date: new Date(editTxData.date).toISOString(),
        description: editTxData.description,
        fromWalletId: editTxData.fromId || undefined,
        toWalletId: editTxData.toId || undefined
      });
      setEditingTxId(null);
    }
  };

  const getWalletName = (id?: string) => {
    if (!id) return 'Bank / External';
    const w = state.wallets.find(w => w.id === id);
    return w ? w.name : 'Unknown Wallet';
  };

  return (
    <div className="space-y-8 relative">
      {/* Delete Confirmation Modal (Shared for Wallet and Transaction) */}
      {(deleteWalletId || deleteTxId) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl text-center">
            <div className="flex justify-center text-red-500 mb-4"><AlertTriangle size={48} /></div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Deletion?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This action is permanent. Type <strong>delete</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              className="w-full border border-red-200 rounded p-2 mb-4 text-center focus:border-red-500 outline-none"
              placeholder="delete"
            />
            <div className="flex gap-2">
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
              <button onClick={() => { setDeleteWalletId(null); setDeleteTxId(null); }} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Wallet Modal */}
      {editingWallet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Edit Card Details</h3>
              <button onClick={() => setEditingWallet(null)}><X size={20} className="text-gray-500" /></button>
            </div>
            <form onSubmit={handleUpdateWallet} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Card Label</label>
                <input required value={editWalletName} onChange={e => setEditWalletName(e.target.value)} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Holder Name</label>
                <input required value={editWalletHolder} onChange={e => setEditWalletHolder(e.target.value)} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={editWalletStatus === EntityStatus.ACTIVE} onChange={() => setEditWalletStatus(EntityStatus.ACTIVE)} />
                    <span className="text-sm text-green-600 font-bold">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={editWalletStatus === EntityStatus.INACTIVE} onChange={() => setEditWalletStatus(EntityStatus.INACTIVE)} />
                    <span className="text-sm text-gray-500 font-bold">Inactive</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Save Changes</button>
                <button type="button" onClick={() => setEditingWallet(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Wallet Section */}
      <section className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-slate-400 font-medium mb-1">Main Company Wallet</h2>
            <div className="text-4xl font-bold mb-4">{mainWallet?.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</div>
            <p className="text-slate-400 text-sm">Source of funds for all employee cards.</p>
          </div>
          <button
            onClick={() => setShowFund(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <Download size={18} /> Add Funds
          </button>
        </div>

        {showFund && (
          <form onSubmit={handleFund} className="mt-6 bg-white/10 p-4 rounded-lg backdrop-blur-sm flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-300 mb-1">Amount to deposit from Bank (SAR)</label>
              <input
                type="number"
                min="1"
                required
                value={fundAmount}
                onChange={e => setFundAmount(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                placeholder="5000"
              />
            </div>
            <button type="submit" className="bg-emerald-500 text-white px-4 py-2 rounded hover:bg-emerald-600">Confirm</button>
            <button type="button" onClick={() => setShowFund(false)} className="text-slate-300 px-4 py-2 hover:text-white">Cancel</button>
          </form>
        )}
      </section>

      {/* Internal Transfers Action */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Employee Cards</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowTransfer(true);
              setTransferFromId(mainWallet?.id || '');
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-sm"
          >
            <ArrowRightLeft size={18} /> Transfer Funds
          </button>
          <button
            onClick={() => setShowAddCard(true)}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-sm"
          >
            <Plus size={18} /> New Card
          </button>
        </div>
      </div>

      {showTransfer && (
        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl">
          <h3 className="font-semibold text-indigo-900 mb-4">Internal Transfer</h3>
          <form onSubmit={handleTransfer} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-indigo-800 mb-1">From</label>
              <select
                required
                value={transferFromId}
                onChange={e => setTransferFromId(e.target.value)}
                className="w-full border border-indigo-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">-- Select Source --</option>
                {allWallets.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.balance.toLocaleString()} SAR)</option>
                ))}
              </select>
            </div>
            <div className="flex items-center pb-3 text-indigo-400">
              <ArrowRightLeft size={20} />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-indigo-800 mb-1">To</label>
              <select
                required
                value={transferToId}
                onChange={e => setTransferToId(e.target.value)}
                className="w-full border border-indigo-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">-- Select Destination --</option>
                {allWallets.filter(w => w.id !== transferFromId).map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.balance.toLocaleString()} SAR)</option>
                ))}
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-indigo-800 mb-1">Amount (SAR)</label>
              <input
                type="number"
                min="1"
                required
                value={transferAmount}
                onChange={e => setTransferAmount(e.target.value)}
                className="w-full border border-indigo-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="0.00"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-indigo-800 mb-1">Date</label>
              <input
                type="date"
                required
                value={transferDate}
                onChange={e => setTransferDate(e.target.value)}
                className="w-full border border-indigo-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">Transfer</button>
              <button type="button" onClick={() => setShowTransfer(false)} className="bg-white text-indigo-600 px-4 py-2 rounded-lg border border-indigo-200 hover:bg-indigo-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showAddCard && (
        <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-4">Issue New Employee Card</h3>
          <form onSubmit={handleCreateCard} className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-600 mb-1">Card Label (e.g. Marketing Ops)</label>
                <input required value={newCardName} onChange={e => setNewCardName(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-600 mb-1">Employee Name</label>
                <input required value={newCardHolder} onChange={e => setNewCardHolder(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Status:</label>
                <select className="border rounded p-1 text-sm" value={newCardStatus} onChange={e => setNewCardStatus(e.target.value as EntityStatus)}>
                  <option value={EntityStatus.ACTIVE}>Active</option>
                  <option value={EntityStatus.INACTIVE}>Inactive</option>
                </select>
              </div>
              <div className="flex gap-2 ml-auto">
                <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800">Create Card</button>
                <button type="button" onClick={() => setShowAddCard(false)} className="text-gray-500 px-4 py-2 hover:text-gray-700">Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employeeWallets.map(wallet => (
          <div key={wallet.id} className={`bg-white p-6 rounded-xl shadow-sm border flex flex-col justify-between h-48 relative group ${wallet.status === EntityStatus.INACTIVE ? 'border-gray-100 opacity-75 bg-gray-50' : 'border-gray-100'}`}>
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={() => startEditingWallet(wallet)}
                className="text-gray-300 hover:text-blue-500 transition"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => promptDeleteWallet(wallet.id)}
                className="text-gray-300 hover:text-red-500 transition"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4 text-gray-500">
                <CreditCard size={20} />
                <span className="text-sm font-medium tracking-wide">VIRTUAL CARD</span>
                {wallet.status === EntityStatus.INACTIVE && (
                  <span className="ml-auto text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-bold">INACTIVE</span>
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-800">{wallet.name}</h3>
              <p className="text-sm text-gray-500">{wallet.holderName}</p>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase font-semibold">Current Balance</div>
              <div className={`text-2xl font-bold ${wallet.status === EntityStatus.INACTIVE ? 'text-gray-400' : 'text-indigo-600'}`}>{wallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</div>
            </div>
          </div>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Internal Wallet Log</h3>
            <p className="text-sm text-gray-500">Deposits and internal transfers only.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Wallet Filter */}
            <select
              value={filterWalletId}
              onChange={e => setFilterWalletId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Wallets</option>
              {allWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>

            {/* Date Range */}
            <input
              type="date"
              value={filterStartDate}
              onChange={e => setFilterStartDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Start Date"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={e => setFilterEndDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="End Date"
            />

            <button onClick={() => setShowHistory(!showHistory)} className="text-gray-500 hover:text-indigo-600 flex items-center gap-1 text-sm ml-2">
              <History size={16} /> {showHistory ? 'Hide' : 'Show'} Full Log
            </button>
          </div>
        </div>

        {(showHistory || relevantTransactions.length > 0) && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-medium">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Source / Dest</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3 text-right">Amount (SAR)</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {relevantTransactions.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No funding transactions recorded yet.</td></tr>
                ) : (
                  relevantTransactions.slice(0, showHistory ? undefined : 10).map(t => {
                    const isEditing = editingTxId === t.id;

                    let BadgeColor = 'bg-gray-100 text-gray-700';
                    let Icon = ArrowRightLeft;
                    if (t.type === TransactionType.DEPOSIT_FROM_BANK) { BadgeColor = 'bg-emerald-100 text-emerald-700'; Icon = ArrowDownLeft; }
                    if (t.type === TransactionType.INTERNAL_TRANSFER) { BadgeColor = 'bg-indigo-100 text-indigo-700'; }

                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        {/* Date */}
                        <td className="px-6 py-4 text-gray-500">
                          {isEditing ? (
                            <input type="date" value={editTxData.date} onChange={e => setEditTxData({ ...editTxData, date: e.target.value })} className="border rounded px-2 py-1 text-xs" />
                          ) : new Date(t.date).toLocaleDateString()}
                        </td>

                        {/* Type */}
                        <td className="px-6 py-4">
                          <span className={`flex items-center gap-1 w-fit px-2 py-1 rounded-full text-xs font-semibold ${BadgeColor}`}>
                            <Icon size={12} />
                            {t.type.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Source / Dest - Editable for Transfer */}
                        <td className="px-6 py-4 text-gray-700">
                          {isEditing && t.type === TransactionType.INTERNAL_TRANSFER ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1 text-xs">
                                <span>From:</span>
                                <select value={editTxData.fromId} onChange={e => setEditTxData({ ...editTxData, fromId: e.target.value })} className="border rounded p-1 w-32">
                                  {allWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                              </div>
                              <div className="flex items-center gap-1 text-xs">
                                <span>To:</span>
                                <select value={editTxData.toId} onChange={e => setEditTxData({ ...editTxData, toId: e.target.value })} className="border rounded p-1 w-32">
                                  {allWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                              </div>
                            </div>
                          ) : isEditing && t.type === TransactionType.DEPOSIT_FROM_BANK ? (
                            <div className="flex items-center gap-1 text-xs">
                              <span>To:</span>
                              <select value={editTxData.toId} onChange={e => setEditTxData({ ...editTxData, toId: e.target.value })} className="border rounded p-1 w-32">
                                {allWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </select>
                            </div>
                          ) : (
                            <>
                              {t.type === TransactionType.DEPOSIT_FROM_BANK && 'Bank Deposit -> Main Wallet'}
                              {t.type === TransactionType.INTERNAL_TRANSFER && `${getWalletName(t.fromWalletId)} -> ${getWalletName(t.toWalletId)}`}
                            </>
                          )}
                        </td>

                        {/* Description */}
                        <td className="px-6 py-4 text-gray-600">
                          {isEditing ? (
                            <input type="text" value={editTxData.description} onChange={e => setEditTxData({ ...editTxData, description: e.target.value })} className="border rounded px-2 py-1 text-xs w-full" />
                          ) : t.description}
                        </td>

                        {/* Amount Column - Editable */}
                        <td className="px-6 py-4 font-bold text-gray-800 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              className="w-24 border rounded px-2 py-1 text-right bg-white shadow-sm"
                              value={editTxData.amount}
                              onChange={e => setEditTxData({ ...editTxData, amount: e.target.value })}
                            />
                          ) : t.amount.toLocaleString()}
                        </td>

                        {/* Action Column */}
                        <td className="px-6 py-4 text-center">
                          {isEditing ? (
                            <div className="flex justify-center gap-2">
                              <button onClick={saveEditingTx} className="text-green-600 hover:bg-green-100 p-1 rounded"><Save size={16} /></button>
                              <button onClick={() => setEditingTxId(null)} className="text-gray-500 hover:bg-gray-100 p-1 rounded"><X size={16} /></button>
                            </div>
                          ) : (
                            <div className="flex justify-center gap-2">
                              <button onClick={() => startEditingTx(t)} className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => promptDeleteTx(t.id)} className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};