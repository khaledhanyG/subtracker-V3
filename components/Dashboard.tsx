
import React from 'react';
import { AppState, AllocationType, WalletType, Subscription, TransactionType } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { DollarSign, AlertCircle, Wallet as WalletIcon, Users, CreditCard, FileSpreadsheet, Printer } from 'lucide-react';
import { analyzeSpending } from '../services/geminiService';

interface DashboardProps {
  state: AppState;
}

export const Dashboard: React.FC<DashboardProps> = ({ state }) => {
  const [insight, setInsight] = React.useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = React.useState(false);

  // Calculate Total Monthly Spend (normalized)
  const totalMonthlySpend = state.subscriptions.reduce((acc, sub) => {
    let amount = sub.baseAmount;
    if (sub.billingCycle === 'YEARLY') amount = sub.baseAmount / 12;
    if (sub.billingCycle === 'DAILY') amount = sub.baseAmount * 30;
    if (sub.billingCycle === 'WEEKLY') amount = sub.baseAmount * 4.3;
    return acc + amount;
  }, 0);

  const employeeWallets = state.wallets.filter(w => w.type === WalletType.EMPLOYEE);
  const totalAvailableCash = state.wallets.reduce((acc, w) => acc + w.balance, 0);

  const upcomingRenewals = state.subscriptions.filter(sub => {
    const today = new Date();
    const endDate = new Date(sub.nextRenewalDate);
    // Force Re-deploy (Clear Vercel Cache)
    const isPrint = useMediaQuery('print'); - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 14;
  });

  // Complex Department Spend Calculation taking Splits into account
  const deptSpendMap = new Map<string, number>();

  state.subscriptions.forEach(sub => {
    let monthlyCost = sub.baseAmount;
    if (sub.billingCycle === 'YEARLY') monthlyCost = sub.baseAmount / 12;
    if (sub.billingCycle === 'DAILY') monthlyCost = sub.baseAmount * 30;
    if (sub.billingCycle === 'WEEKLY') monthlyCost = sub.baseAmount * 4.3;

    if (sub.allocationType === AllocationType.SINGLE && sub.departments.length > 0) {
      const deptId = sub.departments[0].departmentId;
      deptSpendMap.set(deptId, (deptSpendMap.get(deptId) || 0) + monthlyCost);
    }
    else if (sub.allocationType === AllocationType.EQUAL && sub.departments.length > 0) {
      const splitAmount = monthlyCost / sub.departments.length;
      sub.departments.forEach(d => {
        deptSpendMap.set(d.departmentId, (deptSpendMap.get(d.departmentId) || 0) + splitAmount);
      });
    }
    else if (sub.allocationType === AllocationType.PERCENTAGE) {
      sub.departments.forEach(d => {
        const percent = d.percentage || 0;
        const amount = monthlyCost * (percent / 100);
        deptSpendMap.set(d.departmentId, (deptSpendMap.get(d.departmentId) || 0) + amount);
      });
    }
  });

  const deptData = state.departments.map(dept => {
    return {
      name: dept.name,
      value: deptSpendMap.get(dept.id) || 0,
      color: dept.color
    };
  }).filter(d => d.value > 0);

  const handleGetInsight = async () => {
    setLoadingInsight(true);
    const result = await analyzeSpending(state.subscriptions, state.departments, state.wallets);
    setInsight(result || "No insights available.");
    setLoadingInsight(false);
  };

  // Group Subscriptions by Department for the Board View
  const getSubscriptionGroups = () => {
    const groups: Record<string, Subscription[]> = {};
    // Initialize for all departments
    state.departments.forEach(d => groups[d.id] = []);
    groups['SHARED'] = [];

    state.subscriptions.forEach(sub => {
      if (sub.departments.length > 1) {
        groups['SHARED'].push(sub);
      } else if (sub.departments.length === 1) {
        const deptId = sub.departments[0].departmentId;
        if (groups[deptId]) {
          groups[deptId].push(sub);
        } else {
          // Fallback if dept deleted
          groups['SHARED'].push(sub);
        }
      } else {
        // No department assigned
        groups['SHARED'].push(sub);
      }
    });

    return groups;
  };

  const subGroups = getSubscriptionGroups();

  // Date Filtering State
  const [startDate, setStartDate] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');

  // Filter Transactions based on Date Range
  const filteredTransactions = React.useMemo(() => {
    return state.transactions.filter(t => {
      if (!startDate && !endDate) return true;
      const txDate = new Date(t.date);
      if (startDate && txDate < new Date(startDate)) return false;
      if (endDate && new Date(endDate).setHours(23, 59, 59, 999) < txDate.getTime()) return false;
      return true;
    });
  }, [state.transactions, startDate, endDate]);

  // Calculate Total Paid Per Department (Real Transaction History)
  const deptTotalPaidMap = new Map<string, number>();

  filteredTransactions.forEach(t => {
    if ((t.type === TransactionType.SUBSCRIPTION_PAYMENT || t.type === TransactionType.REFUND) && t.subscriptionId) {
      const sub = state.subscriptions.find(s => s.id === t.subscriptionId);
      if (!sub) return;

      const amount = t.type === TransactionType.REFUND ? -t.amount : t.amount;

      if (sub.allocationType === AllocationType.SINGLE && sub.departments.length > 0) {
        const deptId = sub.departments[0].departmentId;
        deptTotalPaidMap.set(deptId, (deptTotalPaidMap.get(deptId) || 0) + amount);
      }
      else if (sub.allocationType === AllocationType.EQUAL && sub.departments.length > 0) {
        const splitAmount = amount / sub.departments.length;
        sub.departments.forEach(d => {
          deptTotalPaidMap.set(d.departmentId, (deptTotalPaidMap.get(d.departmentId) || 0) + splitAmount);
        });
      }
      else if (sub.allocationType === AllocationType.PERCENTAGE) {
        sub.departments.forEach(d => {
          const percent = d.percentage || 0;
          const splitAmount = amount * (percent / 100);
          deptTotalPaidMap.set(d.departmentId, (deptTotalPaidMap.get(d.departmentId) || 0) + splitAmount);
        });
      }
    }
  });

  const getSubTotalPaid = (subId: number) => {
    const payments = filteredTransactions.filter(t => t.subscriptionId === subId && t.type === TransactionType.SUBSCRIPTION_PAYMENT).reduce((sum, t) => sum + t.amount, 0);
    const refunds = filteredTransactions.filter(t => t.subscriptionId === subId && t.type === TransactionType.REFUND).reduce((sum, t) => sum + t.amount, 0);
    return payments - refunds;
  };

  const exportToExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Department,Subscription Name,Cost (SAR),Users,Total Paid (SAR)\n";

    state.departments.forEach(dept => {
      const subs = subGroups[dept.id] || [];
      subs.forEach(s => {
        csvContent += `${dept.name},"${s.name}",${s.baseAmount},${s.userCount},${getSubTotalPaid(s.id)}\n`;
      });
    });

    // Shared
    const shared = subGroups['SHARED'] || [];
    shared.forEach(s => {
      csvContent += `SHARED/SPLIT,"${s.name}",${s.baseAmount},${s.userCount},${getSubTotalPaid(s.id)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "department_overview.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPdf = () => {
    window.print();
  };

  const renderCompactCard = (sub: Subscription, isShared = false) => {
    const totalPaid = getSubTotalPaid(sub.id);
    return (
      <div key={sub.id} className="bg-white px-3 py-2 rounded border border-gray-100 hover:shadow-sm transition-shadow flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 truncate font-medium text-sm text-gray-800" title={sub.name}>
          {sub.name}
        </div>

        <div className="flex flex-col items-end">
          <div className="text-[10px] text-gray-400 uppercase tracking-tighter">Total Paid</div>
          <div className="text-xs font-semibold text-gray-600 whitespace-nowrap">
            {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
          <Users size={10} /> {sub.userCount}
        </div>

        {isShared && (
          <div className="flex -space-x-1">
            {sub.departments.map((s, i) => {
              const d = state.departments.find(dept => dept.id === s.departmentId);
              return <div key={i} className="w-2 h-2 rounded-full ring-1 ring-white" style={{ backgroundColor: d?.color || '#ccc' }} title={d?.name}></div>
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-xl shadow-sm border border-gray-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 font-medium text-sm uppercase tracking-wider">Total Available Cash</p>
              <h3 className="text-3xl font-bold mt-1">{totalAvailableCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-lg font-normal text-gray-400">SAR</span></h3>
              <p className="text-xs text-gray-400 mt-2">Across Main Wallet & {employeeWallets.length} Cards</p>
            </div>
            <div className="p-3 bg-gray-700/50 rounded-full text-emerald-400">
              <WalletIcon size={32} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Est. Monthly Spend</p>
              <h3 className="text-2xl font-bold text-gray-800">{totalMonthlySpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-full text-blue-600">
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Renewing Soon (14 Days)</p>
              <h3 className="text-2xl font-bold text-orange-600">{upcomingRenewals.length}</h3>
            </div>
            <div className="p-3 bg-orange-50 rounded-full text-orange-600">
              <AlertCircle size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl border border-gray-200 shadow-sm no-print">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-gray-400 pb-2">
          * Filters "Total Paid" calculations below.
        </div>
        {(startDate || endDate) && (
          <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-xs text-red-500 hover:text-red-700 pb-2 underline">
            Clear Filter
          </button>
        )}
      </div>

      {/* Departmental Subscription Board */}
      <div className="print-section overflow-x-auto pb-4">
        <div className="min-w-max">
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="text-lg font-bold text-gray-800">Departmental Overview</h3>
            <div className="flex gap-2 no-print">
              <button onClick={exportToExcel} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition">
                <FileSpreadsheet size={16} /> Export Excel
              </button>
              <button onClick={exportToPdf} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-50 text-gray-700 border border-gray-200 rounded hover:bg-gray-100 transition">
                <Printer size={16} /> Print / PDF
              </button>
            </div>
          </div>

          <div className="flex gap-4 flex-nowrap">

            {/* Render columns for each department */}
            {state.departments.map(dept => {
              const deptTotal = deptTotalPaidMap.get(dept.id) || 0;
              return (
                <div key={dept.id} className="w-80 flex-shrink-0 bg-gray-50 rounded-xl border border-gray-200 flex flex-col max-h-[600px]">
                  {/* Header */}
                  <div className="p-4 border-b border-gray-200 bg-white rounded-t-xl sticky top-0 z-10" style={{ borderTop: `4px solid ${dept.color}` }}>
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-gray-800">{dept.name}</h4>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{subGroups[dept.id]?.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold">Total Expense</span>
                      <span className="text-sm font-bold text-gray-700">{deptTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</span>
                    </div>
                  </div>
                  {/* Cards */}
                  <div className="p-2 space-y-2 overflow-y-auto">
                    {subGroups[dept.id]?.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-xs italic">No unique subscriptions</div>
                    ) : (
                      subGroups[dept.id].map(sub => renderCompactCard(sub))
                    )}
                  </div>
                </div>
              );
            })}

            {/* Shared Column */}
            <div className="w-80 flex-shrink-0 bg-gray-50 rounded-xl border border-gray-200 flex flex-col max-h-[600px]">
              <div className="p-4 border-b border-gray-200 bg-white rounded-t-xl sticky top-0 z-10 border-t-4 border-gray-600">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-800">Shared / Split</h4>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{subGroups['SHARED']?.length || 0}</span>
                </div>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto">
                {subGroups['SHARED']?.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs italic">No shared subscriptions</div>
                ) : (
                  subGroups['SHARED'].map(sub => renderCompactCard(sub, true))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Charts and AI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Effective Spend by Department</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deptData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {deptData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: number) => `${value.toFixed(2)} SAR`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              ✨ AI Spending Insights
            </h3>
            <button
              onClick={handleGetInsight}
              disabled={loadingInsight}
              className="text-sm bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1 rounded-md hover:opacity-90 disabled:opacity-50 transition"
            >
              {loadingInsight ? 'Analyzing...' : 'Refresh Analysis'}
            </button>
          </div>
          <div className="flex-1 bg-gray-50 rounded-lg p-4 overflow-y-auto text-sm text-gray-700 leading-relaxed border border-gray-200">
            {insight ? (
              <div className="prose prose-sm max-w-none">
                {insight.split('\n').map((line, i) => (
                  <p key={i} className="mb-2">{line}</p>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 italic">
                Click refresh to analyze your data with Gemini AI.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
