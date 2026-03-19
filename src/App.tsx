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
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types & Constants ---

type UserRole = 'citizen' | 'admin' | 'officer';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  ward?: string;
  avatar?: string;
}

type TicketStatus = 'open' | 'assigned' | 'in-progress' | 'pending-approval' | 'resolved' | 'closed';
type GrievanceCategory = 'waste' | 'water' | 'roads' | 'electricity' | 'sanitation' | 'other';

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
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

const WARDS = ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'];
const CATEGORIES: { value: GrievanceCategory; label: string; color: string }[] = [
  { value: 'waste', label: 'Waste Management', color: 'bg-orange-100 text-orange-700' },
  { value: 'water', label: 'Water Supply', color: 'bg-blue-100 text-blue-700' },
  { value: 'roads', label: 'Roads & Potholes', color: 'bg-slate-100 text-slate-700' },
  { value: 'electricity', label: 'Street Lights/Power', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'sanitation', label: 'Sanitation', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'other', label: 'Other', color: 'bg-purple-100 text-purple-700' },
];

const STATUS_COLORS: Record<TicketStatus, string> = {
  'open': 'bg-red-100 text-red-700',
  'assigned': 'bg-blue-100 text-blue-700',
  'in-progress': 'bg-indigo-100 text-indigo-700',
  'pending-approval': 'bg-amber-100 text-amber-700',
  'resolved': 'bg-emerald-100 text-emerald-700',
  'closed': 'bg-slate-100 text-slate-700',
};

// --- Mock Database & Client ---

const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Devansh Patel', email: 'citizen@example.com', role: 'citizen', ward: 'Ward 1' },
  { id: 'u2', name: 'Admin Sarah', email: 'admin@example.com', role: 'admin' },
  { id: 'u3', name: 'Officer John', email: 'john@example.com', role: 'officer', ward: 'Ward 1' },
  { id: 'u4', name: 'Officer Mike', email: 'mike@example.com', role: 'officer', ward: 'Ward 2' },
  { id: 'u5', name: 'Officer Lisa', email: 'lisa@example.com', role: 'officer', ward: 'Ward 3' },
];

const INITIAL_TICKETS: Ticket[] = [
  {
    id: 'T-1001',
    citizenId: 'u1',
    description: 'Large pothole in the middle of the main road near the park.',
    category: 'roads',
    urgencyScore: 85,
    status: 'open',
    ward: 'Ward 1',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'T-1002',
    citizenId: 'u1',
    description: 'Garbage pile not collected for 3 days.',
    category: 'waste',
    urgencyScore: 65,
    status: 'assigned',
    ward: 'Ward 1',
    officerId: 'u3',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'T-1003',
    citizenId: 'u1',
    description: 'Street light flickering and making noise.',
    category: 'electricity',
    urgencyScore: 40,
    status: 'resolved',
    ward: 'Ward 2',
    officerId: 'u4',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tickets.unshift(newTicket);
    return newTicket;
  }

  async updateTicket(id: string, updates: Partial<Ticket>) {
    const index = this.tickets.findIndex(t => t.id === id);
    if (index !== -1) {
      this.tickets[index] = { 
        ...this.tickets[index], 
        ...updates, 
        updatedAt: new Date().toISOString() 
      };
      return this.tickets[index];
    }
    throw new Error('Ticket not found');
  }

  async getOfficers() {
    return this.users.filter(u => u.role === 'officer');
  }

  async login(email: string) {
    const user = this.users.find(u => u.email === email);
    if (user) return user;
    throw new Error('Invalid credentials');
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
  }

  if (lowerText.includes('urgent') || lowerText.includes('danger') || lowerText.includes('emergency')) {
    score += 20;
  }

  return { category, score: Math.min(score, 100) };
};

const isSLABreached = (ticket: Ticket) => {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return false;
  const created = new Date(ticket.createdAt).getTime();
  const now = Date.now();
  const diffHours = (now - created) / (1000 * 60 * 60);
  return diffHours > 48; // 48 hour SLA
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
}

const Card = ({ children, className = "" }: CardProps) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = "", 
  disabled = false,
  type = 'button'
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
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

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

// --- Views ---

const LoginView = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (email: string) => {
    setLoading(true);
    try {
      const user = await supabase.login(email);
      onLogin(user);
    } catch (err) {
      alert('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-[#002D62] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="text-white w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Digital Democracy CRM</h1>
        <p className="text-slate-500 mb-8">Smart Public Service Management System</p>
        
        <div className="space-y-3">
          <Button onClick={() => handleLogin('citizen@example.com')} className="w-full" disabled={loading}>
            Login as Citizen
          </Button>
          <Button onClick={() => handleLogin('admin@example.com')} variant="secondary" className="w-full" disabled={loading}>
            Login as Admin
          </Button>
          <Button onClick={() => handleLogin('john@example.com')} variant="outline" className="w-full" disabled={loading}>
            Login as Field Officer
          </Button>
        </div>
      </Card>
    </div>
  );
};

const CitizenView = ({ user }: { user: User }) => {
  const [description, setDescription] = useState('');
  const [ward, setWard] = useState(user.ward || 'Ward 1');
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const triage = useMemo(() => classifyGrievance(description), [description]);

  useEffect(() => {
    supabase.getTickets().then(all => {
      setTickets(all.filter(t => t.citizenId === user.id));
    });
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
    if (!description) return;
    setSubmitting(true);
    try {
      const ticket = await supabase.createTicket({
        citizenId: user.id,
        description,
        category: triage.category,
        urgencyScore: triage.score,
        ward,
        location: location ? { ...location, address: 'Detected Location' } : undefined,
        photoBefore: photo || undefined,
      });
      setSuccess(ticket.id);
      setDescription('');
      setPhoto(null);
      setLocation(null);
    } catch (err) {
      alert('Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-3xl font-bold mb-2">Report Submitted!</h2>
        <p className="text-slate-500 mb-8">Your ticket ID is <span className="font-mono font-bold text-slate-900">{success}</span>. We will notify you once an officer is assigned.</p>
        <Button onClick={() => setSuccess(null)}>Submit Another Report</Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                <div className="mt-3 flex gap-2 animate-in fade-in slide-in-from-top-1">
                  <Badge className={CATEGORIES.find(c => c.value === triage.category)?.color}>
                    AI Category: {triage.category.toUpperCase()}
                  </Badge>
                  <Badge className={triage.score > 70 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}>
                    Urgency: {triage.score}%
                  </Badge>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={handleCaptureLocation} 
                  className="w-full"
                >
                  <MapPin size={18} className={location ? "text-emerald-500" : ""} />
                  {location ? "Location Captured" : "Capture My Location"}
                </Button>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">Photo Evidence</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <div className="relative group">
                  {photo ? (
                    <div className="relative rounded-lg overflow-hidden h-32">
                      <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setPhoto(null)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-32 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-[#002D62] hover:text-[#002D62] transition-all"
                    >
                      <Camera size={24} className="mb-2" />
                      <span className="text-xs">Click to take photo / upload</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full py-4 text-lg" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Report"}
            </Button>
          </form>
        </Card>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold">My Reports</h2>
        <div className="space-y-4">
          {tickets.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No reports yet.</p>
          ) : (
            tickets.map(ticket => (
              <Card key={ticket.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono text-slate-400">{ticket.id}</span>
                  <Badge className={STATUS_COLORS[ticket.status]}>{ticket.status.toUpperCase()}</Badge>
                </div>
                <p className="text-sm text-slate-700 line-clamp-2 mb-3">{ticket.description}</p>
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

const AdminView = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [officers, setOfficers] = useState<User[]>([]);
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [t, o] = await Promise.all([supabase.getTickets(), supabase.getOfficers()]);
      setTickets(t);
      setOfficers(o);
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const total = tickets.length;
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    const breaches = tickets.filter(isSLABreached).length;
    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, resolved, breaches, rate };
  }, [tickets]);

  const filteredTickets = tickets.filter(t => {
    const matchesFilter = filter === 'all' || t.status === filter;
    const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleAssign = async (ticketId: string, officerId: string) => {
    await supabase.updateTicket(ticketId, { officerId, status: 'assigned' });
    setTickets(await supabase.getTickets());
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 bg-[#002D62] text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-200 text-sm mb-1">Total Tickets</p>
              <h3 className="text-3xl font-bold">{stats.total}</h3>
            </div>
            <ClipboardList className="text-blue-300 opacity-50" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-sm mb-1">SLA Breaches</p>
              <h3 className="text-3xl font-bold text-red-600">{stats.breaches}</h3>
            </div>
            <AlertTriangle className="text-red-200" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-sm mb-1">Resolved</p>
              <h3 className="text-3xl font-bold text-emerald-600">{stats.resolved}</h3>
            </div>
            <CheckCircle2 className="text-emerald-200" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-sm mb-1">Resolution Rate</p>
              <h3 className="text-3xl font-bold">{stats.rate}%</h3>
            </div>
            <BarChart3 className="text-slate-200" />
          </div>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <h2 className="text-2xl font-bold">Ticket Management</h2>
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

      <Card className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-bottom border-slate-200">
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ticket</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Photos</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ward</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Urgency</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assignment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredTickets.map(ticket => (
              <tr key={ticket.id} className={`hover:bg-slate-50 transition-colors ${isSLABreached(ticket) ? 'bg-red-50/50' : ''}`}>
                <td className="p-4">
                  <div className="font-mono text-xs font-bold text-[#002D62]">{ticket.id}</div>
                  <div className="text-sm text-slate-600 line-clamp-1 max-w-xs">{ticket.description}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{getTicketAge(ticket.createdAt)}</div>
                </td>
                <td className="p-4">
                  <div className="flex gap-1">
                    {ticket.photoBefore && (
                      <button 
                        onClick={() => setSelectedPhoto(ticket.photoBefore!)}
                        className="w-8 h-8 rounded border border-slate-200 overflow-hidden hover:ring-2 hover:ring-[#002D62] transition-all"
                        title="View Photo Before"
                      >
                        <img src={ticket.photoBefore} alt="Before" className="w-full h-full object-cover" />
                      </button>
                    )}
                    {ticket.photoAfter && (
                      <button 
                        onClick={() => setSelectedPhoto(ticket.photoAfter!)}
                        className="w-8 h-8 rounded border border-emerald-200 overflow-hidden hover:ring-2 hover:ring-emerald-500 transition-all"
                        title="View Photo After"
                      >
                        <img src={ticket.photoAfter} alt="After" className="w-full h-full object-cover" />
                      </button>
                    )}
                    {!ticket.photoBefore && !ticket.photoAfter && <span className="text-[10px] text-slate-300">No photos</span>}
                  </div>
                </td>
                <td className="p-4">
                  <Badge className={CATEGORIES.find(c => c.value === ticket.category)?.color}>
                    {ticket.category.toUpperCase()}
                  </Badge>
                </td>
                <td className="p-4 text-sm text-slate-600">{ticket.ward}</td>
                <td className="p-4">
                  <Badge className={STATUS_COLORS[ticket.status]}>{ticket.status.toUpperCase()}</Badge>
                </td>
                <td className="p-4">
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${ticket.urgencyScore > 70 ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${ticket.urgencyScore}%` }}
                    />
                  </div>
                </td>
                <td className="p-4">
                  {ticket.officerId ? (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <UserCircle size={16} />
                      {officers.find(o => o.id === ticket.officerId)?.name}
                    </div>
                  ) : (
                    <select 
                      onChange={(e) => handleAssign(ticket.id, e.target.value)}
                      className="text-xs p-1.5 rounded border border-slate-200 outline-none bg-white"
                      defaultValue=""
                    >
                      <option value="" disabled>Assign Officer</option>
                      {officers.map(o => <option key={o.id} value={o.id}>{o.name} ({o.ward})</option>)}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <AnimatePresence>
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
      </AnimatePresence>
    </div>
  );
};

const OfficerView = ({ user }: { user: User }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [completionPhotos, setCompletionPhotos] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    supabase.getTickets().then(all => {
      setTickets(all.filter(t => t.officerId === user.id));
      setLoading(false);
    });
  }, [user.id]);

  const handleUpdateStatus = async (id: string, status: TicketStatus) => {
    await supabase.updateTicket(id, { status });
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
    await supabase.updateTicket(id, { 
      status: 'pending-approval', 
      photoAfter: photo 
    });
    setTickets(await supabase.getTickets().then(all => all.filter(t => t.officerId === user.id)));
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">My Task List</h2>
        <Badge className="bg-blue-100 text-blue-700">{tickets.filter(t => t.status !== 'resolved').length} Active Tasks</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tickets.map(ticket => (
          <Card key={ticket.id} className={`flex flex-col ${isSLABreached(ticket) ? 'border-l-4 border-l-red-500' : ''}`}>
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start mb-4">
                <div className="font-mono text-xs font-bold text-slate-400">{ticket.id}</div>
                <Badge className={STATUS_COLORS[ticket.status]}>{ticket.status.toUpperCase()}</Badge>
              </div>
              <h3 className="font-bold text-lg mb-2">{CATEGORIES.find(c => c.value === ticket.category)?.label}</h3>
              <p className="text-slate-600 text-sm mb-4 line-clamp-3">{ticket.description}</p>
              
              {ticket.photoBefore && (
                <div className="mb-4 rounded-lg overflow-hidden border border-slate-200">
                  <p className="text-[10px] font-bold uppercase bg-slate-100 p-1 text-slate-500">Reported Photo</p>
                  <img src={ticket.photoBefore} alt="Reported" className="w-full h-32 object-cover" />
                </div>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <MapPin size={14} /> {ticket.ward}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock size={14} /> Assigned {getTicketAge(ticket.updatedAt)}
                </div>
              </div>

              {completionPhotos[ticket.id] && (
                <div className="mb-4 rounded-lg overflow-hidden border border-slate-200">
                  <p className="text-[10px] font-bold uppercase bg-slate-100 p-1 text-slate-500">Completion Photo</p>
                  <img src={completionPhotos[ticket.id]} alt="Completion" className="w-full h-32 object-cover" />
                </div>
              )}

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-medium text-slate-500">
                  <span>Urgency</span>
                  <span>{ticket.urgencyScore}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${ticket.urgencyScore > 70 ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${ticket.urgencyScore}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2">
              {ticket.status === 'assigned' && (
                <Button onClick={() => handleUpdateStatus(ticket.id, 'in-progress')} className="flex-1">
                  Start Work
                </Button>
              )}
              {ticket.status === 'in-progress' && (
                <>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    className="hidden" 
                    ref={el => fileInputRefs.current[ticket.id] = el}
                    onChange={(e) => handleFileChange(ticket.id, e)}
                  />
                  <Button 
                    variant="outline" 
                    className={`flex-1 ${completionPhotos[ticket.id] ? 'border-emerald-500 text-emerald-600' : ''}`}
                    onClick={() => fileInputRefs.current[ticket.id]?.click()}
                  >
                    <Camera size={18} /> {completionPhotos[ticket.id] ? 'Retake Photo' : 'Add Photo'}
                  </Button>
                  <Button onClick={() => handleComplete(ticket.id)} className="flex-1">
                    Complete
                  </Button>
                </>
              )}
              {ticket.status === 'pending-approval' && (
                <p className="text-xs text-slate-500 italic text-center w-full">Waiting for citizen approval</p>
              )}
              {(ticket.status === 'resolved' || ticket.status === 'closed') && (
                <div className="flex items-center justify-center w-full gap-2 text-emerald-600 font-medium">
                  <CheckCircle2 size={18} /> Task Completed
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
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

      {/* Role Switcher (Demo Only) */}
      <div className="bg-white border-b border-slate-200 px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-4 text-xs">
          <span className="text-slate-400 font-medium uppercase tracking-wider">Switch View (Demo):</span>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {(['citizen', 'admin', 'officer'] as UserRole[]).map(role => (
              <button
                key={role}
                onClick={() => setActiveTab(role)}
                className={`px-3 py-1 rounded-md transition-all ${activeTab === role ? 'bg-white shadow-sm text-[#002D62] font-bold' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {role.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

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
            {activeTab === 'citizen' && <CitizenView user={user} />}
            {activeTab === 'admin' && <AdminView />}
            {activeTab === 'officer' && <OfficerView user={user} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-xs">© 2026 Digital Democracy Initiative. All rights reserved.</p>
          <div className="flex gap-6 text-xs text-slate-400">
            <a href="#" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
