
import React, { useState, useEffect } from 'react';
import { AppState, Subscription, WalletType, BillingCycle, AllocationType, DepartmentSplit, AccountSplit, TransactionType, EntityStatus, Transaction } from '../types';
import { Plus, AlertTriangle, Search, Trash2, Receipt, Users, ArrowRight, History, Edit2, StickyNote, CreditCard, Save, X, FileText, Undo2, Coins } from 'lucide-react';

interface SubscriptionsProps {
  state: AppState;
  onAddSubscription: (sub: Omit<Subscription, 'id'>) => void;
  onDeleteSubscription: (id: number) => void;
  onRecordPayment: (subscriptionId: number, walletId: string, amount: number, date: string, nextRenewalDate: string, vatAmount?: number) => void;
  onUpdateSubscription: (id: number, updates: Partial<Subscription>) => void;
  onEditTransaction: (id: number, updates: Partial<Transaction>) => void;
  onDeleteTransaction: (id: number) => void;
  onRecordRefund: (subscriptionId: number, walletId: string, amount: number, date: string) => void;
}

export const Subscriptions: React.FC<SubscriptionsProps> = ({ state, onAddSubscription, onDeleteSubscription, onRecordPayment, onUpdateSubscription, onEditTransaction, onDeleteTransaction, onRecordRefund }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'ADD' | 'PAY' | 'REFUND' | 'HISTORY'>('LIST');
  const [searchTerm, setSearchTerm] = useState('');
  const [nameError, setNameError] = useState('');

  // --- Modal States ---
  const [deleteModalSub, setDeleteModalSub] = useState<Subscription | null>(null);
  const [deleteTxId, setDeleteTxId] = useState<number | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');

  // --- History Filters & Accounting ---
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterServiceId, setFilterServiceId] = useState<number | ''>('');
  const [showAccountingModal, setShowAccountingModal] = useState(false);

  // --- Edit History State ---
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editTxData, setEditTxData] = useState<{
    amount: string;
    date: string;
    walletId: string;
    subId: string;
  }>({ amount: '', date: '', walletId: '', subId: '' });


  // --- Add/Edit Subscription Form State ---
  const [subForm, setSubForm] = useState<{
    id?: number;
    name: string;
    baseAmount: string;
    billingCycle: BillingCycle;
    userCount: string;

    // Dept Allocation
    allocationType: AllocationType;
    selectedDeptIds: string[];
    percentages: Record<string, string>;

    // Account Allocation
    accountAllocationType: AllocationType;
    selectedAccountIds: string[];
    accountPercentages: Record<string, string>;

    startDate: string;
    renewalDate: string;
    notes: string;
    status: EntityStatus;
  }>({
    name: '',
    baseAmount: '',
    billingCycle: BillingCycle.MONTHLY,
    userCount: '1',
    allocationType: AllocationType.SINGLE,
    selectedDeptIds: [],
    percentages: {},
    accountAllocationType: AllocationType.SINGLE,
    selectedAccountIds: [],
    accountPercentages: {},
    startDate: new Date().toISOString().split('T')[0],
    renewalDate: '',
    notes: '',
    status: EntityStatus.ACTIVE
  });

  // --- Record Payment Form State ---
  const [payForm, setPayForm] = useState({
    subscriptionId: '',
    walletId: '',
    amount: '', // This acts as Base Amount if taxable
    date: new Date().toISOString().split('T')[0],
    nextRenewalDate: '',
    isTaxable: false,
    vatAmount: ''
  });

  // --- Record Refund Form State ---
  const [refundForm, setRefundForm] = useState({
    subscriptionId: '',
    walletId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Calculate VAT when amount or taxable changes
  useEffect(() => {
    if (payForm.isTaxable && payForm.amount) {
      const base = parseFloat(payForm.amount);
      if (!isNaN(base)) {
        const autoVat = (base * 0.15).toFixed(2);
        // Only set default if VAT field is empty or was auto-calculated previously (simple check: implies we don't overwrite user manual input aggressively if we tracked dirty state, but here we just set default on toggle)
        if (payForm.vatAmount === '') {
          setPayForm(prev => ({ ...prev, vatAmount: autoVat }));
        }
      }
    } else if (!payForm.isTaxable) {
      setPayForm(prev => ({ ...prev, vatAmount: '' }));
    }
  }, [payForm.isTaxable, payForm.amount]);

  const employeeWallets = state.wallets.filter(w => w.type === WalletType.EMPLOYEE);
  const departments = state.departments;
  const accounts = state.accounts;

  const handleDeptToggle = (deptId: string) => {
    setSubForm(prev => {
      const exists = prev.selectedDeptIds.includes(deptId);
      let newIds = exists
        ? prev.selectedDeptIds.filter(id => id !== deptId)
        : [...prev.selectedDeptIds, deptId];

      if (prev.allocationType === AllocationType.SINGLE && newIds.length > 1) {
        newIds = [deptId];
      }
      return { ...prev, selectedDeptIds: newIds };
    });
  };

  const handleAccountToggle = (accId: string) => {
    setSubForm(prev => {
      const exists = prev.selectedAccountIds.includes(accId);
      let newIds = exists
        ? prev.selectedAccountIds.filter(id => id !== accId)
        : [...prev.selectedAccountIds, accId];

      if (prev.accountAllocationType === AllocationType.SINGLE && newIds.length > 1) {
        newIds = [accId];
      }
      return { ...prev, selectedAccountIds: newIds };
    });
  };

  const handleAddOrUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check for duplicate names
    const normalizedName = subForm.name.trim().toLowerCase();
    const duplicate = state.subscriptions.find(s =>
      s.name.trim().toLowerCase() === normalizedName &&
      s.id !== subForm.id // Ignore self if editing
    );

    if (duplicate) {
      setNameError(`Service name "${subForm.name}" is already registered.`);
      return;
    }

    // Dept Splits
    const deptSplits: DepartmentSplit[] = subForm.selectedDeptIds.map(id => ({
      departmentId: id,
      percentage: subForm.allocationType === AllocationType.PERCENTAGE
        ? parseFloat(subForm.percentages[id] || '0')
        : undefined
    }));

    // Account Splits
    const accountSplits: AccountSplit[] = subForm.selectedAccountIds.map(id => ({
      accountId: id,
      percentage: subForm.accountAllocationType === AllocationType.PERCENTAGE
        ? parseFloat(subForm.accountPercentages[id] || '0')
        : undefined
    }));

    const payload = {
      name: subForm.name.trim(),
      baseAmount: parseFloat(subForm.baseAmount),
      billingCycle: subForm.billingCycle,
      userCount: parseInt(subForm.userCount),

      allocationType: subForm.allocationType,
      departments: deptSplits,

      accountAllocationType: subForm.accountAllocationType,
      accounts: accountSplits,

      startDate: subForm.startDate,
      nextRenewalDate: subForm.renewalDate,
      notes: subForm.notes,
      status: subForm.status
    };

    if (subForm.id) {
      // Update Existing
      onUpdateSubscription(subForm.id, payload);
    } else {
      // Create New
      onAddSubscription(payload);
    }

    setViewMode('LIST');
    resetSubForm();
  };

  const resetSubForm = () => {
    setSubForm({
      name: '',
      baseAmount: '',
      billingCycle: BillingCycle.MONTHLY,
      userCount: '1',
      allocationType: AllocationType.SINGLE,
      selectedDeptIds: [],
      percentages: {},
      accountAllocationType: AllocationType.SINGLE,
      selectedAccountIds: [],
      accountPercentages: {},
      startDate: new Date().toISOString().split('T')[0],
      renewalDate: '',
      notes: '',
      status: EntityStatus.ACTIVE,
      id: undefined
    });
    setNameError('');
  };

  const startEditing = (sub: Subscription) => {
    // Department Percentages
    const percentageMap: Record<string, string> = {};
    sub.departments.forEach(d => {
      if (d.percentage) percentageMap[d.departmentId] = d.percentage.toString();
    });

    // Account Percentages
    const accPercentageMap: Record<string, string> = {};
    sub.accounts.forEach(a => {
      if (a.percentage) accPercentageMap[a.accountId] = a.percentage.toString();
    });

    setSubForm({
      id: sub.id,
      name: sub.name,
      baseAmount: sub.baseAmount.toString(),
      billingCycle: sub.billingCycle,
      userCount: sub.userCount.toString(),

      allocationType: sub.allocationType,
      selectedDeptIds: sub.departments.map(d => d.departmentId),
      percentages: percentageMap,

      accountAllocationType: sub.accountAllocationType || AllocationType.SINGLE,
      selectedAccountIds: sub.accounts ? sub.accounts.map(a => a.accountId) : [],
      accountPercentages: accPercentageMap,

      startDate: sub.startDate,
      renewalDate: sub.nextRenewalDate,
      notes: sub.notes || '',
      status: sub.status
    });
    setNameError('');
    setViewMode('ADD');
  };

  // --- Delete Logic ---
  const promptDeleteSub = (sub: Subscription) => {
    setDeleteModalSub(sub);
    setDeleteConfirmText('');
  };

  const promptDeleteTx = (id: number) => {
    setDeleteTxId(id);
    setDeleteConfirmText('');
  };

  const confirmDelete = () => {
    if (deleteConfirmText.toLowerCase() === 'delete') {
      if (deleteModalSub) {
        onDeleteSubscription(deleteModalSub.id);
        setDeleteModalSub(null);
      }
      if (deleteTxId) {
        onDeleteTransaction(deleteTxId);
        setDeleteTxId(null);
      }
    }
  };

  // --- History Edit Logic ---
  const startEditingTx = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setEditTxData({
      amount: tx.amount.toString(),
      date: tx.date.split('T')[0],
      walletId: tx.fromWalletId || '',
      subId: tx.subscriptionId || ''
    });
  };

  const saveEditingTx = () => {
    if (editingTxId) {
      onEditTransaction(editingTxId, {
        amount: parseFloat(editTxData.amount),
        date: new Date(editTxData.date).toISOString(),
        fromWalletId: editTxData.walletId,
        subscriptionId: editTxData.subId ? parseInt(editTxData.subId) : undefined
      });
      setEditingTxId(null);
    }
  };

  // --- Payment Submit ---
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const baseVal = parseFloat(payForm.amount);
    const vatVal = payForm.isTaxable ? parseFloat(payForm.vatAmount) : 0;
    const totalVal = baseVal + vatVal;

    const subIdNum = parseInt(payForm.subscriptionId);
    if (isNaN(subIdNum)) {
      alert("Please select a valid subscription service.");
      return;
    }

    const wallet = state.wallets.find(w => w.id === payForm.walletId);

    // Check for insufficient funds
    if (wallet && wallet.balance < totalVal) {
      alert(`Transaction Failed: Insufficient funds in "${wallet.name}".\n\nAvailable Balance: ${wallet.balance.toLocaleString()} SAR\nRequired Amount: ${totalVal.toLocaleString()} SAR\n\nPlease transfer funds to this card before proceeding.`);
      return;
    }

    onRecordPayment(subIdNum, payForm.walletId, totalVal, payForm.date, payForm.nextRenewalDate, vatVal > 0 ? vatVal : undefined);
    setPayForm({ ...payForm, subscriptionId: '', walletId: '', amount: '', nextRenewalDate: '', isTaxable: false, vatAmount: '' });
    setViewMode('HISTORY');
  };

  const onSelectSubscriptionForPayment = (subIdInput: string | number) => {
    const subId = typeof subIdInput === 'string' ? parseInt(subIdInput) : subIdInput;
    const sub = state.subscriptions.find(s => s.id === subId);
    if (sub) {
      // Auto-calculate next renewal based on cycle
      let nextDate = new Date();
      if (sub.nextRenewalDate) {
        const currentRenewal = new Date(sub.nextRenewalDate);
        nextDate = new Date(currentRenewal);
        if (sub.billingCycle === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1);
        if (sub.billingCycle === 'YEARLY') nextDate.setFullYear(nextDate.getFullYear() + 1);
        if (sub.billingCycle === 'WEEKLY') nextDate.setDate(nextDate.getDate() + 7);
        if (sub.billingCycle === 'DAILY') nextDate.setDate(nextDate.getDate() + 1);
      }

      setPayForm(prev => ({
        ...prev,
        subscriptionId: subId,
        amount: sub.baseAmount.toString(),
        nextRenewalDate: nextDate.toISOString().split('T')[0],
        isTaxable: false,
        vatAmount: ''
      }));
    } else {
      setPayForm(prev => ({ ...prev, subscriptionId: subId, amount: '', nextRenewalDate: '' }));
    }
  };

  // --- Refund Submit ---
  const handleRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRecordRefund(parseInt(refundForm.subscriptionId), refundForm.walletId, parseFloat(refundForm.amount), refundForm.date);
    setRefundForm({ subscriptionId: '', walletId: '', amount: '', date: new Date().toISOString().split('T')[0] });
    setViewMode('HISTORY');
  };


  const getWalletName = (id?: string) => {
    const w = state.wallets.find(w => w.id === id);
    return w ? w.name : 'Unknown Wallet';
  };

  const getSubscriptionName = (id?: number) => {
    const s = state.subscriptions.find(s => s.id === id);
    return s ? s.name : 'Unknown Service';
  };

  const filteredSubs = state.subscriptions.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  let paymentHistory = state.transactions
    .filter(t => t.type === TransactionType.SUBSCRIPTION_PAYMENT || t.type === TransactionType.REFUND)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Apply Date Filters
  if (filterDateStart) {
    paymentHistory = paymentHistory.filter(t => t.date.split('T')[0] >= filterDateStart);
  }
  if (filterDateEnd) {
    paymentHistory = paymentHistory.filter(t => t.date.split('T')[0] <= filterDateEnd);
  }
  // Apply Service Filter
  if (filterServiceId) {
    paymentHistory = paymentHistory.filter(t => t.subscriptionId === filterServiceId);
  }

  // Calculate Total Sum of filtered history
  const filteredTotalPaid = paymentHistory
    .filter(t => t.type === TransactionType.SUBSCRIPTION_PAYMENT)
    .reduce((sum, t) => sum + t.amount, 0);

  const filteredTotalRefund = paymentHistory
    .filter(t => t.type === TransactionType.REFUND)
    .reduce((sum, t) => sum + t.amount, 0);

  const netFilteredTotal = filteredTotalPaid - filteredTotalRefund;


  const getDaysUntilRenewal = (dateStr: string) => {
    const today = new Date();
    const end = new Date(dateStr);
    const diff = end.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const openNoteModal = (title: string, content: string) => {
    setNoteTitle(title);
    setNoteContent(content);
    setShowNoteModal(true);
  };

  // --- Accounting Entry Generation ---
  const generateAccountingEntry = () => {
    const txs = paymentHistory.filter(t => t.type === TransactionType.SUBSCRIPTION_PAYMENT);

    const debitEntries: Record<string, number> = {};
    const creditEntries: { name: string, amount: number, vat?: number }[] = [];
    const missingAccountSubs: string[] = [];
    let totalVat = 0;

    txs.forEach(tx => {
      const sub = state.subscriptions.find(s => s.id === tx.subscriptionId);
      if (!sub) return;

      creditEntries.push({ name: sub.name, amount: tx.amount, vat: tx.vatAmount });

      const vat = tx.vatAmount || 0;
      totalVat += vat;
      const baseAmount = tx.amount - vat; // Base amount goes to expense account

      // --- Use Account Splits for Debit Side ---
      if (!sub.accounts || sub.accounts.length === 0) {
        missingAccountSubs.push(sub.name);
        debitEntries['unallocated'] = (debitEntries['unallocated'] || 0) + baseAmount;
      } else if (sub.accountAllocationType === AllocationType.SINGLE && sub.accounts.length > 0) {
        const accId = sub.accounts[0].accountId;
        debitEntries[accId] = (debitEntries[accId] || 0) + baseAmount;
      } else if (sub.accountAllocationType === AllocationType.EQUAL && sub.accounts.length > 0) {
        const split = baseAmount / sub.accounts.length;
        sub.accounts.forEach(a => {
          debitEntries[a.accountId] = (debitEntries[a.accountId] || 0) + split;
        });
      } else if (sub.accountAllocationType === AllocationType.PERCENTAGE) {
        sub.accounts.forEach(a => {
          const pct = a.percentage || 0;
          const amt = baseAmount * (pct / 100);
          debitEntries[a.accountId] = (debitEntries[a.accountId] || 0) + amt;
        });
      }
    });

    // Add Total VAT entry if positive
    if (totalVat > 0) {
      debitEntries['vat_tax_account'] = totalVat;
    }

    const getAccountName = (accId: string) => {
      if (accId === 'unallocated') return 'Unallocated Expense (No Qoyod Set)';
      if (accId === 'vat_tax_account') return 'ضريبة القيمة المضافة';
      const acc = state.accounts.find(a => a.id === accId);
      return acc ? `${acc.name} ${acc.code ? `(${acc.code})` : ''}` : 'Unknown Account';
    };

    return { debitEntries, creditEntries, getAccountName, missingAccountSubs };
  };

  return (
    <div className="space-y-6 relative">

      {/* Delete Modal */}
      {(deleteModalSub || deleteTxId) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl text-center">
            <div className="flex justify-center text-red-500 mb-4"><AlertTriangle size={48} /></div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Deletion</h3>
            <p className="text-sm text-gray-500 mb-4">
              Type <strong>delete</strong> to confirm this action. This cannot be undone.
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
              <button onClick={() => { setDeleteModalSub(null); setDeleteTxId(null); }} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setShowNoteModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <StickyNote className="text-yellow-500" /> {noteTitle}
            </h3>
            <div className="bg-yellow-50 p-4 rounded-lg text-gray-700 text-sm whitespace-pre-wrap">
              {noteContent}
            </div>
          </div>
        </div>
      )}

      {/* Accounting Entry Modal */}
      {showAccountingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Accounting Entry (قيد يومية)</h3>
              <button onClick={() => setShowAccountingModal(false)}><X size={20} /></button>
            </div>
            <div className="p-8 overflow-y-auto bg-amber-50/30" dir="rtl">
              {(() => {
                const { debitEntries, creditEntries, getAccountName, missingAccountSubs } = generateAccountingEntry();
                return (
                  <div className="font-mono text-right space-y-6 text-gray-800">
                    <div className="text-center font-bold border-b pb-2 mb-4 text-lg">
                      قيد استحقاق الاشتراكات - {filterDateStart || 'فترة محددة'}
                    </div>

                    {missingAccountSubs.length > 0 && (
                      <div className="mb-4 bg-red-100 border border-red-200 text-red-800 p-3 rounded text-sm text-center">
                        Warning: The following services have no Accounting Codes (Qoyod) assigned: <br />
                        {missingAccountSubs.join(', ')}
                      </div>
                    )}

                    {/* Debit Side */}
                    <div className="space-y-2">
                      <div className="font-bold text-gray-500 text-sm mb-1 border-b w-fit">من المذكورين:</div>
                      {Object.entries(debitEntries).map(([accId, amount]) => (
                        <div key={accId} className="flex items-center justify-between gap-8">
                          <span>{amount.toLocaleString()}</span>
                          <span className="font-bold">من حـ/ {getAccountName(accId)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Credit Side */}
                    <div className="space-y-2 pt-4">
                      <div className="font-bold text-gray-500 text-sm mb-1 border-b w-fit">الى المذكورين:</div>
                      {creditEntries.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-8">
                          <span>{entry.amount.toLocaleString()}</span>
                          <span className="font-bold">الى حـ/ مولا {entry.name} {entry.vat ? `(شامل الضريبة ${entry.vat})` : ''}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t-2 border-black mt-6 pt-2 flex justify-between text-sm text-gray-500">
                      <div>Total Debit: {Object.values(debitEntries).reduce((a, b) => a + b, 0).toLocaleString()}</div>
                      <div>Total Credit: {creditEntries.reduce((a, b) => a + b.amount, 0).toLocaleString()}</div>
                    </div>
                  </div>
                )
              })()}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button onClick={() => setShowAccountingModal(false)} className="bg-gray-800 text-white px-4 py-2 rounded">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-4 border-b border-gray-200 pb-1">
        <button
          onClick={() => { setViewMode('LIST'); resetSubForm(); }}
          className={`pb-2 px-4 font-medium text-sm transition-colors ${viewMode === 'LIST' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Active Subscriptions
        </button>
        <button
          onClick={() => { setViewMode('ADD'); resetSubForm(); }}
          className={`pb-2 px-4 font-medium text-sm transition-colors ${viewMode === 'ADD' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2"><Plus size={16} /> {subForm.id ? 'Edit Service' : 'Add New Service'}</div>
        </button>
        <button
          onClick={() => setViewMode('PAY')}
          className={`pb-2 px-4 font-medium text-sm transition-colors ${viewMode === 'PAY' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2"><Receipt size={16} /> Record Payment</div>
        </button>
        <button
          onClick={() => setViewMode('REFUND')}
          className={`pb-2 px-4 font-medium text-sm transition-colors ${viewMode === 'REFUND' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2 text-red-600"><Undo2 size={16} /> Record Refund</div>
        </button>
        <button
          onClick={() => setViewMode('HISTORY')}
          className={`pb-2 px-4 font-medium text-sm transition-colors ${viewMode === 'HISTORY' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2"><History size={16} /> Payment History</div>
        </button>
      </div>

      {/* --- VIEW: ADD / EDIT SUBSCRIPTION --- */}
      {viewMode === 'ADD' && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-100 animation-fade-in max-w-3xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">{subForm.id ? 'Edit Subscription' : 'Define New Subscription Service'}</h3>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Status:</label>
              <select
                value={subForm.status}
                onChange={e => setSubForm({ ...subForm, status: e.target.value as EntityStatus })}
                className={`text-xs font-bold py-1 px-2 rounded border ${subForm.status === EntityStatus.ACTIVE ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
              >
                <option value={EntityStatus.ACTIVE}>ACTIVE</option>
                <option value={EntityStatus.INACTIVE}>INACTIVE</option>
              </select>
            </div>
          </div>

          <form onSubmit={handleAddOrUpdateSubmit} className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
                <input required type="text" className={`w-full border rounded-lg px-3 py-2 ${nameError ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'}`} placeholder="e.g. AWS, Slack"
                  value={subForm.name}
                  onChange={e => {
                    setSubForm({ ...subForm, name: e.target.value });
                    if (nameError) setNameError('');
                  }}
                />
                {nameError && (
                  <div className="flex items-center gap-1 text-red-500 text-xs mt-1 font-medium animate-pulse">
                    <AlertTriangle size={12} />
                    {nameError}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Cost (SAR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500 text-xs pt-0.5">SAR</span>
                  <input required type="number" step="0.01" className="w-full border rounded-lg pl-10 pr-3 py-2"
                    value={subForm.baseAmount} onChange={e => setSubForm({ ...subForm, baseAmount: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Cycle</label>
                <select className="w-full border rounded-lg px-3 py-2 bg-white"
                  value={subForm.billingCycle} onChange={e => setSubForm({ ...subForm, billingCycle: e.target.value as BillingCycle })}
                >
                  <option value={BillingCycle.MONTHLY}>Monthly</option>
                  <option value={BillingCycle.YEARLY}>Yearly</option>
                  <option value={BillingCycle.WEEKLY}>Weekly</option>
                  <option value={BillingCycle.DAILY}>Daily</option>
                  <option value={BillingCycle.OTHER}>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Users</label>
                <input required type="number" className="w-full border rounded-lg px-3 py-2"
                  value={subForm.userCount} onChange={e => setSubForm({ ...subForm, userCount: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm h-20" placeholder="Add details like login info, contact person, or purpose..."
                value={subForm.notes} onChange={e => setSubForm({ ...subForm, notes: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Department Allocation */}
              <div className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
                <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Users size={16} className="text-purple-500" />
                  Department Allocation
                </h4>
                <div className="flex gap-2 mb-3">
                  {Object.values(AllocationType).map(type => (
                    <label key={type} className={`flex items-center gap-1 px-2 py-1.5 rounded border cursor-pointer text-xs ${subForm.allocationType === type ? 'bg-purple-50 border-purple-500 text-purple-700 font-bold' : 'bg-white border-gray-200'}`}>
                      <input type="radio" name="allocType" value={type} checked={subForm.allocationType === type}
                        onChange={() => setSubForm({ ...subForm, allocationType: type, selectedDeptIds: [] })}
                        className="hidden"
                      />
                      <span className="capitalize">{type.toLowerCase()}</span>
                    </label>
                  ))}
                </div>
                <div className="bg-white border border-gray-200 p-3 rounded-lg max-h-40 overflow-y-auto">
                  <p className="text-xs text-gray-500 mb-2">Departments:</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {departments.map(dept => (
                      <button
                        key={dept.id} type="button"
                        onClick={() => handleDeptToggle(dept.id)}
                        className={`px-2 py-1 rounded-full text-xs border transition ${subForm.selectedDeptIds.includes(dept.id) ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                      >
                        {dept.name}
                      </button>
                    ))}
                  </div>
                  {subForm.allocationType === AllocationType.PERCENTAGE && subForm.selectedDeptIds.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {subForm.selectedDeptIds.map(deptId => {
                        const deptName = departments.find(d => d.id === deptId)?.name;
                        return (
                          <div key={deptId} className="flex items-center justify-between text-xs">
                            <span className="truncate w-24">{deptName}</span>
                            <div className="flex items-center gap-1">
                              <input type="number" className="w-12 border rounded px-1 py-0.5"
                                value={subForm.percentages[deptId] || ''}
                                onChange={e => setSubForm({ ...subForm, percentages: { ...subForm.percentages, [deptId]: e.target.value } })}
                              />
                              <span>%</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Account / Qoyod Allocation */}
              <div className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
                <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-indigo-500" />
                  Accounting (Qoyod) Allocation
                </h4>
                <div className="flex gap-2 mb-3">
                  {Object.values(AllocationType).map(type => (
                    <label key={type} className={`flex items-center gap-1 px-2 py-1.5 rounded border cursor-pointer text-xs ${subForm.accountAllocationType === type ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-white border-gray-200'}`}>
                      <input type="radio" name="accAllocType" value={type} checked={subForm.accountAllocationType === type}
                        onChange={() => setSubForm({ ...subForm, accountAllocationType: type, selectedAccountIds: [] })}
                        className="hidden"
                      />
                      <span className="capitalize">{type.toLowerCase()}</span>
                    </label>
                  ))}
                </div>
                <div className="bg-white border border-gray-200 p-3 rounded-lg max-h-40 overflow-y-auto">
                  <p className="text-xs text-gray-500 mb-2">Select Qoyod Account:</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {accounts.map(acc => (
                      <button
                        key={acc.id} type="button"
                        onClick={() => handleAccountToggle(acc.id)}
                        className={`px-2 py-1 rounded-full text-xs border transition ${subForm.selectedAccountIds.includes(acc.id) ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                      >
                        {acc.name}
                      </button>
                    ))}
                    {accounts.length === 0 && <span className="text-xs text-gray-400 italic">No Qoyod accounts defined.</span>}
                  </div>
                  {subForm.accountAllocationType === AllocationType.PERCENTAGE && subForm.selectedAccountIds.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {subForm.selectedAccountIds.map(accId => {
                        const accName = accounts.find(a => a.id === accId)?.name;
                        return (
                          <div key={accId} className="flex items-center justify-between text-xs">
                            <span className="truncate w-24">{accName}</span>
                            <div className="flex items-center gap-1">
                              <input type="number" className="w-12 border rounded px-1 py-0.5"
                                value={subForm.accountPercentages[accId] || ''}
                                onChange={e => setSubForm({ ...subForm, accountPercentages: { ...subForm.accountPercentages, [accId]: e.target.value } })}
                              />
                              <span>%</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input required type="date" className="w-full border rounded-lg px-3 py-2"
                  value={subForm.startDate} onChange={e => setSubForm({ ...subForm, startDate: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Renewal / Payment Due</label>
                <input required type="date" className="w-full border rounded-lg px-3 py-2"
                  value={subForm.renewalDate} onChange={e => setSubForm({ ...subForm, renewalDate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => { setViewMode('LIST'); resetSubForm(); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{subForm.id ? 'Save Changes' : 'Create Service'}</button>
            </div>
          </form>
        </div>
      )}

      {/* --- VIEW: RECORD PAYMENT --- */}
      {viewMode === 'PAY' && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-100 animation-fade-in max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
            <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><Receipt size={24} /></div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Record Subscription Payment</h3>
              <p className="text-sm text-gray-500">Log a transaction for an existing service.</p>
            </div>
          </div>

          <form onSubmit={handlePaymentSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Subscription</label>
              <select required className="w-full border rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                value={payForm.subscriptionId} onChange={e => onSelectSubscriptionForPayment(e.target.value)}
              >
                <option value="">-- Select Service --</option>
                {state.subscriptions.filter(s => s.status === EntityStatus.ACTIVE).map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Est. {s.baseAmount} SAR)</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {payForm.isTaxable ? 'Base Amount (Excl. VAT)' : 'Amount Paid'} (SAR)
                </label>
                <input required type="number" step="0.01" className="w-full border rounded-lg px-3 py-2"
                  value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input required type="date" className="w-full border rounded-lg px-3 py-2"
                  value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })}
                />
              </div>
            </div>

            {/* Tax Toggle */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-700 flex items-center gap-2"><Coins size={16} /> Taxable Invoice (VAT)?</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={payForm.isTaxable} onChange={e => setPayForm({ ...payForm, isTaxable: e.target.checked })} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {payForm.isTaxable && (
                <div className="grid grid-cols-2 gap-4 mt-2 animation-fade-in">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">VAT Amount (15% Default)</label>
                    <input
                      type="number" step="0.01"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                      value={payForm.vatAmount}
                      onChange={e => setPayForm({ ...payForm, vatAmount: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="text-xs text-gray-500">Total Deduction</div>
                    <div className="font-bold text-lg text-gray-800">
                      {((parseFloat(payForm.amount) || 0) + (parseFloat(payForm.vatAmount) || 0)).toLocaleString()} SAR
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Next Renewal Date</label>
              <input required type="date" className="w-full border rounded-lg px-3 py-2"
                value={payForm.nextRenewalDate} onChange={e => setPayForm({ ...payForm, nextRenewalDate: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Updates the service renewal date automatically.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid From (Wallet)</label>
              <select required className="w-full border rounded-lg px-3 py-2 bg-white"
                value={payForm.walletId} onChange={e => setPayForm({ ...payForm, walletId: e.target.value })}
              >
                <option value="">-- Select Employee Card --</option>
                {employeeWallets.map(w => (
                  <option key={w.id} value={w.id}>{w.name} - Bal: {w.balance.toLocaleString()} SAR</option>
                ))}
              </select>
            </div>

            <button type="submit" className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium flex justify-center items-center gap-2">
              Record Transaction <ArrowRight size={18} />
            </button>
          </form>
        </div>
      )}

      {/* --- VIEW: RECORD REFUND --- */}
      {viewMode === 'REFUND' && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-red-100 animation-fade-in max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
            <div className="p-2 bg-red-100 rounded-lg text-red-600"><Undo2 size={24} /></div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Record Refund</h3>
              <p className="text-sm text-gray-500">Refund funds from a service back to an employee wallet.</p>
            </div>
          </div>

          <form onSubmit={handleRefundSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Refund From (Service)</label>
              <select required className="w-full border rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-red-500 outline-none"
                value={refundForm.subscriptionId} onChange={e => setRefundForm({ ...refundForm, subscriptionId: e.target.value })}
              >
                <option value="">-- Select Service --</option>
                {state.subscriptions.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Refund To (Wallet)</label>
              <select required className="w-full border rounded-lg px-3 py-2 bg-white"
                value={refundForm.walletId} onChange={e => setRefundForm({ ...refundForm, walletId: e.target.value })}
              >
                <option value="">-- Select Employee Card --</option>
                {employeeWallets.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (SAR)</label>
                <input required type="number" step="0.01" className="w-full border rounded-lg px-3 py-2"
                  value={refundForm.amount} onChange={e => setRefundForm({ ...refundForm, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input required type="date" className="w-full border rounded-lg px-3 py-2"
                  value={refundForm.date} onChange={e => setRefundForm({ ...refundForm, date: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 font-medium flex justify-center items-center gap-2">
              Process Refund <Undo2 size={18} />
            </button>
          </form>
        </div>
      )}

      {/* --- VIEW: PAYMENT HISTORY --- */}
      {viewMode === 'HISTORY' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animation-fade-in">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between md:items-end gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Subscription Payment Logs</h3>
              <div className="flex flex-wrap gap-2 mt-2 items-center">
                <span className="text-xs text-gray-500">Filter Date:</span>
                <input
                  type="date" className="text-xs border rounded px-2 py-1"
                  value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)}
                />
                <span className="text-xs text-gray-500">to</span>
                <input
                  type="date" className="text-xs border rounded px-2 py-1"
                  value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)}
                />

                <span className="text-xs text-gray-500 ml-2">Service:</span>
                <select
                  className="text-xs border rounded px-2 py-1 max-w-[150px]"
                  value={filterServiceId}
                  onChange={e => setFilterServiceId(e.target.value ? parseInt(e.target.value) : '')}
                >
                  <option value="">All Services</option>
                  {state.subscriptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>

                {(filterDateStart || filterDateEnd || filterServiceId) && (
                  <button onClick={() => { setFilterDateStart(''); setFilterDateEnd(''); setFilterServiceId(''); }} className="text-xs text-red-500 underline">Clear</button>
                )}
              </div>
            </div>

            {/* Total Summary Box for filtered view */}
            {(filterDateStart || filterDateEnd || filterServiceId) && (
              <div className="bg-blue-50 border border-blue-200 rounded px-4 py-2 text-blue-800 text-sm font-medium">
                Filtered Total: {netFilteredTotal.toLocaleString()} SAR
              </div>
            )}

            {/* Accounting Entry Button */}
            {filterDateStart && (
              <button
                onClick={() => setShowAccountingModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
              >
                <FileText size={16} /> تسجيل القيد
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-medium">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Service Name</th>
                  <th className="px-6 py-3">Paid From / Refund To</th>
                  <th className="px-6 py-3 text-right">Amount (SAR)</th>
                  <th className="px-6 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paymentHistory.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No payments recorded in this period.</td></tr>
                ) : (
                  paymentHistory.map(t => {
                    const isEditing = editingTxId === t.id;
                    const isRefund = t.type === TransactionType.REFUND;
                    return (
                      <tr key={t.id} className={`hover:bg-gray-50 ${isRefund ? 'bg-red-50' : ''}`}>
                        <td className="px-6 py-4 text-gray-500">
                          {isEditing ? (
                            <input type="date" value={editTxData.date} onChange={e => setEditTxData({ ...editTxData, date: e.target.value })} className="border rounded px-2 py-1 text-xs" />
                          ) : new Date(t.date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-6 py-4">
                          {isRefund ? (
                            <span className="text-red-600 text-xs font-bold uppercase border border-red-200 bg-red-100 px-2 py-1 rounded">Refund</span>
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-green-600 text-xs font-bold uppercase">Payment</span>
                              {t.vatAmount && t.vatAmount > 0 && <span className="text-[10px] text-gray-400">Inc. VAT {t.vatAmount.toLocaleString()}</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-800">
                          {isEditing ? (
                            <select
                              value={editTxData.subId} onChange={e => setEditTxData({ ...editTxData, subId: e.target.value })}
                              className="border rounded px-2 py-1 text-xs w-full max-w-[150px]"
                            >
                              {state.subscriptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          ) : getSubscriptionName(t.subscriptionId)}
                        </td>

                        <td className="px-6 py-4 text-gray-600">
                          {isEditing ? (
                            <select
                              value={editTxData.walletId} onChange={e => setEditTxData({ ...editTxData, walletId: e.target.value })}
                              className="border rounded px-2 py-1 text-xs w-40"
                            >
                              {employeeWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="bg-purple-100 p-1 rounded text-purple-600"><CreditCard size={14} /></div>
                              {getWalletName(t.fromWalletId || t.toWalletId)} {/* fromWalletId for payment, toWalletId for refund */}
                            </div>
                          )}
                        </td>

                        <td className={`px-6 py-4 text-right font-bold ${isRefund ? 'text-red-600' : 'text-gray-900'}`}>
                          {isEditing ? (
                            <input
                              type="number" className="w-24 border rounded px-2 py-1 text-right"
                              value={editTxData.amount} onChange={e => setEditTxData({ ...editTxData, amount: e.target.value })}
                            />
                          ) : t.amount.toLocaleString()}
                        </td>

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
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- VIEW: LIST --- */}
      {viewMode === 'LIST' && (
        <>
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search active subscriptions..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Service</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Base Cost</th>
                    <th className="px-6 py-4 font-semibold">Cycle</th>
                    <th className="px-6 py-4 font-semibold">Departments</th>
                    <th className="px-6 py-4 font-semibold">Last Payment</th>
                    <th className="px-6 py-4 font-semibold">Next Renewal</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSubs.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">No subscriptions defined.</td></tr>
                  ) : (
                    filteredSubs.map(sub => {
                      const daysLeft = getDaysUntilRenewal(sub.nextRenewalDate);
                      const isUrgent = daysLeft <= 7 && daysLeft >= 0;
                      const isOverdue = daysLeft < 0;

                      return (
                        <tr key={sub.id} className={`hover:bg-gray-50 transition ${sub.status === EntityStatus.INACTIVE ? 'opacity-60' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{sub.name}</span>
                              {sub.notes && (
                                <button
                                  onClick={() => openNoteModal(sub.name, sub.notes || '')}
                                  className="text-yellow-500 hover:text-yellow-600 cursor-pointer transition"
                                  title="View Notes"
                                >
                                  <StickyNote size={14} />
                                </button>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 flex items-center gap-1"><Users size={10} /> {sub.userCount} users</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${sub.status === EntityStatus.ACTIVE ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                              {sub.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-gray-900">{sub.baseAmount.toLocaleString()} SAR</td>
                          <td className="px-6 py-4 text-xs uppercase font-bold tracking-wide text-gray-500">{sub.billingCycle}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {sub.departments.map((split, idx) => {
                                const dept = departments.find(d => d.id === split.departmentId);
                                return (
                                  <span key={idx} className="px-2 py-1 rounded-full text-xs font-medium border" style={{ borderColor: dept?.color, color: dept?.color, backgroundColor: '#ffffff' }}>
                                    {dept?.name} {split.percentage ? `(${split.percentage}%)` : ''}
                                  </span>
                                )
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-500">{sub.lastPaymentDate ? new Date(sub.lastPaymentDate).toLocaleDateString('en-GB') : '-'}</td>
                          <td className="px-6 py-4">
                            <div className={`flex items-center gap-2 ${isUrgent ? 'text-orange-600 font-bold' : isOverdue ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                              {(isUrgent || isOverdue) && sub.status === EntityStatus.ACTIVE && <AlertTriangle size={14} />}
                              {new Date(sub.nextRenewalDate).toLocaleDateString('en-GB')}
                            </div>
                            {isUrgent && sub.status === EntityStatus.ACTIVE && <span className="text-xs text-orange-500">Due soon</span>}
                          </td>
                          <td className="px-6 py-4 text-right flex justify-end items-center gap-3">
                            <button
                              disabled={sub.status === EntityStatus.INACTIVE}
                              onClick={() => {
                                onSelectSubscriptionForPayment(sub.id);
                                setViewMode('PAY');
                              }}
                              className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                              title="Record Payment"
                            >
                              <Receipt size={16} /> PAY
                            </button>
                            <button onClick={() => startEditing(sub)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-full" title="Edit Service">
                              <Edit2 size={18} />
                            </button>
                            <button onClick={() => promptDeleteSub(sub)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full" title="Delete Service">
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
