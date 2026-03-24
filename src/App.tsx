import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  LayoutDashboard, 
  ClipboardList, 
  UserCircle, 
  MapPin, 
  Camera, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  LogOut, 
  ChevronRight, 
  BarChart3, 
  Users, 
  Navigation,
  Image as ImageIcon,
  Plus,
  ArrowRight,
  ShieldAlert,
  Menu,
  X,
  Bell,
  Mail,
  Phone,
  Building2,
  Brain,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

// --- Types & Constants ---

type UserRole = 'citizen' | 'admin' | 'officer';

interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  ward?: string;
  avatar?: string;
  department?: string;
  phone?: string;
  activeTasks?: number;
}

type TicketStatus = 'open' | 'assigned' | 'in-progress' | 'pending-approval' | 'resolved' | 'closed' | 'rejected';
type GrievanceCategory = 'waste' | 'water' | 'roads' | 'electricity' | 'sanitation' | 'drainage' | 'parks' | 'traffic' | 'encroachment' | 'health' | 'other';

interface TicketHistory {
  status: TicketStatus;
  timestamp: string;
  message: string;
}

interface Ticket {
  id: string;
  citizenId: string;
  description: string;
  category: GrievanceCategory;
  urgencyScore: number; // 0-100
  status: TicketStatus;
  ward: string;
  location?: { lat: number; lng: number; address?: string };
  photoBefore?: string;
  photoAfter?: string;
  officerId?: string;
  departmentNo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  feedback?: { rating: number; comment: string };
  workerName?: string;
  officerNote?: string;
  isSatisfied?: boolean;
  adminWarning?: string;
  aiReasoning?: string;
  history?: TicketHistory[];
}

const WARDS = ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'];
const OFFICE_EMAIL = "support@ps-crm.gov.in";
const CATEGORIES: { value: GrievanceCategory; label: string; color: string; icon?: string }[] = [
  { value: 'waste', label: 'Waste Management', color: 'bg-orange-100 text-orange-700', icon: '🗑️' },
  { value: 'water', label: 'Water Supply', color: 'bg-blue-100 text-blue-700', icon: '🚰' },
  { value: 'roads', label: 'Roads & Potholes', color: 'bg-slate-100 text-slate-700', icon: '🛣️' },
  { value: 'electricity', label: 'Street Lights/Power', color: 'bg-yellow-100 text-yellow-700', icon: '💡' },
  { value: 'sanitation', label: 'Sanitation', color: 'bg-emerald-100 text-emerald-700', icon: '🧹' },
  { value: 'drainage', label: 'Drainage & Sewage', color: 'bg-cyan-100 text-cyan-700', icon: '🕳️' },
  { value: 'parks', label: 'Parks & Gardens', color: 'bg-green-100 text-green-700', icon: '🌳' },
  { value: 'traffic', label: 'Traffic & Parking', color: 'bg-red-100 text-red-700', icon: '🚦' },
  { value: 'encroachment', label: 'Encroachment', color: 'bg-amber-100 text-amber-700', icon: '🏗️' },
  { value: 'health', label: 'Public Health', color: 'bg-rose-100 text-rose-700', icon: '🏥' },
  { value: 'other', label: 'Other', color: 'bg-purple-100 text-purple-700', icon: '❓' },
];

const STATUS_COLORS: Record<TicketStatus, string> = {
  'open': 'bg-red-100 text-red-700',
  'assigned': 'bg-blue-100 text-blue-700',
  'in-progress': 'bg-indigo-100 text-indigo-700',
  'pending-approval': 'bg-amber-100 text-amber-700',
  'resolved': 'bg-emerald-100 text-emerald-700',
  'closed': 'bg-slate-100 text-slate-700',
  'rejected': 'bg-rose-100 text-rose-700',
};

// --- Mock Email Service ---
const mockEmailService = {
  send: async (to: string, subject: string, body: string) => {
    console.log(`%c[Email Sent] To: ${to}\nSubject: ${subject}\nBody: ${body}`, "color: #002D62; font-weight: bold; background: #E0F2FE; padding: 4px; border-radius: 4px;");
    return new Promise(resolve => setTimeout(resolve, 1000));
  }
};

const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Citizen User', email: 'citizen@example.com', password: 'password123', role: 'citizen', ward: 'Ward 1' },
  { id: 'u2', name: 'System Admin', email: 'admin@example.com', password: 'adminpassword', role: 'admin' },
  { id: 'u3', name: 'Officer John', email: 'john@example.com', password: 'officerpassword', role: 'officer', ward: 'Ward 1', department: 'Roads & Infrastructure', phone: '+91 98765 43210', activeTasks: 0 },
  { id: 'u4', name: 'Officer Mike', email: 'mike@example.com', password: 'officerpassword', role: 'officer', ward: 'Ward 2', department: 'Water & Sanitation', phone: '+91 98765 43211', activeTasks: 0 },
  { id: 'u5', name: 'Officer Lisa', email: 'lisa@example.com', password: 'officerpassword', role: 'officer', ward: 'Ward 3', department: 'Electricity & Lighting', phone: '+91 98765 43212', activeTasks: 0 },
];

const INITIAL_TICKETS: Ticket[] = [
  {
    id: 'T-1001',
    citizenId: 'u1',
    description: 'Large pothole on the main road causing traffic issues.',
    category: 'roads',
    urgencyScore: 85,
    status: 'pending-approval',
    ward: 'Ward 1',
    location: { lat: 19.0760, lng: 72.8777, address: 'Main St, Ward 1' },
    photoBefore: 'https://picsum.photos/seed/pothole/800/600',
    photoAfter: 'https://picsum.photos/seed/fixed/800/600',
    officerId: 'u3',
    officerNote: 'The pothole has been filled and the road surface leveled. Traffic flow is back to normal.',
    departmentNo: 'DEPT-ROADS-123',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    history: [
      { status: 'open', timestamp: new Date(Date.now() - 86400000).toISOString(), message: 'Complaint registered.' },
      { status: 'assigned', timestamp: new Date(Date.now() - 80000000).toISOString(), message: 'Assigned to Officer John.' },
      { status: 'in-progress', timestamp: new Date(Date.now() - 70000000).toISOString(), message: 'Work started.' },
      { status: 'pending-approval', timestamp: new Date(Date.now() - 10000000).toISOString(), message: 'Work completed. Awaiting approval.' }
    ]
  }
];

class SupabaseMock {
  private tickets: Ticket[] = [...INITIAL_TICKETS];
  private users: User[] = [...INITIAL_USERS];

  async getTickets() {
    return [...this.tickets];
  }

  async createTicket(data: Partial<Ticket>) {
    const newTicket: Ticket = {
      id: `T-${Math.floor(1000 + Math.random() * 9000)}`,
      citizenId: data.citizenId || '',
      description: data.description || '',
      category: data.category || 'other',
      urgencyScore: data.urgencyScore || 0,
      status: 'open',
      ward: data.ward || 'Ward 1',
      location: data.location,
      photoBefore: data.photoBefore,
      departmentNo: `DEPT-${(data.category || 'OT').toUpperCase()}-${Math.floor(100 + Math.random() * 899)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{ status: 'open', timestamp: new Date().toISOString(), message: 'Complaint registered by citizen.' }]
    };
    this.tickets.unshift(newTicket);
    return newTicket;
  }

  async updateTicket(id: string, updates: Partial<Ticket>) {
    const index = this.tickets.findIndex(t => t.id === id);
    if (index !== -1) {
      const ticket = this.tickets[index];
      const newHistory = [...(ticket.history || [])];
      
      if (updates.status && updates.status !== ticket.status) {
        let msg = `Status changed to ${updates.status.toUpperCase()}.`;
        if (updates.status === 'assigned') msg = 'Ticket assigned to department officer.';
        if (updates.status === 'in-progress') msg = 'Work started on site.';
        if (updates.status === 'pending-approval') msg = 'Work completed. Awaiting citizen approval.';
        if (updates.status === 'resolved') msg = 'Citizen approved resolution. Ticket closed.';
        if (updates.status === 'rejected') msg = 'Citizen rejected resolution. Sent back for re-work.';
        newHistory.push({ status: updates.status, timestamp: new Date().toISOString(), message: msg });
      }

      this.tickets[index] = { 
        ...ticket, 
        ...updates, 
        updatedAt: new Date().toISOString(),
        history: newHistory
      };
      return this.tickets[index];
    }
    throw new Error('Ticket not found');
  }

  async getOfficers() {
    return this.users.filter(u => u.role === 'officer');
  }

  async login(email: string, password?: string) {
    const user = this.users.find(u => u.email === email);
    if (user && (!user.password || user.password === password)) return user;
    throw new Error('Invalid credentials');
  }

  async signup(name: string, email: string, ward: string, password?: string) {
    if (this.users.find(u => u.email === email)) {
      throw new Error('User already exists');
    }
    const newUser: User = {
      id: `u${this.users.length + 1}`,
      name,
      email,
      password,
      role: 'citizen',
      ward
    };
    this.users.push(newUser);
    return newUser;
  }

  async createOfficer(data: Partial<User>) {
    const newOfficer: User = {
      id: `u${this.users.length + 1}`,
      name: data.name || '',
      email: data.email || '',
      password: data.password || 'officerpassword',
      role: 'officer',
      ward: data.ward || 'Ward 1',
      department: data.department || 'General',
      phone: data.phone || '',
      avatar: data.avatar,
      activeTasks: 0
    };
    this.users.push(newOfficer);
    return newOfficer;
  }

  async updateUser(id: string, updates: Partial<User>) {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.users[index] = { ...this.users[index], ...updates };
      return this.users[index];
    }
    throw new Error('User not found');
  }
}

const supabase = new SupabaseMock();

// --- Utility Functions ---

const classifyGrievance = (text: string): { category: GrievanceCategory; score: number } => {
  const lowerText = text.toLowerCase();
  let category: GrievanceCategory = 'other';
  let score = 30;

  if (lowerText.includes('waste') || lowerText.includes('garbage') || lowerText.includes('trash')) {
    category = 'waste';
    score = 50;
  } else if (lowerText.includes('water') || lowerText.includes('leak') || lowerText.includes('pipe')) {
    category = 'water';
    score = 70;
  } else if (lowerText.includes('road') || lowerText.includes('pothole') || lowerText.includes('street')) {
    category = 'roads';
    score = 60;
  } else if (lowerText.includes('light') || lowerText.includes('electricity') || lowerText.includes('power')) {
    category = 'electricity';
    score = 40;
  } else if (lowerText.includes('drain') || lowerText.includes('sewage') || lowerText.includes('sanitation')) {
    category = 'sanitation';
    score = 80;
  } else if (lowerText.includes('drainage') || lowerText.includes('overflow') || lowerText.includes('gutter')) {
    category = 'drainage';
    score = 75;
  } else if (lowerText.includes('park') || lowerText.includes('tree') || lowerText.includes('garden')) {
    category = 'parks';
    score = 35;
  } else if (lowerText.includes('traffic') || lowerText.includes('parking') || lowerText.includes('signal')) {
    category = 'traffic';
    score = 55;
  } else if (lowerText.includes('encroachment') || lowerText.includes('illegal') || lowerText.includes('shop')) {
    category = 'encroachment';
    score = 65;
  } else if (lowerText.includes('health') || lowerText.includes('hospital') || lowerText.includes('clinic') || lowerText.includes('disease')) {
    category = 'health';
    score = 90;
  }

  if (lowerText.includes('urgent') || lowerText.includes('danger') || lowerText.includes('emergency')) {
    score += 20;
  }

  return { category, score: Math.min(score, 100) };
};

const aiTriageGrievance = async (description: string): Promise<{ category: GrievanceCategory; score: number; reasoning: string }> => {
  if (!description || description.length < 10) {
    const basic = classifyGrievance(description);
    return { ...basic, reasoning: "Description too short for AI triage." };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Triage this citizen grievance: "${description}". 
      Classify it into one of these categories: waste, water, roads, electricity, sanitation, drainage, parks, traffic, encroachment, health, other.
      Assign an urgency score from 0 to 100 based on public safety, environmental impact, and urgency.
      Provide a brief 1-sentence reasoning for your classification.
      Return ONLY a JSON object with "category", "score", and "reasoning" fields.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              enum: ['waste', 'water', 'roads', 'electricity', 'sanitation', 'drainage', 'parks', 'traffic', 'encroachment', 'health', 'other'],
            },
            score: {
              type: Type.INTEGER,
              description: "Urgency score from 0 to 100",
            },
            reasoning: {
              type: Type.STRING,
              description: "Brief 1-sentence reasoning for the triage.",
            },
          },
          required: ["category", "score", "reasoning"],
        },
      },
    });

    const result = JSON.parse(response.text);
    return result;
  } catch (e) {
    console.error("AI Triage failed:", e);
    const fallback = classifyGrievance(description);
    return { ...fallback, reasoning: "AI triage failed, using keyword-based fallback." };
  }
};

const isSLABreached = (ticket: Ticket) => {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return false;
  const created = new Date(ticket.createdAt).getTime();
  const now = Date.now();
  const diffHours = (now - created) / (1000 * 60 * 60);
  return diffHours > 48; // 48 hour SLA
};

const isHighAlert = (ticket: Ticket) => {
  if (ticket.status !== 'open') return false;
  const created = new Date(ticket.createdAt).getTime();
  const now = Date.now();
  const diffHours = (now - created) / (1000 * 60 * 60);
  return ticket.urgencyScore > 70 && diffHours > 4;
};

const getTicketAge = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 0) return 'Just now';
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return '< 1m';
};

// --- Components ---

const Badge = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {children}
  </span>
);

interface CardProps {
  children: React.ReactNode;
  className?: string;
  key?: React.Key;
  onClick?: () => void;
}

const Card = ({ children, className = "", onClick }: CardProps) => (
  <div 
    className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
    onClick={onClick}
  >
    {children}
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md',
  className = "", 
  disabled = false,
  type = 'button'
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => {
  const variants = {
    primary: 'bg-[#002D62] text-white hover:bg-[#003d82]',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    outline: 'border border-slate-200 text-slate-600 hover:bg-slate-50',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-[10px]',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

// --- Views ---

const CATEGORY_TO_DEPT: Record<GrievanceCategory, string> = {
  waste: 'Water & Sanitation',
  water: 'Water & Sanitation',
  roads: 'Roads & Infrastructure',
  electricity: 'Electricity & Lighting',
  sanitation: 'Water & Sanitation',
  drainage: 'Water & Sanitation',
  parks: 'Roads & Infrastructure',
  traffic: 'Roads & Infrastructure',
  encroachment: 'Roads & Infrastructure',
  health: 'Water & Sanitation',
  other: 'Roads & Infrastructure',
};

const LoginView = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [ward, setWard] = useState(WARDS[0]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      alert('Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const user = await supabase.login(email, password);
      onLogin(user);
    } catch (err) {
      alert('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !ward || !password) {
      alert('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const user = await supabase.signup(name, email, ward, password);
      alert('Account created successfully! You can now log in.');
      onLogin(user);
    } catch (err: any) {
      alert(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full p-8 shadow-2xl border-none">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#002D62] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-900/20">
            <ShieldAlert className="text-white w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Government Service Portal</h1>
          <p className="text-slate-500 text-sm">Official Citizen & Officer Dashboard</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl mb-8">
          <button 
            onClick={() => setMode('login')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${mode === 'login' ? 'bg-white text-[#002D62] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Sign In
          </button>
          <button 
            onClick={() => setMode('signup')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${mode === 'signup' ? 'bg-white text-[#002D62] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Register
          </button>
        </div>
        
        <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-5">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <div className="relative">
                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#002D62] transition-all text-sm bg-slate-50"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="email" 
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#002D62] transition-all text-sm bg-slate-50"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <ShieldAlert className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#002D62] transition-all text-sm bg-slate-50"
                required
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Your Ward</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select 
                  value={ward} 
                  onChange={(e) => setWard(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#002D62] transition-all text-sm bg-slate-50 appearance-none"
                  required
                >
                  {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>
          )}
          
          <Button 
            type="submit"
            className="w-full h-12 shadow-lg shadow-blue-900/20 mt-4" 
            disabled={loading}
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In to Dashboard' : 'Create Citizen Account'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <div className="mb-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Office Contact</p>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600 font-medium">
              <Mail size={16} className="text-[#002D62]" />
              <a href={`mailto:${OFFICE_EMAIL}`} className="hover:text-[#002D62] transition-colors">{OFFICE_EMAIL}</a>
            </div>
          </div>
          
          <p className="text-xs text-slate-400 mb-4">Quick access for testing:</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={() => { setEmail('admin@example.com'); setPassword('adminpassword'); setMode('login'); }} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">Admin Demo</button>
            <button onClick={() => { setEmail('john@example.com'); setPassword('officerpassword'); setMode('login'); }} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">Officer Demo</button>
            <button onClick={() => { setEmail('citizen@example.com'); setPassword('password123'); setMode('login'); }} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">Citizen Demo</button>
          </div>
        </div>
      </Card>
    </div>
  );
};

const ProfileTab = ({ user, onNotify }: { user: User; onNotify: (msg: string) => void }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(user.avatar || null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    setUpdating(true);
    try {
      await supabase.updateUser(user.id, { password: newPassword });
      onNotify('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      alert('Failed to update password');
    } finally {
      setUpdating(false);
    }
  };

  const handleAvatarChange = async (newAvatar: string) => {
    setAvatar(newAvatar);
    try {
      await supabase.updateUser(user.id, { avatar: newAvatar });
      onNotify('Profile picture updated');
    } catch (err) {
      alert('Failed to update profile picture');
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('Could not access camera');
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const data = canvas.toDataURL('image/jpeg');
        handleAvatarChange(data);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleAvatarChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center gap-6 p-8 bg-white rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="relative group">
          <div className="w-24 h-24 bg-[#002D62] text-white rounded-full flex items-center justify-center text-4xl font-bold shadow-lg shadow-blue-900/20 overflow-hidden">
            {avatar ? (
              <img src={avatar} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              user.name.charAt(0)
            )}
          </div>
          <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <label className="cursor-pointer p-1.5 bg-white/20 hover:bg-white/40 rounded-full transition-colors">
              <Camera size={16} className="text-white" />
              <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
            </label>
            <button onClick={startCamera} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full transition-colors">
              <Plus size={16} className="text-white" />
            </button>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-1">{user.name}</h2>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-1 uppercase tracking-widest text-[10px] font-bold">
              {user.role.toUpperCase()}
            </Badge>
            {user.ward && (
              <Badge className="bg-slate-50 text-slate-600 border-slate-100 px-3 py-1 uppercase tracking-widest text-[10px] font-bold">
                {user.ward}
              </Badge>
            )}
            {user.department && (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 px-3 py-1 uppercase tracking-widest text-[10px] font-bold">
                {user.department}
              </Badge>
            )}
          </div>
          <p className="text-slate-500 mt-2 flex items-center gap-2 text-sm">
            <Mail size={14} /> {user.email}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {showCamera && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4"
          >
            <div className="relative max-w-md w-full aspect-video bg-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                <button 
                  onClick={capturePhoto}
                  className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <div className="w-10 h-10 border-4 border-slate-200 rounded-full" />
                </button>
                <button 
                  onClick={stopCamera}
                  className="w-14 h-14 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <p className="text-white/60 mt-4 text-sm">Position yourself in the frame and click capture</p>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="p-8">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Lock size={20} className="text-[#002D62]" />
          Security Settings
        </h3>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#002D62] outline-none transition-all"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#002D62] outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#002D62] outline-none transition-all"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full py-3 mt-4" disabled={updating}>
            {updating ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </Card>

      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Account Information</h4>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">User ID</p>
            <p className="text-sm font-mono text-slate-700">{user.id}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Account Created</p>
            <p className="text-sm text-slate-700">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const CitizenView = ({ user, onNotify }: { user: User; onNotify: (msg: string) => void }) => {
  const [description, setDescription] = useState('');
  const [ward, setWard] = useState(user.ward || 'Ward 1');
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | Ticket | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending'>('all');

  const [triage, setTriage] = useState<{ category: GrievanceCategory; score: number; reasoning?: string }>({ category: 'other', score: 30 });
  const [triageLoading, setTriageLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounced AI Triage
  useEffect(() => {
    if (!description || description.length < 10) {
      setTriage(classifyGrievance(description));
      return;
    }

    const timer = setTimeout(async () => {
      setTriageLoading(true);
      const result = await aiTriageGrievance(description);
      setTriage(result);
      setTriageLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [description]);

  const filteredTickets = useMemo(() => 
    tickets.filter(t => filter === 'all' || t.status === 'pending-approval'),
    [tickets, filter]
  );

  useEffect(() => {
    const load = () => {
      supabase.getTickets().then(all => {
        setTickets(all.filter(t => t.citizenId === user.id));
      });
    };
    load();
    const interval = setInterval(load, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [user.id, success]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCaptureLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    } else {
      setLocation({ lat: 19.0760, lng: 72.8777 }); // Mock Mumbai
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description) {
      alert('Please describe the problem');
      return;
    }
    if (!photo) {
      alert('A live photo of the issue is mandatory for verification');
      return;
    }
    
    setSubmitting(true);
    try {
      // Perform final AI triage to ensure we have the most accurate classification
      const finalTriage = await aiTriageGrievance(description);
      
      // 1. Create the ticket
      const ticket = await supabase.createTicket({
        citizenId: user.id,
        description,
        category: finalTriage.category,
        urgencyScore: finalTriage.score,
        aiReasoning: finalTriage.reasoning,
        ward,
        location: location ? { ...location, address: 'Detected Location' } : undefined,
        photoBefore: photo,
      });

      // 2. Auto-assign to an officer in the correct department
      const targetDept = CATEGORY_TO_DEPT[finalTriage.category];
      const allOfficers = await supabase.getOfficers();
      const deptOfficers = allOfficers.filter(o => o.department === targetDept);
      
      // Pick the officer with the fewest active tasks (or just the first one for demo)
      const assignedOfficer = deptOfficers.sort((a, b) => (a.activeTasks || 0) - (b.activeTasks || 0))[0];

      if (assignedOfficer) {
        await supabase.updateTicket(ticket.id, { 
          officerId: assignedOfficer.id, 
          status: 'assigned' 
        });
        onNotify(`Complaint #${ticket.id} automatically assigned to ${assignedOfficer.name} (${targetDept})`);
      } else {
        onNotify(`Complaint #${ticket.id} submitted. Waiting for departmental assignment.`);
      }

      setSuccess(ticket);
      setDescription('');
      setPhoto(null);
      setLocation(null);
    } catch (err) {
      alert('Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string, rating: number, comment: string) => {
    await supabase.updateTicket(id, { 
      status: 'resolved', 
      resolvedAt: new Date().toISOString(),
      feedback: { rating, comment }
    });
    onNotify(`Ticket #${id} has been marked as resolved.`);
    setSuccess('resolved');
    setRating(5);
    setComment('');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleReject = async (id: string) => {
    const ticket = tickets.find(t => t.id === id);
    const newHistory: TicketHistory = {
      status: 'rejected',
      timestamp: new Date().toISOString(),
      message: `Citizen rejected resolution: ${comment || 'No comment provided'}`
    };
    
    await supabase.updateTicket(id, { 
      status: 'rejected',
      history: [...(ticket?.history || []), newHistory]
    });
    
    onNotify(`Ticket #${id} has been rejected and sent back for rework.`);
    setSuccess('rejected');
    setRating(5);
    setComment('');
    setTimeout(() => setSuccess(null), 3000);
  };

  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');

  const [activeTab, setActiveTab] = useState<'report' | 'my-reports' | 'profile'>('report');

  if (activeTab === 'profile') {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">My Account</h1>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setActiveTab('report')} className="px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 transition-all">Dashboard</button>
            <button className="px-4 py-2 rounded-lg text-xs font-bold bg-white shadow-sm text-[#002D62] transition-all">Profile</button>
          </div>
        </div>
        <ProfileTab user={user} onNotify={onNotify} />
      </div>
    );
  }

  if (success && typeof success === 'object') {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-3xl font-bold mb-2">Problem Submitted!</h2>
        <p className="text-slate-500 mb-8">Your report has been successfully registered. Ticket ID: <span className="font-mono font-bold text-slate-900">{success.id}</span>.</p>
        
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <Button onClick={() => setSuccess(null)}>Submit Another Report</Button>
          <p className="text-[10px] text-slate-400 italic">Our department has been notified and will begin working on it shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
      <AnimatePresence>
        {success === 'resolved' && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:col-span-3 bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 text-emerald-700"
          >
            <CheckCircle2 size={20} />
            <span className="font-medium">Thank you! The issue has been marked as resolved.</span>
          </motion.div>
        )}
        {success === 'rejected' && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:col-span-3 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-700"
          >
            <AlertTriangle size={20} />
            <span className="font-medium">Report sent back for further work.</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lg:col-span-3 flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold">Citizen Dashboard</h2>
        <Button variant="outline" onClick={() => setActiveTab('profile')} className="flex items-center gap-2">
          <UserCircle size={16} /> My Profile
        </Button>
      </div>

      <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="p-4 bg-blue-50 border-blue-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Total Reports</p>
            <p className="text-2xl font-bold text-blue-900">{tickets.length}</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
            <ClipboardList size={24} />
          </div>
        </Card>
        <Card className="p-4 bg-emerald-50 border-emerald-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Resolved</p>
            <p className="text-2xl font-bold text-emerald-900">{tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length}</p>
          </div>
          <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
            <CheckCircle2 size={24} />
          </div>
        </Card>
        <Card className="p-4 bg-amber-50 border-amber-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Pending Approval</p>
            <p className="text-2xl font-bold text-amber-900">{tickets.filter(t => t.status === 'pending-approval').length}</p>
          </div>
          <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
            <Clock size={24} />
          </div>
        </Card>
        <Card className={`p-4 flex items-center justify-between ${tickets.filter(t => t.status === 'resolved').length >= 3 ? 'bg-yellow-50 border-yellow-100' : 'bg-slate-50 border-slate-100 opacity-50'}`}>
          <div>
            <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest mb-1">Citizen Status</p>
            <p className="text-sm font-bold text-yellow-900">{tickets.filter(t => t.status === 'resolved').length >= 3 ? 'Community Hero' : 'Active Citizen'}</p>
          </div>
          <div className={`p-3 rounded-xl ${tickets.filter(t => t.status === 'resolved').length >= 3 ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-400'}`}>
            <ShieldAlert size={24} />
          </div>
        </Card>
      </div>

      <div className="lg:col-span-3">
        <h2 className="text-2xl font-bold mb-6">Quick Report: Select Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          {CATEGORIES.filter(c => c.value !== 'other').map(cat => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setDescription(prev => prev ? `${prev}\n[${cat.label}] ` : `[${cat.label}] `)}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#002D62] hover:shadow-md transition-all group"
            >
              <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">{cat.icon}</span>
              <span className="text-xs font-bold text-slate-600 text-center">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <h2 className="text-2xl font-bold">Report a New Issue</h2>
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Describe the Problem</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="E.g., Large pothole near the bus stop..."
                className="w-full h-32 p-4 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#002D62] focus:border-transparent outline-none transition-all"
                required
              />
              {description && (
                <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1">
                  <div className="flex flex-wrap gap-2">
                    <Badge className={`${CATEGORIES.find(c => c.value === triage.category)?.color} border-none shadow-sm`}>
                      {triageLoading ? (
                        <span className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                          AI Analyzing...
                        </span>
                      ) : (
                        `AI Category: ${triage.category.toUpperCase()}`
                      )}
                    </Badge>
                    <Badge className={`${triage.score > 70 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'} border-none shadow-sm`}>
                      {triageLoading ? '...' : `Urgency: ${triage.score}%`}
                    </Badge>
                  </div>
                  {!triageLoading && triage.reasoning && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-800 flex items-start gap-2"
                    >
                      <div className="mt-0.5 p-1 bg-blue-200 rounded-full">
                        <BarChart3 size={10} className="text-blue-700" />
                      </div>
                      <p className="leading-relaxed">
                        <span className="font-bold uppercase tracking-widest text-[9px] block mb-0.5 opacity-60">AI Triage Reasoning</span>
                        {triage.reasoning}
                      </p>
                    </motion.div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Ward/Area</label>
                  <select 
                    value={ward} 
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 outline-none"
                  >
                    {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Location Data</span>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleCaptureLocation}
                      className="text-[10px] h-7 px-2"
                    >
                      <MapPin size={12} className="mr-1" /> {location ? 'Update' : 'Capture'}
                    </Button>
                  </div>
                  {location ? (
                    <div className="text-[10px] text-emerald-600 font-mono flex items-center gap-1">
                      <CheckCircle2 size={10} /> GPS: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">No GPS data captured yet</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Live Photo Evidence</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${photo ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-[#002D62] bg-slate-50'}`}
                >
                  {photo ? (
                    <>
                      <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="text-white" size={32} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Camera className="text-[#002D62]" size={24} />
                      </div>
                      <span className="text-xs font-bold text-slate-500">Tap to Capture Live Photo</span>
                      <span className="text-[10px] text-slate-400 mt-1">Required for verification</span>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  capture="environment"
                  className="hidden" 
                />
              </div>
            </div>

            <Button type="submit" className="w-full py-4 text-lg shadow-lg shadow-blue-900/20" disabled={submitting}>
              {submitting ? "Submitting Report..." : "Submit Official Report"}
            </Button>
          </form>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">My Reports</h2>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${filter === 'all' ? 'bg-white shadow-sm text-[#002D62]' : 'text-slate-400'}`}
            >
              All
            </button>
            <button 
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${filter === 'pending' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-400'}`}
            >
              Pending Review
              {tickets.filter(t => t.status === 'pending-approval').length > 0 && (
                <span className="ml-1.5 w-2 h-2 bg-amber-500 rounded-full inline-block animate-pulse" />
              )}
            </button>
          </div>
        </div>
        <div className="space-y-4">
          {filteredTickets.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No reports found.</p>
          ) : (
            filteredTickets.map(ticket => (
              <Card key={ticket.id} className="p-4">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-slate-400">{ticket.id}</span>
                    <span className="text-[10px] font-mono font-bold text-blue-600">{ticket.departmentNo}</span>
                  </div>
                  <Badge className={STATUS_COLORS[ticket.status]}>{ticket.status.toUpperCase()}</Badge>
                </div>
                <p className="text-sm text-slate-700 line-clamp-2 mb-3">{ticket.description}</p>
                
                {ticket.aiReasoning && (
                  <div className="mb-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-2">
                    <div className="mt-0.5 p-1 bg-blue-100 rounded-full">
                      <Brain size={10} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-blue-500 mb-0.5">AI Triage Context</p>
                      <p className="text-[11px] text-blue-800 leading-relaxed italic">"{ticket.aiReasoning}"</p>
                    </div>
                  </div>
                )}

                {ticket.status === 'rejected' && (
                  <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-100 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-500" />
                    <p className="text-xs text-red-700 font-medium">Re-work requested. Department has been notified.</p>
                  </div>
                )}

                {ticket.status === 'pending-approval' && ticket.photoAfter && (
                  <div className="mb-4 space-y-4">
                    <div className={`${ticket.history?.some(h => h.status === 'rejected') ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'} p-4 rounded-xl flex items-center gap-3 animate-pulse border`}>
                      {ticket.history?.some(h => h.status === 'rejected') ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                      <div>
                        <p className="font-bold text-sm uppercase tracking-wider">
                          {ticket.history?.some(h => h.status === 'rejected') ? 'Work Resubmitted!' : 'Problem Solved!'}
                        </p>
                        <p className="text-xs">
                          {ticket.history?.some(h => h.status === 'rejected') 
                            ? 'The officer has reworked the task and submitted new proof. Please review.' 
                            : 'The officer has submitted proof of resolution. Please review and approve.'}
                        </p>
                      </div>
                    </div>

                    {ticket.history?.some(h => h.status === 'rejected') && (
                      <div className="p-3 bg-red-50 rounded-lg border border-red-100 mb-2">
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">Your Previous Rejection Reason</p>
                        <p className="text-xs text-red-800 italic">
                          "{[...(ticket.history || [])].reverse().find(h => h.status === 'rejected')?.message.replace('Citizen rejected resolution: ', '')}"
                        </p>
                      </div>
                    )}

                    {ticket.officerNote && (
                      <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Officer's Completion Note</p>
                        <p className="text-sm text-slate-700 italic">"{ticket.officerNote}"</p>
                      </div>
                    )}

                    <div className="rounded-lg overflow-hidden border border-emerald-200">
                      <p className="text-[10px] font-bold uppercase bg-emerald-50 p-1 text-emerald-600">Resolution Evidence</p>
                      <img src={ticket.photoAfter} alt="Resolution" className="w-full h-48 object-cover" />
                    </div>
                    
                    <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-sm font-bold text-slate-700">Rate the resolution & provide feedback</p>
                      <div className="flex gap-3">
                        {[1, 2, 3, 4, 5].map(num => (
                          <button 
                            key={num}
                            type="button"
                            onClick={() => setRating(num)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all text-lg ${rating >= num ? 'bg-yellow-400 text-white shadow-md scale-110' : 'bg-slate-50 border border-slate-200 text-slate-300 hover:border-yellow-200'}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <textarea 
                        placeholder="Tell us about your experience with this resolution..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full p-3 text-sm rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#002D62] transition-all"
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button onClick={() => handleApprove(ticket.id, rating, comment)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-12">
                        Approve & Close Ticket
                      </Button>
                      <Button onClick={() => handleReject(ticket.id)} variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 h-12">
                        Reject (Needs Rework)
                      </Button>
                    </div>
                  </div>
                )}

                {ticket.status === 'resolved' && ticket.feedback && (
                  <div className="mb-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase">My Feedback</span>
                      <div className="flex text-yellow-500 text-xs">
                        {'★'.repeat(ticket.feedback.rating)}
                        {'☆'.repeat(5 - ticket.feedback.rating)}
                      </div>
                    </div>
                    {ticket.feedback.comment && <p className="text-xs text-emerald-800 italic">"{ticket.feedback.comment}"</p>}
                  </div>
                )}

                {ticket.history && ticket.history.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resolution Timeline</p>
                    <div className="space-y-3 border-l-2 border-slate-100 ml-2 pl-4 py-1">
                      {ticket.history.map((h, i) => (
                        <div key={i} className="relative">
                          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-200" />
                          <div className="flex justify-between items-start">
                            <p className="text-[10px] font-bold text-slate-700">{h.message}</p>
                            <span className="text-[8px] text-slate-400 font-mono">{new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><Clock size={10} /> {getTicketAge(ticket.createdAt)}</span>
                  <span className="flex items-center gap-1"><MapPin size={10} /> {ticket.ward}</span>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// --- Google Maps API Key Logic ---
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidMapsKey = Boolean(GOOGLE_MAPS_API_KEY) && GOOGLE_MAPS_API_KEY !== '';

const MapsApiKeySplash = () => (
  <div className="flex items-center justify-center h-full bg-slate-50 p-8 rounded-xl border-2 border-dashed border-slate-200">
    <div className="text-center max-w-md">
      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <ShieldAlert className="text-[#002D62]" size={32} />
      </div>
      <h3 className="text-xl font-bold mb-2 text-slate-900">Google Maps API Key Required</h3>
      <p className="text-sm text-slate-500 mb-6">To view the interactive ward map, please add your Google Maps Platform API key to the project secrets.</p>
      <div className="text-left space-y-3 bg-white p-4 rounded-lg border border-slate-200 text-xs">
        <p><strong>Step 1:</strong> <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener" className="text-blue-600 hover:underline">Get an API Key</a></p>
        <p><strong>Step 2:</strong> Add your key as a secret in AI Studio:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-600">
          <li>Open <strong>Settings</strong> (⚙️ gear icon, top-right)</li>
          <li>Select <strong>Secrets</strong></li>
          <li>Name: <code>GOOGLE_MAPS_PLATFORM_KEY</code></li>
          <li>Value: Paste your API key</li>
        </ul>
      </div>
    </div>
  </div>
);

const TicketMarker = ({ ticket }: { ticket: Ticket; key?: string }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoWindowShown, setInfoWindowShown] = useState(false);

  if (!ticket.location) return null;

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: ticket.location.lat, lng: ticket.location.lng }}
        onClick={() => setInfoWindowShown(true)}
      >
        <Pin 
          background={isHighAlert(ticket) ? '#ef4444' : (ticket.urgencyScore > 70 ? '#f97316' : '#3b82f6')} 
          borderColor="#fff" 
          glyphColor="#fff"
        />
      </AdvancedMarker>
      {infoWindowShown && (
        <InfoWindow
          anchor={marker}
          onCloseClick={() => setInfoWindowShown(false)}
        >
          <div className="p-2 max-w-xs">
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono font-bold text-[#002D62]">{ticket.id}</span>
                <span className="text-[9px] font-mono font-bold text-blue-600">{ticket.departmentNo}</span>
                {isHighAlert(ticket) && (
                  <span className="text-[8px] font-bold text-red-600 animate-pulse">● HIGH ALERT</span>
                )}
              </div>
              <Badge className={STATUS_COLORS[ticket.status] + " text-[8px] px-1 py-0"}>{ticket.status.toUpperCase()}</Badge>
            </div>
            <p className="text-xs font-bold mb-1">{CATEGORIES.find(c => c.value === ticket.category)?.label}</p>
            <p className="text-[10px] text-slate-600 line-clamp-2 mb-2">{ticket.description}</p>
            <div className="flex items-center gap-1 text-[9px] text-slate-400">
              <MapPin size={10} /> {ticket.ward}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const WardMap = ({ tickets }: { tickets: Ticket[] }) => {
  if (!hasValidMapsKey) return <MapsApiKeySplash />;

  const activeTickets = tickets.filter(t => t.location && t.status !== 'resolved' && t.status !== 'closed');
  const center = activeTickets.length > 0 
    ? { lat: activeTickets[0].location!.lat, lng: activeTickets[0].location!.lng }
    : { lat: 19.0760, lng: 72.8777 };

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
      <div className="h-full w-full rounded-xl overflow-hidden border border-slate-200">
        <Map
          defaultCenter={center}
          defaultZoom={12}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          gestureHandling={'greedy'}
          disableDefaultUI={false}
        >
          {activeTickets.map(ticket => (
            <TicketMarker key={ticket.id} ticket={ticket} />
          ))}
        </Map>
      </div>
    </APIProvider>
  );
};

const AdminView = ({ user, onNotify }: { user: User; onNotify: (msg: string) => void }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [officers, setOfficers] = useState<User[]>([]);
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('map');
  const [activeSubTab, setActiveSubTab] = useState<'tickets' | 'officers' | 'profile'>('tickets');
  const [sendingMail, setSendingMail] = useState<string | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string | null>(null);
  const [officerSort, setOfficerSort] = useState<'none' | 'resolved-desc' | 'time-asc'>('none');
  const [showAddOfficer, setShowAddOfficer] = useState(false);
  const [newOfficerData, setNewOfficerData] = useState<Partial<User>>({
    name: '',
    email: '',
    ward: 'Ward 1',
    department: 'Roads & Infrastructure',
    phone: '',
    avatar: ''
  });
  const [newOfficerAvatar, setNewOfficerAvatar] = useState<string | null>(null);
  const [showOfficerCamera, setShowOfficerCamera] = useState(false);
  const officerVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const load = async () => {
      const [t, o] = await Promise.all([supabase.getTickets(), supabase.getOfficers()]);
      setTickets(t);
      setOfficers(o);
    };
    load();
    const interval = setInterval(load, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const total = tickets.length;
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    const breaches = tickets.filter(isSLABreached).length;
    const highAlerts = tickets.filter(isHighAlert).length;
    const escalated = tickets.filter(t => (t.status === 'in-progress' && t.urgencyScore > 85) || t.status === 'rejected').length;
    const rejected = tickets.filter(t => t.status === 'rejected').length;
    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    
    // Satisfaction stats
    const feedback = tickets.filter(t => t.feedback);
    const avgRating = feedback.length > 0 ? (feedback.reduce((acc, curr) => acc + curr.feedback!.rating, 0) / feedback.length).toFixed(1) : 'N/A';
    const satisfactionData = [
      { name: 'Happy (4-5)', value: feedback.filter(f => f.feedback!.rating >= 4).length, color: '#10b981' },
      { name: 'Neutral (3)', value: feedback.filter(f => f.feedback!.rating === 3).length, color: '#f59e0b' },
      { name: 'Unhappy (1-2)', value: feedback.filter(f => f.feedback!.rating <= 2).length, color: '#ef4444' },
    ].filter(d => d.value > 0);

    return { total, resolved, breaches, highAlerts, escalated, rejected, rate, avgRating, satisfactionData };
  }, [tickets]);

  const leaderboard = useMemo(() => {
    const deptStats: Record<string, { total: number; resolved: number; totalTime: number }> = {};
    
    tickets.forEach(t => {
      const dept = t.departmentNo?.split('-')[1] || 'OTHER';
      if (!deptStats[dept]) deptStats[dept] = { total: 0, resolved: 0, totalTime: 0 };
      
      deptStats[dept].total++;
      if (t.status === 'resolved' && t.resolvedAt) {
        deptStats[dept].resolved++;
        const time = new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime();
        deptStats[dept].totalTime += time;
      }
    });

    return Object.entries(deptStats)
      .map(([name, s]) => ({
        name,
        avgTime: s.resolved > 0 ? Math.round(s.totalTime / s.resolved / (1000 * 60 * 60)) : Infinity,
        resolved: s.resolved,
        total: s.total
      }))
      .sort((a, b) => a.avgTime - b.avgTime);
  }, [tickets]);

  const filteredTickets = tickets.filter(t => {
    const matchesFilter = filter === 'all' || t.status === filter;
    const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const officerPerformance = useMemo(() => {
    if (!selectedOfficerId) return null;
    const officer = officers.find(o => o.id === selectedOfficerId);
    if (!officer) return null;

    const officerTickets = tickets.filter(t => t.officerId === selectedOfficerId);
    const resolved = officerTickets.filter(t => t.status === 'resolved' || t.status === 'closed');
    
    const totalResolved = resolved.length;
    const totalTime = resolved.reduce((acc, t) => {
      if (t.resolvedAt) {
        return acc + (new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime());
      }
      return acc;
    }, 0);
    
    const avgTime = totalResolved > 0 ? (totalTime / totalResolved / (1000 * 60 * 60)).toFixed(1) : 'N/A';
    
    // Category Breakdown
    const categoryStats: Record<string, { total: number; resolved: number; totalTime: number }> = {};
    officerTickets.forEach(t => {
      if (!categoryStats[t.category]) categoryStats[t.category] = { total: 0, resolved: 0, totalTime: 0 };
      categoryStats[t.category].total++;
      if ((t.status === 'resolved' || t.status === 'closed') && t.resolvedAt) {
        categoryStats[t.category].resolved++;
        categoryStats[t.category].totalTime += (new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime());
      }
    });

    const categoryBreakdown = Object.entries(categoryStats).map(([cat, s]) => ({
      category: cat,
      avgTime: s.resolved > 0 ? (s.totalTime / s.resolved / (1000 * 60 * 60)).toFixed(1) : 'N/A',
      count: s.total
    }));

    const feedbackData = resolved
      .filter(t => t.feedback && t.resolvedAt)
      .map(t => ({
        date: new Date(t.resolvedAt!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        rating: t.feedback!.rating,
        comment: t.feedback!.comment,
        id: t.id,
        timestamp: new Date(t.resolvedAt!).getTime()
      }))
      .sort((a, b) => b.timestamp - a.timestamp); // Newest first for history

    return {
      officer,
      totalResolved,
      avgTime,
      categoryBreakdown,
      feedbackData
    };
  }, [selectedOfficerId, tickets, officers]);

  const sortedOfficers = useMemo(() => {
    if (officerSort === 'none') return officers;

    const officerStats = officers.map(officer => {
      const officerTickets = tickets.filter(t => t.officerId === officer.id);
      const resolved = officerTickets.filter(t => t.status === 'resolved' || t.status === 'closed');
      const totalResolved = resolved.length;
      const totalTime = resolved.reduce((acc, t) => {
        if (t.resolvedAt) {
          return acc + (new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime());
        }
        return acc;
      }, 0);
      const avgTime = totalResolved > 0 ? totalTime / totalResolved : Infinity;
      return { ...officer, totalResolved, avgTime };
    });

    return [...officerStats].sort((a, b) => {
      if (officerSort === 'resolved-desc') {
        return b.totalResolved - a.totalResolved;
      }
      if (officerSort === 'time-asc') {
        return a.avgTime - b.avgTime;
      }
      return 0;
    });
  }, [officers, tickets, officerSort]);

  const handleAssign = async (ticketId: string, officerId: string) => {
    await supabase.updateTicket(ticketId, { officerId, status: 'assigned' });
    const officer = officers.find(o => o.id === officerId);
    const ticket = tickets.find(t => t.id === ticketId);
    
    if (officer && ticket) {
      setSendingMail(ticketId);
      onNotify(`Ticket #${ticketId} assigned to ${officer.name}. Email notification sent.`);
      
      // Send mock email
      mockEmailService.send(
        officer.email,
        `New Task Assigned: ${ticketId}`,
        `Hello ${officer.name},\n\nYou have been assigned a new task: ${ticket.description}\nCategory: ${ticket.category}\nWard: ${ticket.ward}\n\nPlease check your dashboard for details.`
      );
      
      setTimeout(() => setSendingMail(null), 3000);
    }
    
    setTickets(await supabase.getTickets());
  };

  const handleSendWarning = async (ticketId: string, message: string) => {
    await supabase.updateTicket(ticketId, { adminWarning: message });
    onNotify(`Warning sent to department for ticket #${ticketId}.`);
    setTickets(await supabase.getTickets());
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (ticketId: string) => {
    setTickets(prev => prev.filter(t => t.id !== ticketId));
    onNotify(`Ticket #${ticketId} has been deleted.`);
    setDeletingId(null);
  };

  const handleCreateOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const officer = await supabase.createOfficer({
        ...newOfficerData,
        avatar: newOfficerAvatar || undefined
      });
      
      // Auto-assign existing unassigned tickets in the same category/department
      const allTickets = await supabase.getTickets();
      const unassignedTickets = allTickets.filter(t => 
        t.status === 'open' && 
        !t.officerId && 
        CATEGORY_TO_DEPT[t.category] === officer.department
      );

      let assignedCount = 0;
      for (const ticket of unassignedTickets) {
        await supabase.updateTicket(ticket.id, { 
          officerId: officer.id, 
          status: 'assigned' 
        });
        assignedCount++;
      }

      setOfficers(prev => [...prev, officer]);
      setTickets(await supabase.getTickets()); // Refresh tickets
      setShowAddOfficer(false);
      setNewOfficerData({ name: '', email: '', ward: 'Ward 1', department: 'Roads & Infrastructure', phone: '', avatar: '' });
      setNewOfficerAvatar(null);
      
      if (assignedCount > 0) {
        onNotify(`Officer ${officer.name} added and ${assignedCount} pending tickets automatically assigned.`);
      } else {
        onNotify(`Officer ${officer.name} added successfully.`);
      }
    } catch (err) {
      alert('Failed to add officer');
    }
  };

  const startOfficerCamera = async () => {
    setShowOfficerCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (officerVideoRef.current) {
        officerVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('Could not access camera');
      setShowOfficerCamera(false);
    }
  };

  const captureOfficerPhoto = () => {
    if (officerVideoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = officerVideoRef.current.videoWidth;
      canvas.height = officerVideoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(officerVideoRef.current, 0, 0);
        setNewOfficerAvatar(canvas.toDataURL('image/jpeg'));
        stopOfficerCamera();
      }
    }
  };

  const stopOfficerCamera = () => {
    if (officerVideoRef.current && officerVideoRef.current.srcObject) {
      const stream = officerVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowOfficerCamera(false);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Admin Control Center</h1>
          <p className="text-slate-500 text-sm">Oversee all departmental operations and citizen grievances.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveSubTab('tickets')} 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'tickets' ? 'bg-white shadow-sm text-[#002D62]' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Tickets
          </button>
          <button 
            onClick={() => setActiveSubTab('officers')} 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'officers' ? 'bg-white shadow-sm text-[#002D62]' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Officers
          </button>
          <button 
            onClick={() => setActiveSubTab('profile')} 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'profile' ? 'bg-white shadow-sm text-[#002D62]' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Profile
          </button>
        </div>
      </div>

      {activeSubTab === 'profile' ? (
        <ProfileTab user={user} onNotify={onNotify} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4 border-l-4 border-l-[#002D62] bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Fleet</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-mono font-bold text-[#002D62]">{stats.total}</h3>
            <span className="text-[10px] text-slate-400">Tickets</span>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-red-500 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">SLA Breaches</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-mono font-bold text-red-600">{stats.breaches}</h3>
            <span className="text-[10px] text-red-400">Critical</span>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-orange-500 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Escalated</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-mono font-bold text-orange-600">{stats.escalated}</h3>
            <span className="text-[10px] text-orange-400">Action Req.</span>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-emerald-500 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Resolved</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-mono font-bold text-emerald-600">{stats.resolved}</h3>
            <span className="text-[10px] text-emerald-400">Completed</span>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Efficiency</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-mono font-bold text-blue-600">{stats.rate}%</h3>
            <span className="text-[10px] text-blue-400">Success</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <BarChart3 size={20} className="text-[#002D62]" />
              Departmental Performance (Resolved vs Total)
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leaderboard}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="total" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Total Tickets" />
                  <Bar dataKey="resolved" fill="#002D62" radius={[4, 4, 0, 0]} name="Resolved" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Users size={20} className="text-[#002D62]" />
              Citizen Satisfaction ({stats.avgRating} / 5.0)
            </h3>
            <div className="h-[250px] w-full flex items-center justify-center">
              {stats.satisfactionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.satisfactionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.satisfactionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-slate-400 text-sm italic">Insufficient feedback data</div>
              )}
            </div>
            <div className="flex justify-center gap-4 mt-4">
              {stats.satisfactionData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{d.name}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="flex border-b border-slate-200 bg-white rounded-t-xl overflow-hidden">
        <button 
          onClick={() => setActiveSubTab('tickets')}
          className={`px-8 py-4 text-xs font-bold uppercase tracking-widest transition-all relative ${activeSubTab === 'tickets' ? 'text-[#002D62] bg-slate-50' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Operations Center
          {activeSubTab === 'tickets' && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#002D62]" />}
        </button>
        <button 
          onClick={() => setActiveSubTab('officers')}
          className={`px-8 py-4 text-xs font-bold uppercase tracking-widest transition-all relative ${activeSubTab === 'officers' ? 'text-[#002D62] bg-slate-50' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Personnel Directory
          {activeSubTab === 'officers' && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#002D62]" />}
        </button>
      </div>

      {activeSubTab === 'tickets' && (
        <div className="space-y-8">
          {/* Critical Escalations Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="text-orange-500" size={20} />
              <h4 className="text-sm font-bold uppercase tracking-widest text-slate-700">Critical Escalations & Rejections</h4>
              <Badge className="bg-orange-100 text-orange-700 ml-2">{stats.escalated}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tickets.filter(t => (t.status === 'in-progress' && t.urgencyScore > 85) || t.status === 'rejected').map(ticket => (
                <Card key={ticket.id} className={`p-4 border-l-4 ${ticket.status === 'rejected' ? 'border-l-red-500 bg-red-50/30' : 'border-l-orange-500 bg-orange-50/30'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-mono font-bold ${ticket.status === 'rejected' ? 'text-red-700' : 'text-orange-700'}`}>{ticket.id}</span>
                    <Badge className={ticket.status === 'rejected' ? 'bg-red-200 text-red-800 text-[10px]' : 'bg-orange-200 text-orange-800 text-[10px]'}>
                      {ticket.status === 'rejected' ? 'Citizen Rejected' : 'High Urgency'}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-slate-800 line-clamp-2 mb-3">{ticket.description}</p>
                  
                  {ticket.status === 'rejected' && (
                    <div className="mb-3 p-2 bg-white/50 rounded border border-red-100 text-[10px] text-red-600 italic">
                      "Citizen was not satisfied with the resolution proof."
                    </div>
                  )}

                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                        {officers.find(o => o.id === ticket.officerId)?.name.charAt(0)}
                      </div>
                      <span className="text-[10px] text-slate-500">{officers.find(o => o.id === ticket.officerId)?.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-orange-600 font-bold">{ticket.urgencyScore}% Urgency</span>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-[10px] h-8 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => handleSendWarning(ticket.id, "Immediate action required: Citizen rejected resolution proof.")}
                    >
                      <AlertTriangle size={12} className="mr-1" /> Send Warning
                    </Button>
                  </div>
                </Card>
              ))}
              {stats.escalated === 0 && (
                <div className="col-span-full py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-slate-400 text-sm italic">No critical escalations at this time.</p>
                </div>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold">Operations Center</h2>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                      onClick={() => setViewMode('table')}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-[#002D62]' : 'text-slate-500'}`}
                    >
                      Table
                    </button>
                    <button 
                      onClick={() => setViewMode('map')}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-[#002D62]' : 'text-slate-500'}`}
                    >
                      Map
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search tickets..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#002D62]"
                    />
                  </div>
                  <select 
                    value={filter} 
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="p-2 rounded-lg border border-slate-200 outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="open">Open</option>
                    <option value="assigned">Assigned</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              {viewMode === 'table' ? (
                <Card className="overflow-x-auto border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID / Dept</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Photos</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Urgency</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTickets.map(ticket => (
                        <tr key={ticket.id} className={`hover:bg-slate-50 transition-colors group ${isSLABreached(ticket) ? 'bg-red-50/30' : ''}`}>
                          <td className="p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-[10px] font-bold text-slate-600">{ticket.id}</span>
                              <span className="font-mono text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                {ticket.departmentNo}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-800 line-clamp-1 max-w-xs">{ticket.description}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400">{ticket.ward}</span>
                              {ticket.aiReasoning && (
                                <div className="relative group">
                                  <div className="p-1 bg-blue-50 rounded text-blue-600 cursor-help">
                                    <Brain size={10} />
                                  </div>
                                  <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-white border border-slate-200 shadow-xl rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">AI Triage Reasoning</p>
                                      <p className="text-[11px] text-slate-600 leading-relaxed italic">"{ticket.aiReasoning}"</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-1">
                              {ticket.photoBefore && (
                                <button 
                                  onClick={() => setSelectedPhoto(ticket.photoBefore!)}
                                  className="w-8 h-8 rounded border border-slate-200 overflow-hidden hover:ring-2 hover:ring-[#002D62] transition-all"
                                >
                                  <img src={ticket.photoBefore} alt="Before" className="w-full h-full object-cover" />
                                </button>
                              )}
                              {ticket.photoAfter && (
                                <button 
                                  onClick={() => setSelectedPhoto(ticket.photoAfter!)}
                                  className="w-8 h-8 rounded border border-emerald-200 overflow-hidden hover:ring-2 hover:ring-emerald-500 transition-all"
                                >
                                  <img src={ticket.photoAfter} alt="After" className="w-full h-full object-cover" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge className={`${CATEGORIES.find(c => c.value === ticket.category)?.color} text-[10px]`}>
                              {ticket.category.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Badge className={`${STATUS_COLORS[ticket.status]} text-[10px]`}>{ticket.status.toUpperCase()}</Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${ticket.urgencyScore > 70 ? 'bg-red-500' : 'bg-blue-500'}`} 
                                  style={{ width: `${ticket.urgencyScore}%` }} 
                                />
                              </div>
                              <span className="text-[10px] font-mono font-bold text-slate-500">{ticket.urgencyScore}%</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {ticket.officerId ? (
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                                  <UserCircle size={14} />
                                  <span className="max-w-[80px] truncate">{officers.find(o => o.id === ticket.officerId)?.name}</span>
                                </div>
                              ) : (
                                <select 
                                  onChange={(e) => handleAssign(ticket.id, e.target.value)}
                                  className="text-[10px] p-1 rounded border border-slate-200 outline-none bg-white"
                                  defaultValue=""
                                >
                                  <option value="" disabled>Assign</option>
                                  {officers.map(o => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                  ))}
                                </select>
                              )}
                              <button 
                                onClick={() => setDeletingId(ticket.id)}
                                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              ) : (
                <Card className="h-[600px] relative overflow-hidden border-slate-200">
                  <WardMap tickets={filteredTickets} />
                </Card>
              )}
            </div>
            
            <div className="space-y-6">
              <h3 className="text-xl font-bold">Dept Leaderboard</h3>
              <Card className="p-4">
                <div className="space-y-4">
                  {leaderboard.map((dept, i) => (
                    <div key={dept.name} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-600'}`}>
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-700">{dept.name}</p>
                          <p className="text-[10px] text-slate-500">{dept.resolved}/{dept.total} Resolved</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#002D62]">{dept.avgTime === Infinity ? 'N/A' : `${dept.avgTime}h`}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Avg Time</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <h3 className="text-xl font-bold mt-8">Citizen Feedback</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {tickets.filter(t => t.feedback).map(t => (
                  <Card key={t.id} className="p-4 bg-white border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex text-yellow-500 text-[10px]">
                        {'★'.repeat(t.feedback!.rating)}
                        {'☆'.repeat(5 - t.feedback!.rating)}
                      </div>
                      <span className="text-[9px] font-mono text-slate-400">{t.id}</span>
                    </div>
                    <p className="text-xs text-slate-600 italic mb-2">"{t.feedback!.comment || 'No comment provided'}"</p>
                    <div className="flex items-center justify-between border-t border-slate-50 pt-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{t.category}</span>
                      <span className="text-[9px] text-slate-400">{new Date(t.resolvedAt!).toLocaleDateString()}</span>
                    </div>
                  </Card>
                ))}
                {tickets.filter(t => t.feedback).length === 0 && (
                  <p className="text-center py-8 text-slate-400 text-sm italic">No feedback received yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )}

      <AnimatePresence>
        {showAddOfficer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-xl font-bold text-slate-900">Add New Officer</h3>
                <button onClick={() => setShowAddOfficer(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateOfficer} className="p-6 space-y-4">
                <div className="flex justify-center mb-6">
                  <div className="relative group">
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-3xl font-bold text-slate-400 overflow-hidden border-4 border-white shadow-md">
                      {newOfficerAvatar ? (
                        <img src={newOfficerAvatar} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserCircle size={48} />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <label className="cursor-pointer p-1.5 bg-white/20 hover:bg-white/40 rounded-full transition-colors">
                        <Camera size={16} className="text-white" />
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setNewOfficerAvatar(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }} 
                        />
                      </label>
                      <button type="button" onClick={startOfficerCamera} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full transition-colors">
                        <Plus size={16} className="text-white" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      value={newOfficerData.name}
                      onChange={(e) => setNewOfficerData({ ...newOfficerData, name: e.target.value })}
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#002D62]"
                      placeholder="e.g. Officer Sarah"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                    <input 
                      type="email" 
                      required
                      value={newOfficerData.email}
                      onChange={(e) => setNewOfficerData({ ...newOfficerData, email: e.target.value })}
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#002D62]"
                      placeholder="sarah@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                    <input 
                      type="tel" 
                      required
                      value={newOfficerData.phone}
                      onChange={(e) => setNewOfficerData({ ...newOfficerData, phone: e.target.value })}
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#002D62]"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ward</label>
                    <select 
                      value={newOfficerData.ward}
                      onChange={(e) => setNewOfficerData({ ...newOfficerData, ward: e.target.value })}
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#002D62]"
                    >
                      {['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'].map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Department</label>
                    <select 
                      value={newOfficerData.department}
                      onChange={(e) => setNewOfficerData({ ...newOfficerData, department: e.target.value })}
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#002D62]"
                    >
                      {['Roads & Infrastructure', 'Water & Sanitation', 'Electricity & Lighting', 'Public Health', 'Traffic Management'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddOfficer(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1">Create Officer</Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showOfficerCamera && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4"
          >
            <div className="relative max-w-md w-full aspect-video bg-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <video ref={officerVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                <button 
                  type="button"
                  onClick={captureOfficerPhoto}
                  className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <div className="w-10 h-10 border-4 border-slate-200 rounded-full" />
                </button>
                <button 
                  type="button"
                  onClick={stopOfficerCamera}
                  className="w-14 h-14 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {selectedPhoto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white transition-all z-10"
              >
                <X size={24} />
              </button>
              <img src={selectedPhoto} alt="Full view" className="w-full h-auto max-h-[80vh] object-contain" />
              <div className="p-4 bg-white flex justify-center">
                <Button onClick={() => setSelectedPhoto(null)}>Close Preview</Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {officerPerformance && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setSelectedOfficerId(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative max-w-2xl w-full bg-slate-50 rounded-3xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-[#002D62] p-8 text-white">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-2xl font-bold backdrop-blur-md overflow-hidden">
                      {officerPerformance.officer.avatar ? (
                        <img src={officerPerformance.officer.avatar} alt={officerPerformance.officer.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        officerPerformance.officer.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">{officerPerformance.officer.name}</h3>
                      <p className="text-blue-200 text-sm">{officerPerformance.officer.department}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedOfficerId(null)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                    <p className="text-[10px] uppercase font-bold text-blue-200 mb-1">Resolved</p>
                    <p className="text-2xl font-mono font-bold">{officerPerformance.totalResolved}</p>
                  </div>
                  <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                    <p className="text-[10px] uppercase font-bold text-blue-200 mb-1">Avg Time</p>
                    <p className="text-2xl font-mono font-bold">{officerPerformance.avgTime}h</p>
                  </div>
                  <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                    <p className="text-[10px] uppercase font-bold text-blue-200 mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-sm font-bold">Active</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Performance Trend (Feedback)</h4>
                    <div className="h-[200px] w-full">
                      {officerPerformance.feedbackData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={officerPerformance.feedbackData}>
                            <defs>
                              <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#002D62" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#002D62" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis 
                              dataKey="date" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: '#94a3b8' }}
                            />
                            <YAxis 
                              domain={[0, 5]} 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: '#94a3b8' }}
                            />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="rating" 
                              stroke="#002D62" 
                              strokeWidth={3}
                              fillOpacity={1} 
                              fill="url(#colorRating)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center bg-slate-100 rounded-2xl border border-dashed border-slate-200">
                          <p className="text-slate-400 text-sm italic">No feedback data available yet</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Category Breakdown</h4>
                    <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                      {officerPerformance.categoryBreakdown.length > 0 ? (
                        officerPerformance.categoryBreakdown.map(item => (
                          <div key={item.category} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{CATEGORIES.find(c => c.value === item.category)?.icon || '📁'}</span>
                              <div>
                                <p className="text-xs font-bold text-slate-700 capitalize">{item.category}</p>
                                <p className="text-[10px] text-slate-400">{item.count} total tickets</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-[#002D62]">{item.avgTime}h</p>
                              <p className="text-[9px] text-slate-400 uppercase font-bold">Avg Time</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center py-8 text-slate-400 text-sm italic">No category data yet</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Recent Feedback History</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[200px] overflow-y-auto pr-2">
                    {officerPerformance.feedbackData.map(fb => (
                      <div key={fb.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex text-yellow-500 text-[10px]">
                            {'★'.repeat(fb.rating)}
                            {'☆'.repeat(5 - fb.rating)}
                          </div>
                          <span className="text-[9px] font-mono text-slate-400">{fb.date}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 italic line-clamp-2">"{fb.comment || 'No comment provided'}"</p>
                        <p className="text-[9px] text-slate-400 mt-2 font-mono">Ticket: {fb.id}</p>
                      </div>
                    ))}
                    {officerPerformance.feedbackData.length === 0 && (
                      <div className="col-span-2 py-8 text-center bg-slate-100 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-400 text-sm italic">No feedback history yet</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button className="flex-1 bg-[#002D62] hover:bg-blue-900 h-12 rounded-xl">Generate Full Report</Button>
                  <Button variant="outline" className="flex-1 h-12 rounded-xl border-slate-200" onClick={() => setSelectedOfficerId(null)}>Close View</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {activeSubTab === 'officers' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold">Officer Directory</h2>
              <p className="text-sm text-slate-500">Manage and monitor personnel performance</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                <Filter size={14} className="text-slate-400" />
                <select 
                  className="text-xs font-bold text-slate-600 outline-none bg-transparent"
                  value={officerSort}
                  onChange={(e) => setOfficerSort(e.target.value as any)}
                >
                  <option value="none">Sort By: Default</option>
                  <option value="resolved-desc">Resolved Tickets (High to Low)</option>
                  <option value="time-asc">Resolution Time (Fastest First)</option>
                </select>
              </div>
              <Button 
                onClick={() => setShowAddOfficer(true)}
                className="flex items-center gap-2 bg-[#002D62] hover:bg-blue-900 shadow-lg shadow-blue-900/20 px-6"
              >
                <Plus size={18} /> Add New Officer
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sortedOfficers.map(officer => (
              <Card key={officer.id} className="p-6 hover:shadow-lg transition-all border-slate-100 group">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-[#002D62] font-bold text-lg overflow-hidden">
                    {officer.avatar ? (
                      <img src={officer.avatar} alt={officer.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      officer.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{officer.name}</h3>
                    <p className="text-xs text-slate-500">{officer.department}</p>
                  </div>
                </div>
                <div className="flex gap-2 mb-4">
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px]">
                    {tickets.filter(t => t.officerId === officer.id && (t.status === 'resolved' || t.status === 'closed')).length} Resolved
                  </Badge>
                  {(() => {
                    const resolved = tickets.filter(t => t.officerId === officer.id && (t.status === 'resolved' || t.status === 'closed'));
                    if (resolved.length > 0) {
                      const totalTime = resolved.reduce((acc, t) => t.resolvedAt ? acc + (new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) : acc, 0);
                      const avg = Math.round(totalTime / resolved.length / (1000 * 60 * 60));
                      const feedback = resolved.filter(t => t.feedback);
                      const avgRating = feedback.length > 0 ? (feedback.reduce((acc, curr) => acc + curr.feedback!.rating, 0) / feedback.length).toFixed(1) : 'N/A';
                      return (
                        <>
                          <Badge className="bg-blue-50 text-blue-700 border-blue-100 text-[10px]">
                            {avg}h Avg
                          </Badge>
                          <Badge className="bg-yellow-50 text-yellow-700 border-yellow-100 text-[10px]">
                            ★ {avgRating}
                          </Badge>
                        </>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail size={14} className="text-slate-400" /> {officer.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone size={14} className="text-slate-400" /> {officer.phone || 'N/A'}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Navigation size={14} className="text-slate-400" /> {officer.ward}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock size={14} className="text-slate-400" /> {officer.activeTasks} Active Tasks
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 text-xs py-1.5"
                    onClick={() => setSelectedOfficerId(officer.id)}
                  >
                    View Performance
                  </Button>
                  <Button variant="secondary" className="flex-1 text-xs py-1.5">Contact</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const OfficerView = ({ user, onNotify }: { user: User; onNotify: (msg: string) => void }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [completionPhotos, setCompletionPhotos] = useState<Record<string, string>>({});
  const [workerNames, setWorkerNames] = useState<Record<string, string>>({});
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'profile'>('tasks');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const load = () => {
      supabase.getTickets().then(all => {
        const myTickets = all.filter(t => t.officerId === user.id);
        const newTasks = myTickets.filter(t => t.status === 'assigned');
        if (newTasks.length > 0 && tickets.length === 0) {
          onNotify(`You have ${newTasks.length} new task(s) assigned. Check your registered email for details.`);
        }
        setTickets(myTickets);
        setLoading(false);
      });
    };
    load();
    const interval = setInterval(load, 10000); // Poll every 10s
    
    // Track location
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition((pos) => {
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
      return () => {
        clearInterval(interval);
        navigator.geolocation.clearWatch(watchId);
      };
    }
    
    return () => clearInterval(interval);
  }, [user.id]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2 - lat1) * Math.PI/180;
    const Δλ = (lon2 - lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleUpdateStatus = async (id: string, status: TicketStatus) => {
    const workerName = workerNames[id];
    if (status === 'in-progress' && !workerName) {
      alert('Please assign a worker to start the job.');
      return;
    }
    await supabase.updateTicket(id, { status, workerName });
    setTickets(await supabase.getTickets().then(all => all.filter(t => t.officerId === user.id)));
  };

  const handleFileChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompletionPhotos(prev => ({ ...prev, [id]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async (id: string) => {
    const photo = completionPhotos[id];
    if (!photo) {
      alert('Please capture a completion photo first.');
      return;
    }

    const ticket = tickets.find(t => t.id === id);
    if (ticket?.location) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const R = 6371e3; // metres
          const φ1 = pos.coords.latitude * Math.PI/180;
          const φ2 = ticket.location!.lat * Math.PI/180;
          const Δφ = (ticket.location!.lat - pos.coords.latitude) * Math.PI/180;
          const Δλ = (ticket.location!.lng - pos.coords.longitude) * Math.PI/180;

          const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ/2) * Math.sin(Δλ/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;

          if (distance > 50) {
            alert(`Geofence Error: You are ${Math.round(distance)}m away from the site. You must be within 50m to complete the task.`);
            return;
          }

          const newHistory: TicketHistory = {
            status: 'pending-approval',
            timestamp: new Date().toISOString(),
            message: ticket?.status === 'rejected' ? 'Officer resubmitted work after rework' : 'Officer submitted work for approval'
          };

          await supabase.updateTicket(id, { 
            status: 'pending-approval', 
            photoAfter: photo,
            officerNote: completionNotes[id],
            history: [...(ticket?.history || []), newHistory]
          });
          onNotify(`Job for ticket #${id} completed and sent for approval.`);
          setTickets(await supabase.getTickets().then(all => all.filter(t => t.officerId === user.id)));
        }, (err) => {
          alert('Unable to verify location. Please enable GPS.');
        });
        return;
      }
    }

    const newHistory: TicketHistory = {
      status: 'pending-approval',
      timestamp: new Date().toISOString(),
      message: ticket?.status === 'rejected' ? 'Officer resubmitted work after rework' : 'Officer submitted work for approval'
    };

    // Fallback if no location or geolocation not supported
    await supabase.updateTicket(id, { 
      status: 'pending-approval', 
      photoAfter: photo,
      officerNote: completionNotes[id],
      history: [...(ticket?.history || []), newHistory]
    });
    onNotify(`Job for ticket #${id} completed and sent for approval.`);
    setTickets(await supabase.getTickets().then(all => all.filter(t => t.officerId === user.id)));
  };

  if (activeTab === 'profile') {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Officer Profile</h1>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setActiveTab('tasks')} className="px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 transition-all">Tasks</button>
            <button className="px-4 py-2 rounded-lg text-xs font-bold bg-white shadow-sm text-[#002D62] transition-all">Profile</button>
          </div>
        </div>
        <ProfileTab user={user} onNotify={onNotify} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Officer Dashboard</h2>
          <p className="text-sm text-slate-500">Welcome back, <span className="font-bold text-[#002D62]">{user.name}</span></p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('tasks')} 
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'tasks' ? 'bg-white shadow-sm text-[#002D62]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Tasks
            </button>
            <button 
              onClick={() => setActiveTab('profile')} 
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'profile' ? 'bg-white shadow-sm text-[#002D62]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Profile
            </button>
          </div>
          <div className="text-right">
            <Badge className="bg-blue-50 text-blue-700 border-blue-100 mb-1">{user.department}</Badge>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Official ID: {user.id}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-blue-50 border-blue-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Assigned</p>
            <p className="text-2xl font-bold text-blue-900">{tickets.filter(t => t.status === 'assigned').length}</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
            <ClipboardList size={24} />
          </div>
        </Card>
        <Card className="p-4 bg-indigo-50 border-indigo-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">In Progress</p>
            <p className="text-2xl font-bold text-indigo-900">{tickets.filter(t => t.status === 'in-progress' || t.status === 'rejected').length}</p>
          </div>
          <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
            <Clock size={24} />
          </div>
        </Card>
        <Card className="p-4 bg-amber-50 border-amber-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Pending Approval</p>
            <p className="text-2xl font-bold text-amber-900">{tickets.filter(t => t.status === 'pending-approval').length}</p>
          </div>
          <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
            <CheckCircle2 size={24} />
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        {tickets.some(t => t.status === 'assigned') && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3 text-blue-700">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail size={20} />
              </div>
              <div>
                <p className="text-sm font-bold">New Work Assigned!</p>
                <p className="text-xs">You have new tasks waiting. Check your registered email ({user.email}) for official details.</p>
              </div>
            </div>
            <Badge className="bg-blue-600 text-white border-none">
              {tickets.filter(t => t.status === 'assigned').length} New
            </Badge>
          </motion.div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList size={20} className="text-[#002D62]" />
            Active Assignments
          </h3>
          <Badge className="bg-slate-100 text-slate-600">{tickets.length} Tasks</Badge>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-[#002D62] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-500">Loading assignments...</p>
          </div>
        ) : tickets.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-2 border-slate-200 bg-slate-50">
            <CheckCircle2 size={48} className="mx-auto text-slate-300 mb-4" />
            <h4 className="text-lg font-bold text-slate-700 mb-2">All Clear!</h4>
            <p className="text-slate-500">No pending assignments in your queue.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {tickets.map(ticket => (
              <Card key={ticket.id} className={`p-6 hover:shadow-lg transition-all border-l-4 ${isHighAlert(ticket) ? 'border-l-red-500 bg-red-50/20' : 'border-l-blue-500'}`}>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-slate-400">{ticket.id}</span>
                      <Badge className={STATUS_COLORS[ticket.status]}>{ticket.status.toUpperCase()}</Badge>
                      {ticket.status === 'assigned' && (
                        <Badge className="bg-emerald-500 text-white border-none animate-pulse">NEW ASSIGNMENT</Badge>
                      )}
                      {isHighAlert(ticket) && (
                        <motion.div 
                          animate={{ scale: [1, 1.1, 1] }} 
                          transition={{ repeat: Infinity, duration: 2 }}
                        >
                          <Badge className="bg-red-600 text-white border-none">HIGH ALERT</Badge>
                        </motion.div>
                      )}
                      {ticket.adminWarning && (
                        <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-2 text-rose-700 animate-pulse">
                          <AlertTriangle size={16} />
                          <span className="text-xs font-bold uppercase tracking-widest">Admin Warning: {ticket.adminWarning}</span>
                        </div>
                      )}

                      {ticket.aiReasoning && (
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-800 flex items-start gap-2">
                          <div className="mt-0.5 p-1 bg-blue-200 rounded-full">
                            <Brain size={10} className="text-blue-700" />
                          </div>
                          <p className="leading-relaxed">
                            <span className="font-bold uppercase tracking-widest text-[9px] block mb-0.5 opacity-60">AI Triage Context</span>
                            {ticket.aiReasoning}
                          </p>
                        </div>
                      )}

                      {ticket.status === 'rejected' && (
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex flex-col gap-2 text-amber-700">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={16} />
                            <span className="text-xs font-bold uppercase tracking-widest">Citizen Unsatisfied: Re-work Required</span>
                          </div>
                          {[...(ticket.history || [])].reverse().find(h => h.status === 'rejected')?.message && (
                            <p className="text-[10px] font-medium italic border-t border-amber-200 pt-1">
                              "{[...(ticket.history || [])].reverse().find(h => h.status === 'rejected')?.message.replace('Citizen rejected resolution: ', '')}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-lg font-bold text-slate-900 mb-2">{ticket.description}</h4>
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5"><MapPin size={14} /> {ticket.ward}</span>
                        <span className="flex items-center gap-1.5"><Clock size={14} /> Reported {getTicketAge(ticket.createdAt)}</span>
                        <span className="flex items-center gap-1.5 font-mono font-bold text-blue-600"><Building2 size={14} /> {ticket.departmentNo}</span>
                        <span className="flex items-center gap-1.5 text-slate-400 italic"><UserCircle size={14} /> Anonymous Citizen</span>
                        {currentLocation && ticket.location && (
                          <span className={`flex items-center gap-1.5 font-bold ${calculateDistance(currentLocation.lat, currentLocation.lng, ticket.location.lat, ticket.location.lng) < 50 ? 'text-emerald-600' : 'text-slate-500'}`}>
                            <Navigation size={14} /> 
                            {calculateDistance(currentLocation.lat, currentLocation.lng, ticket.location.lat, ticket.location.lng) < 1000 
                              ? `${Math.round(calculateDistance(currentLocation.lat, currentLocation.lng, ticket.location.lat, ticket.location.lng))}m away`
                              : `${(calculateDistance(currentLocation.lat, currentLocation.lng, ticket.location.lat, ticket.location.lng) / 1000).toFixed(1)}km away`
                            }
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Evidence & Context</h5>
                      <div className="flex gap-4">
                        {ticket.photoBefore && (
                          <div className="space-y-1">
                            <img src={ticket.photoBefore} alt="Before" className="w-24 h-24 object-cover rounded-lg border border-slate-200" />
                            <p className="text-[9px] text-center text-slate-400 font-bold uppercase">Report Photo</p>
                          </div>
                        )}
                        <div className="flex-1 space-y-3">
                          <div className="bg-slate-50 rounded-lg p-3 flex flex-col justify-center">
                            <p className="text-[10px] text-slate-500 italic mb-1">"Citizen reported this issue {getTicketAge(ticket.createdAt)} ago."</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${ticket.urgencyScore > 70 ? 'bg-red-500' : 'bg-blue-500'}`} 
                                  style={{ width: `${ticket.urgencyScore}%` }} 
                                />
                              </div>
                              <span className="text-[10px] font-bold text-slate-600">{ticket.urgencyScore}% Urgency</span>
                            </div>
                          </div>
                          
                          {ticket.history && ticket.history.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ticket History</p>
                              <div className="space-y-2 border-l border-slate-100 ml-1 pl-3 py-1">
                                {ticket.history.slice(-3).map((h, i) => (
                                  <div key={i} className="relative">
                                    <div className="absolute -left-[15px] top-1 w-1.5 h-1.5 rounded-full bg-slate-200" />
                                    <div className="flex justify-between items-start">
                                      <p className="text-[9px] font-medium text-slate-600">{h.message}</p>
                                      <span className="text-[7px] text-slate-400 font-mono">{new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="md:w-64 space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completion Evidence</label>
                      <div 
                        onClick={() => fileInputRefs.current[ticket.id]?.click()}
                        className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${completionPhotos[ticket.id] ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-[#002D62] bg-slate-50'}`}
                      >
                        {completionPhotos[ticket.id] ? (
                          <>
                            <img src={completionPhotos[ticket.id]} alt="After" className="w-full h-full object-cover" />
                            <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                              <div className="w-1 h-1 bg-white rounded-full animate-pulse" /> LIVE
                            </div>
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Camera className="text-white" size={24} />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex flex-col items-center">
                              <Camera className="text-slate-300 mb-1" size={24} />
                              <span className="text-[10px] font-bold text-slate-500">Capture Proof</span>
                              <span className="text-[8px] text-emerald-600 font-bold uppercase tracking-tighter">Live Photo Required</span>
                            </div>
                          </>
                        )}
                      </div>
                      <input 
                        type="file" 
                        ref={el => fileInputRefs.current[ticket.id] = el}
                        onChange={(e) => handleFileChange(ticket.id, e)}
                        accept="image/*" 
                        capture="environment"
                        className="hidden" 
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${ticket.location!.lat},${ticket.location!.lng}`, '_blank')}
                        className="w-full border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        <Navigation size={16} className="mr-2" /> Route to Site
                      </Button>
                      {ticket.status === 'assigned' && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assign Worker</label>
                          <input 
                            type="text"
                            placeholder="Enter worker name..."
                            value={workerNames[ticket.id] || ''}
                            onChange={(e) => setWorkerNames(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                            className="w-full p-2 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#002D62]"
                          />
                          <Button 
                            onClick={() => handleUpdateStatus(ticket.id, 'in-progress')}
                            className="w-full bg-[#002D62] hover:bg-blue-900"
                          >
                            Start Working
                          </Button>
                        </div>
                      )}
                      
                      {ticket.status === 'in-progress' && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-2">
                          <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Assigned Worker</p>
                          <p className="text-sm font-bold text-slate-700">{ticket.workerName}</p>
                        </div>
                      )}

                      {(ticket.status === 'in-progress' || ticket.status === 'rejected') && (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completion Note</label>
                            <textarea 
                              placeholder="Describe the work done..."
                              value={completionNotes[ticket.id] || ''}
                              onChange={(e) => setCompletionNotes(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                              className="w-full p-2 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#002D62]"
                              rows={2}
                            />
                          </div>
                          <Button 
                            onClick={() => handleComplete(ticket.id)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20"
                          >
                            {ticket.status === 'rejected' ? 'Resubmit Completion Proof' : 'Submit Completion Proof'}
                          </Button>
                        </div>
                      )}
                      {ticket.status === 'pending-approval' && (
                        <div className="text-center p-3 bg-amber-50 border border-amber-100 rounded-lg">
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Awaiting Approval</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App ---

interface Notification {
  id: string;
  message: string;
  time: string;
  read: boolean;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const addNotification = (message: string) => {
    const newNotif: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      message,
      time: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 10));
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };
  const [activeTab, setActiveTab] = useState<UserRole | null>(null);

  useEffect(() => {
    if (user) setActiveTab(user.role);
  }, [user]);

  if (!user) {
    return <LoginView onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[#002D62] text-white py-4 px-6 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">PS-CRM</h1>
              <p className="text-[10px] text-blue-200 uppercase tracking-widest">Digital Democracy</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors relative"
              >
                <Bell size={20} />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-[#002D62]" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[60]"
                  >
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800">Notifications</h3>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-wider">
                        {notifications.filter(n => !n.read).length} New
                      </span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                          <Bell className="mx-auto mb-2 opacity-20" size={32} />
                          <p className="text-sm">No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map(notif => (
                          <div 
                            key={notif.id}
                            onClick={() => markAsRead(notif.id)}
                            className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer relative ${!notif.read ? 'bg-blue-50/30' : ''}`}
                          >
                            {!notif.read && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                            )}
                            <p className={`text-sm mb-1 ${!notif.read ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                              {notif.message}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {getTicketAge(notif.time)} ago
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium">{user.name}</p>
                <Badge className="bg-blue-900/50 text-blue-100 border border-blue-700/50">
                  {user.role.toUpperCase()}
                </Badge>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-800 flex items-center justify-center border-2 border-blue-700">
                <UserCircle size={24} />
              </div>
            </div>
            <button 
              onClick={() => setUser(null)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'citizen' && <CitizenView user={user} onNotify={addNotification} />}
            {activeTab === 'admin' && <AdminView user={user} onNotify={addNotification} />}
            {activeTab === 'officer' && <OfficerView user={user} onNotify={addNotification} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-slate-400 text-xs">© 2026 Digital Democracy Initiative. All rights reserved.</p>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <Mail size={12} />
              <span>Office: {OFFICE_EMAIL}</span>
            </div>
          </div>
          <div className="flex gap-6 text-xs text-slate-400">
            <a href="#" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Terms of Service</a>
            <a href={`mailto:${OFFICE_EMAIL}`} className="hover:text-slate-600 transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
