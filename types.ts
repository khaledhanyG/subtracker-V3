
export enum WalletType {
  MAIN = 'MAIN',
  EMPLOYEE = 'EMPLOYEE'
}

export enum EntityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE'
}

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  balance: number;
  holderName?: string; // Only for employees
  status: EntityStatus;
}

export interface Department {
  id: string;
  name: string;
  color: string;
}

export interface Account {
  id: string;
  name: string;
  code?: string;
}

export enum AllocationType {
  SINGLE = 'SINGLE',
  EQUAL = 'EQUAL',
  PERCENTAGE = 'PERCENTAGE'
}

export interface DepartmentSplit {
  departmentId: string;
  percentage?: number; // Used if AllocationType is PERCENTAGE
}

export interface AccountSplit {
  accountId: string;
  percentage?: number;
}

export enum BillingCycle {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  DAILY = 'DAILY',
  OTHER = 'OTHER'
}

export interface Subscription {
  id: string;
  name: string;
  baseAmount: number; // Cost in SAR
  billingCycle: BillingCycle;
  userCount: number;
  notes?: string;
  status: EntityStatus;

  // Department Allocation Logic (For Dashboard/Ownership)
  allocationType: AllocationType;
  departments: DepartmentSplit[];

  // Accounting Allocation Logic (For Qoyod/Entries)
  accountAllocationType: AllocationType;
  accounts: AccountSplit[];

  // Payment State
  startDate: string; // ISO Date
  nextRenewalDate: string; // ISO Date
  lastPaymentDate?: string; // ISO Date
  lastPaymentAmount?: number; // To track actual paid amount history on dashboard
}

export enum TransactionType {
  DEPOSIT_FROM_BANK = 'DEPOSIT_FROM_BANK',
  INTERNAL_TRANSFER = 'INTERNAL_TRANSFER', // Main -> Employee
  SUBSCRIPTION_PAYMENT = 'SUBSCRIPTION_PAYMENT',
  REFUND = 'REFUND'
}

export interface Transaction {
  id: number;
  date: string;
  amount: number;
  type: TransactionType;
  fromWalletId?: string;
  toWalletId?: string;
  description: string;
  subscriptionId?: string;
  vatAmount?: number; // Tax amount if applicable
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  amount: number;
  selectedAccountIds: string[]; // For Qoyod Allocation
  customFields?: Record<string, string>; // For dynamic columns
}

export interface InvoiceData {
  id: string;
  fileName: string;
  date: string;
  vendorName: string;
  baseAmount: number;
  vatAmount: number;
  totalAmount: number;
  items: InvoiceLineItem[]; // Extracted line items
  customColumns: string[]; // User added empty columns
}

export interface AppState {
  wallets: Wallet[];
  departments: Department[];
  accounts: Account[];
  subscriptions: Subscription[];
  transactions: Transaction[];
}
