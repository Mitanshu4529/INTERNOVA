import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { extractTextFromFile, parseResumeWithAI } from '../utils/resumeParser';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Slider } from './ui/slider';
import { 
  Target, 
  LogOut, 
  User, 
  Briefcase, 
  MapPin, 
  Calendar,
  CalendarDays,
  Star,
  ExternalLink,
  Search,
  Filter,
  BookOpen,
  Award,
  Plus,
  X,
  ArrowLeft,
  AlertCircle,
  TrendingUp,
  Building2,
  Globe,
  Upload,
  Camera,
  Edit,
  Sparkles,
  Check,
  DollarSign,
  Clock,
  Bell,
  MessageSquare,
  Loader2
} from 'lucide-react';

interface UserDashboardProps {
  user: any;
  onLogout: () => void;
  onBack: () => void;
  dataStore: any;
}

// Indian colleges data
const indianColleges = [
  'IIT Bombay', 'IIT Delhi', 'IIT Madras', 'IIT Kanpur', 'IIT Kharagpur', 'IIT Roorkee', 'IIT Guwahati',
  'IISc Bangalore', 'BITS Pilani', 'IIIT Hyderabad', 'Delhi University', 'Jadavpur University',
  'ISI Kolkata', 'CMI Chennai', 'TIFR Mumbai', 'NIT Trichy', 'NIT Warangal', 'NIT Surathkal',
  'VNIT Nagpur', 'MANIT Bhopal', 'MNNIT Allahabad', 'IIIT Delhi', 'IIIT Bangalore', 'DTU Delhi',
  'NSIT Delhi', 'PEC Chandigarh', 'Thapar University', 'VIT Vellore', 'SRM Chennai', 'Manipal University',
  'BIT Mesra', 'KIIT Bhubaneswar', 'Amity University', 'LPU Punjab', 'Anna University', 'BIT Ranchi',
  'Jamia Millia Islamia', 'Aligarh Muslim University', 'Banasthali University', 'COEP Pune',
  'VJTI Mumbai', 'ICT Mumbai', 'DAIICT Gandhinagar', 'PSG College of Technology', 'SSN College of Engineering',
  'RV College of Engineering', 'BMS College of Engineering', 'Ramaiah Institute of Technology',
  'MS Ramaiah University', 'PESIT Bangalore', 'Christ University', 'Symbiosis International University',
  'MIT Pune', 'COEP Pune', 'Pune University', 'Mumbai University', 'Bangalore University',
  'Osmania University', 'Andhra University', 'Calcutta University', 'Banaras Hindu University'
];

const courses = [
  'Computer Science Engineering', 'Information Technology', 'Electronics and Communication',
  'Mechanical Engineering', 'Civil Engineering', 'Electrical Engineering', 'Chemical Engineering',
  'Aerospace Engineering', 'Biotechnology', 'Computer Applications (BCA/MCA)', 'Data Science',
  'Artificial Intelligence', 'Cybersecurity', 'Software Engineering', 'Business Administration (MBA)',
  'Commerce', 'Economics', 'Mathematics', 'Physics', 'Chemistry', 'Statistics'
];

const years = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];

const indianCities = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad',
  'Gurgaon', 'Noida', 'Kochi', 'Indore', 'Nagpur', 'Visakhapatnam', 'Bhopal', 'Lucknow',
  'Kanpur', 'Jaipur', 'Surat', 'Coimbatore', 'Vadodara', 'Agra', 'Nashik', 'Faridabad',
  'Rajkot', 'Meerut', 'Jabalpur', 'Thane', 'Allahabad', 'Ranchi', 'Remote'
];

export function UserDashboard({ user, onLogout, onBack, dataStore }: UserDashboardProps) {
  const [activeTab, setActiveTab] = useState(user.isNewUser ? 'profile' : 'feed');
  const [showProfilePrompt, setShowProfilePrompt] = useState(user.isNewUser);
  const [profile, setProfile] = useState({
    university: '',
    course: '',
    year: '',
    cgpa: '',
    bio: '',
    location: '',
    skills: [] as string[],
    experience: [] as any[],
    projects: [] as any[],
    photo: null as string | null,
    resume: null as File | null,
    ...user.profile
  });
  
  const [newSkill, setNewSkill] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [availableInternships, setAvailableInternships] = useState<any[]>([]);
  const [savedInternships, setSavedInternships] = useState<Set<string>>(new Set());
  const [appliedInternships, setAppliedInternships] = useState<Set<string>>(new Set());
  const [applications, setApplications] = useState<any[]>([]); // Store full application objects with status
  const [editingBio, setEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isParsingResume, setIsParsingResume] = useState(false);
  
  // Messages/Activity
  const [messages, setMessages] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Filters
  const [filters, setFilters] = useState({
    type: [] as string[],
    location: [] as string[],
    stipendRange: [0, 25000],
    duration: [] as string[]
  });
  const [showFilters, setShowFilters] = useState(false);

  // College search
  const [collegeSearch, setCollegeSearch] = useState('');
  const [showCollegeDropdown, setShowCollegeDropdown] = useState(false);

  // Load profile from localStorage on mount
  useEffect(() => {
    const loadProfile = () => {
      try {
        // Try to get updated profile from localStorage
        const localUsers = localStorage.getItem('local_users');
        if (localUsers) {
          const users = JSON.parse(localUsers);
          const userData = users[user.email.toLowerCase().trim()];
          if (userData && userData.user && userData.user.profile) {
            const loadedProfile = {
              university: '',
              course: '',
              year: '',
              cgpa: '',
              bio: '',
              location: '',
              skills: [] as string[],
              experience: [] as any[],
              projects: [] as any[],
              photo: null as string | null,
              resume: null as File | null,
              ...userData.user.profile
            };
            setProfile(loadedProfile);
          }
        }
      } catch (error) {
        console.warn('Error loading profile from localStorage:', error);
      }
    };
    
    loadProfile();
  }, [user.email, user.id]);

  // Load ALL data including internships on mount and when user changes
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsLoading(true);
        
        // 1. Load saved and applied internships first
        const [saved, applicationsData] = await Promise.all([
          dataStore.getSavedInternships(user.id),
          dataStore.getApplicationsByStudent(user.id)
        ]);
        
        setSavedInternships(new Set(saved));
        setAppliedInternships(new Set(applicationsData.map((app: any) => app.internshipId)));
        setApplications(applicationsData);
        
        // 2. Load messages
        const [msgs, unread] = await Promise.all([
          dataStore.getMessagesForUser(user.email),
          dataStore.getUnreadCount(user.email)
        ]);
        setMessages(msgs);
        setUnreadCount(unread);
        
        // 3. Load internships (this is critical - must load after saved/applied state)
        // Always load internships - use recommendations if skills available, otherwise all internships
        let internships: any[] = [];
        try {
          if (dataStore.getRecommendedInternships && profile.skills && profile.skills.length > 0) {
             internships = await dataStore.getRecommendedInternships(profile.skills);
          } else {
             internships = await dataStore.getInternships();
          }
        } catch (err) {
          console.warn('Error loading internships, trying fallback:', err);
          // Fallback: always try to get internships
          try {
            internships = await dataStore.getInternships();
          } catch (fallbackErr) {
            console.error('Fallback also failed:', fallbackErr);
            internships = [];
          }
        }
        
        // Ensure we have internships - if still empty, try one more time
        if (!internships || internships.length === 0) {
          console.warn('No internships loaded, trying direct API call...');
          try {
            internships = await dataStore.getInternships();
          } catch (err) {
            console.error('Final attempt to load internships failed:', err);
            internships = [];
          }
        }
        
        console.log('Loaded internships:', internships.length);
        
        const allApplications = await dataStore.getAllApplications();
        
        // Add application stats and match scores
        const enrichedInternships = internships.map((internship: any) => {
          const applicantCount = allApplications.filter((app: any) => app.internshipId === internship.id).length;
          
          let matchScore = internship.matchScore || 50;
          if (!internship.matchScore && profile && profile.skills && profile.skills.length > 0) {
             const userSkills = profile.skills.map((skill: string) => skill.toLowerCase().trim());
             const internshipSkills = (internship.skills || []).map((skill: string) => skill.toLowerCase().trim());
             const matchingSkills = userSkills.filter((userSkill: string) => 
               internshipSkills.some((internshipSkill: string) => 
                 userSkill.includes(internshipSkill) || 
                 internshipSkill.includes(userSkill) ||
                 userSkill === internshipSkill
               )
             );
             const skillMatchPercentage = internshipSkills.length > 0 ? 
               (matchingSkills.length / internshipSkills.length) * 100 : 0;
             matchScore = Math.min(50 + Math.round(skillMatchPercentage * 0.45), 95);
          }

          return {
            ...internship,
            matchScore: matchScore,
            acceptanceRate: 10 + Math.floor(Math.random() * 30),
            applicants: applicantCount
          };
        });
        
        console.log('Enriched internships:', enrichedInternships.length);
        setAvailableInternships(enrichedInternships);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading all data:', error);
        setIsLoading(false);
      }
    };
    
    loadAllData();
    
    // Set up refresh interval
    const interval = setInterval(async () => {
      try {
        const [msgs, unread, applicationsData, saved] = await Promise.all([
          dataStore.getMessagesForUser(user.email),
          dataStore.getUnreadCount(user.email),
          dataStore.getApplicationsByStudent(user.id),
          dataStore.getSavedInternships(user.id)
        ]);
        setMessages(msgs);
        setUnreadCount(unread);
        setApplications(applicationsData);
        setAppliedInternships(new Set(applicationsData.map((app: any) => app.internshipId)));
        setSavedInternships(new Set(saved));
      } catch (error) {
        console.error('Error refreshing data:', error);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [user.id, user.email, dataStore, profile.skills?.length || 0]); // Re-run when user or skills change

  useEffect(() => {
    if (user.isNewUser && showProfilePrompt) {
      const timer = setTimeout(() => {
        setShowProfilePrompt(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [user.isNewUser, showProfilePrompt]);

  const addSkill = () => {
    if (newSkill.trim() && !(profile.skills || []).includes(newSkill.trim())) {
      const updatedSkills = [...(profile.skills || []), newSkill.trim()];
      updateProfile({
        skills: updatedSkills
      });
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    const updatedSkills = (profile.skills || []).filter((s:string) => s !== skill);
    updateProfile({
      skills: updatedSkills
    });
  };

  const handleSaveInternship = async (id: string) => {
    console.log('handleSaveInternship called with id:', id);
    try {
      const isSaved = savedInternships.has(id);
      console.log('Is saved?', isSaved);
      
      // Update UI immediately for better UX
      if (isSaved) {
        setSavedInternships(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          console.log('Removed from saved set');
          return newSet;
        });
        await dataStore.unsaveInternship(user.id, id);
      } else {
        setSavedInternships(prev => {
          const newSet = new Set([...prev, id]);
          console.log('Added to saved set');
          return newSet;
        });
        await dataStore.saveInternship(user.id, id);
      }
      
      // Refresh from dataStore to ensure consistency
      const updatedSaved = await dataStore.getSavedInternships(user.id);
      console.log('Updated saved internships:', updatedSaved);
      setSavedInternships(new Set(updatedSaved));
    } catch (error) {
      console.error('Error saving/unsaving internship:', error);
      // Revert UI on error
      const updatedSaved = await dataStore.getSavedInternships(user.id);
      setSavedInternships(new Set(updatedSaved));
      alert('Failed to save internship. Please try again.');
    }
  };

  const handleApplyInternship = async (id: string) => {
    console.log('handleApplyInternship called with id:', id);
    try {
      // Check if already applied
      if (appliedInternships.has(id)) {
        alert('You have already applied to this internship.');
        return;
      }

      // Update UI immediately for better UX
      console.log('Updating applied internships state');
      setAppliedInternships(prev => {
        const newSet = new Set([...prev, id]);
        console.log('Added to applied set');
        return newSet;
      });

      // 1. Sanitize Profile: Remove raw File objects before sending to DB
      const profileForDB = { ...profile };
      
      // If resume is a File object (from recent upload), replace with metadata
      if (profile.resume instanceof File) {
        profileForDB.resume = { 
          name: profile.resume.name, 
          date: new Date().toISOString() 
        };
      }

      // 2. Update profile in dataStore first
      await dataStore.updateUserProfile(user.id, profileForDB);
      
      // 3. Apply to internship using the Sanitized Profile
      await dataStore.applyToInternship(
        user.id, 
        id, 
        profileForDB,
        { name: user.name, email: user.email }
      );
      
      // 4. Refresh all data from dataStore to ensure consistency
      const [updatedSaved, updatedApplications] = await Promise.all([
        dataStore.getSavedInternships(user.id),
        dataStore.getApplicationsByStudent(user.id)
      ]);
      
      // Update local UI state with fresh data
      setSavedInternships(new Set(updatedSaved));
      setAppliedInternships(new Set(updatedApplications.map((app: any) => app.internshipId)));
      setApplications(updatedApplications);
      
      alert('Application submitted successfully!');
    } catch (error) {
      console.error('Error applying to internship:', error);
      // Revert UI on error
      const updatedApplications = await dataStore.getApplicationsByStudent(user.id);
      setAppliedInternships(new Set(updatedApplications.map((app: any) => app.internshipId)));
      setApplications(updatedApplications);
      alert('Failed to submit application. Please try again.');
    }
  };

  // Update profile in dataStore when it changes
  const updateProfile = async (updates: any) => {
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);
    
    try {
      await dataStore.updateUserProfile(user.id, newProfile);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const updateBio = () => {
    updateProfile({ bio: tempBio });
    setEditingBio(false);
    setTempBio('');
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        updateProfile({ photo: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  // ============================================================
  //  AI RESUME PARSING LOGIC
  // ============================================================
  // ... inside UserDashboard component ...

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (file) {
      setIsParsingResume(true);
      try {
        // 1. Extract raw text from any file type
        const text = await extractTextFromFile(file);
        
        // 2. Get exactly 5 skills from AI/keyword matching
        const extractedSkills = await parseResumeWithAI(text);
        
        // 3. Merge Skills (add new ones, keep existing)
        const currentSkills = profile.skills || [];
        const uniqueSkills = Array.from(new Set([...currentSkills, ...extractedSkills]));
        
        // 4. Prepare Clean Profile for Database (No File Object!)
        const profileForDB = {
          ...profile,
          resume: { name: file.name, date: new Date().toISOString(), type: file.type }, // Save metadata only
          skills: uniqueSkills
        };

        // 5. Update Database
        await updateProfile(profileForDB);
        
        // 6. Update Local State (Keep the file object here for UI if needed)
        setProfile({ ...profileForDB, resume: file }); 
        
        alert(`Success! Extracted 5 skills: ${extractedSkills.join(', ')}. Profile updated.`);
        
      } catch (error) {
        console.error("File parsing failed:", error);
        alert("Could not process file. Please try again.");
      } finally {
        setIsParsingResume(false);
      }
    } else {
      alert('Please select a file');
    }
  };
  const handleAIBioCompletion = () => {
    // Mock AI bio completion based on existing profile data
    let aiBio = "Passionate ";
    
    if (profile.course) {
      aiBio += `${profile.course.toLowerCase()} `;
    }
    
    aiBio += "student with a strong foundation in ";
    
    if (profile.skills && profile.skills.length > 0) {
      const mainSkills = profile.skills.slice(0, 3).join(', ');
      aiBio += `${mainSkills}. `;
    } else {
      aiBio += "programming and technology. ";
    }
    
    if (profile.university && profile.university.trim()) {
      aiBio += `Currently studying at ${profile.university}. `;
    }
    
    aiBio += "Eager to apply my skills in a challenging internship environment and contribute to innovative projects while learning from industry professionals. ";
    
    if (profile.location && profile.location.trim()) {
      aiBio += `Based in ${profile.location} and `;
    }
    
    aiBio += "looking forward to hands-on experience that bridges academic knowledge with real-world applications.";
    
    updateProfile({ bio: aiBio });
    alert('Bio completed with AI assistance!');
  };

  // Function to refresh messages
  const refreshMessages = async () => {
    try {
      const msgs = await dataStore.getMessagesForUser(user.email);
      const unread = await dataStore.getUnreadCount(user.email);
      setMessages(msgs);
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error refreshing messages:', error);
    }
  };

  // Mark message as read
  const markMessageAsRead = async (messageId: string) => {
    try {
      await dataStore.markMessageAsRead(messageId);
      await refreshMessages();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const calculateAcceptanceRate = (internship: any) => {
    let baseRate = internship.acceptanceRate || 50;
    
    // Adjust based on user profile completion
    const completion = profileCompletion();
    if (completion < 50) baseRate *= 0.6;
    else if (completion > 80) baseRate *= 1.3;
    
    // Adjust based on skill match
    const userSkills = (profile.skills || []).map((s:string) => s.toLowerCase());
    const requiredSkills = (internship.skills || []).map((s: string) => s.toLowerCase());
    const skillMatch = requiredSkills.length > 0 ? 
      requiredSkills.filter((skill: string) => 
        userSkills.some((userSkill:string) => userSkill.includes(skill) || skill.includes(userSkill))
      ).length / requiredSkills.length : 0;
    
    baseRate *= (0.7 + skillMatch * 0.6);
    
    // Adjust based on CGPA if provided
    if (profile.cgpa && internship.requirements && internship.requirements.cgpa) {
      const userCgpa = parseFloat(profile.cgpa);
      const reqCgpa = internship.requirements.cgpa;
      if (userCgpa >= reqCgpa) baseRate *= 1.2;
      else if (userCgpa < reqCgpa - 1) baseRate *= 0.7;
    }
    
    return Math.min(Math.round(baseRate), 95);
  };

  const filteredInternships = availableInternships.filter(internship => {
    // Text search
    const matchesSearch = (internship.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (internship.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (internship.skills || []).some((skill:string) => skill.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (internship.location || '').toLowerCase().includes(searchQuery.toLowerCase());

    // Type filter
    const matchesType = filters.type.length === 0 || filters.type.includes(internship.type);
    
    // Location filter
    const matchesLocation = filters.location.length === 0 || filters.location.includes(internship.location);
    
    // Stipend filter
    const stipendAmount = internship.stipendAmount || 0;
    const matchesStipend = stipendAmount >= filters.stipendRange[0] && 
                          stipendAmount <= filters.stipendRange[1];
    
    // Duration filter
    const matchesDuration = filters.duration.length === 0 || 
                           filters.duration.some(dur => (internship.duration || '').includes(dur));

    return matchesSearch && matchesType && matchesLocation && matchesStipend && matchesDuration;
  }).sort((a, b) => {
    // Sort by match score in descending order (highest match first)
    return (b.matchScore || 0) - (a.matchScore || 0);
  });

  const profileCompletion = () => {
    const fields = [
      profile.university || '', 
      profile.course || '', 
      profile.year || '', 
      profile.bio || '', 
      profile.location || ''
    ];
    const completed = fields.filter(field => field.trim() !== '').length;
    const skillsWeight = (profile.skills && profile.skills.length > 0) ? 1 : 0;
    const cgpaWeight = (profile.cgpa && profile.cgpa.trim() !== '') ? 1 : 0;
    const photoWeight = profile.photo ? 1 : 0;
    return Math.round(((completed + skillsWeight + cgpaWeight + photoWeight) / 8) * 100);
  };

  const getFilteredColleges = () => {
    if (!collegeSearch) return [];
    const searchTerm = collegeSearch.toLowerCase();
    return indianColleges.filter(college => college.toLowerCase().includes(searchTerm)).slice(0, 10);
  };

  const handleLogoClick = () => {
    onBack();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center space-x-2 cursor-pointer" onClick={handleLogoClick}>
              <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                <Target className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold">Internova</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Avatar>
              {profile.photo ? (
                <AvatarImage src={profile.photo} alt={user.name} />
              ) : (
                <AvatarFallback>
                  {user.name.split(' ').map((n: string) => n[0]).join('')}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="hidden sm:block">
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Profile Completion Prompt */}
      {showProfilePrompt && (
        <motion.div 
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="container py-4"
        >
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Welcome! Complete your profile first to get personalized internship recommendations with better acceptance rates.
              <Button 
                variant="link" 
                className="p-0 h-auto ml-2"
                onClick={() => setActiveTab('profile')}
              >
                Complete Profile →
              </Button>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Main Content */}
      <div className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-muted p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('feed')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'feed' 
                    ? 'bg-background shadow-sm text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Internship Feed
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'profile' 
                    ? 'bg-background shadow-sm text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                My Profile
              </button>
              <button
                onClick={() => {
                  setActiveTab('applications');
                  refreshMessages();
                }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all relative ${
                  activeTab === 'applications' 
                    ? 'bg-background shadow-sm text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                My Activity
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
          
          {/* Internship Feed */}
          <TabsContent value="feed" className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search internships, companies, or skills..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setShowFilters(!showFilters)}
                  className={showFilters ? 'bg-primary text-primary-foreground' : ''}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                  {(filters.type.length > 0 || filters.location.length > 0 || filters.duration.length > 0 || filters.stipendRange[0] > 0 || filters.stipendRange[1] < 25000) && (
                    <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {filters.type.length + filters.location.length + filters.duration.length + (filters.stipendRange[0] > 0 || filters.stipendRange[1] < 25000 ? 1 : 0)}
                    </Badge>
                  )}
                </Button>
              </div>

              {/* Quick Filter Chips */}
              {(filters.type.length > 0 || filters.location.length > 0 || filters.duration.length > 0 || filters.stipendRange[0] > 0 || filters.stipendRange[1] < 25000) && (
                <div className="flex flex-wrap gap-2">
                  {filters.type.map((type) => (
                    <Badge key={type} variant="secondary" className="cursor-pointer">
                      {type}
                      <X 
                        className="ml-1 h-3 w-3" 
                        onClick={() => setFilters(prev => ({ ...prev, type: prev.type.filter(t => t !== type) }))}
                      />
                    </Badge>
                  ))}
                  {filters.location.map((location) => (
                    <Badge key={location} variant="secondary" className="cursor-pointer">
                      📍 {location}
                      <X 
                        className="ml-1 h-3 w-3" 
                        onClick={() => setFilters(prev => ({ ...prev, location: prev.location.filter(l => l !== location) }))}
                      />
                    </Badge>
                  ))}
                  {filters.duration.map((duration) => (
                    <Badge key={duration} variant="secondary" className="cursor-pointer">
                      ⏱️ {duration}
                      <X 
                        className="ml-1 h-3 w-3" 
                        onClick={() => setFilters(prev => ({ ...prev, duration: prev.duration.filter(d => d !== duration) }))}
                      />
                    </Badge>
                  ))}
                  {(filters.stipendRange[0] > 0 || filters.stipendRange[1] < 25000) && (
                    <Badge variant="secondary" className="cursor-pointer">
                      💰 ₹{filters.stipendRange[0].toLocaleString()}-₹{filters.stipendRange[1].toLocaleString()}
                      <X 
                        className="ml-1 h-3 w-3" 
                        onClick={() => setFilters(prev => ({ ...prev, stipendRange: [0, 25000] }))}
                      />
                    </Badge>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setFilters({ type: [], location: [], stipendRange: [0, 25000], duration: [] })}
                    className="h-6 px-2 text-xs"
                  >
                    Clear All
                  </Button>
                </div>
              )}

              {/* Collapsible Filter Panel */}
              <Collapsible open={showFilters} onOpenChange={setShowFilters}>
                <CollapsibleContent>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filter Internships
                      </CardTitle>
                      <CardDescription>
                        Refine your search to find the perfect internship
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {/* Work Type Filter */}
                        <div>
                          <Label className="text-sm font-medium mb-3 block">Work Type</Label>
                          <div className="space-y-3">
                            {['Remote', 'On-site', 'Hybrid'].map((type) => (
                              <div key={type} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`type-${type}`}
                                  checked={filters.type.includes(type)}
                                  onCheckedChange={(checked:any) => {
                                    if (checked) {
                                      setFilters(prev => ({ ...prev, type: [...prev.type, type] }));
                                    } else {
                                      setFilters(prev => ({ ...prev, type: prev.type.filter(t => t !== type) }));
                                    }
                                  }}
                                />
                                <Label htmlFor={`type-${type}`} className="text-sm cursor-pointer">
                                  {type}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Location Filter */}
                        <div>
                          <Label className="text-sm font-medium mb-3 block">Location</Label>
                          <div className="space-y-3 max-h-32 overflow-y-auto">
                            {['Bangalore', 'Mumbai', 'Delhi', 'Pune', 'Hyderabad', 'Chennai', 'Remote'].map((location) => (
                              <div key={location} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`location-${location}`}
                                  checked={filters.location.includes(location)}
                                  onCheckedChange={(checked:any) => {
                                    if (checked) {
                                      setFilters(prev => ({ ...prev, location: [...prev.location, location] }));
                                    } else {
                                      setFilters(prev => ({ ...prev, location: prev.location.filter(l => l !== location) }));
                                    }
                                  }}
                                />
                                <Label htmlFor={`location-${location}`} className="text-sm cursor-pointer">
                                  {location}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Duration Filter */}
                        <div>
                          <Label className="text-sm font-medium mb-3 block">Duration</Label>
                          <div className="space-y-3">
                            {['3 months', '4 months', '5 months', '6 months'].map((duration) => (
                              <div key={duration} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`duration-${duration}`}
                                  checked={filters.duration.includes(duration)}
                                  onCheckedChange={(checked:any) => {
                                    if (checked) {
                                      setFilters(prev => ({ ...prev, duration: [...prev.duration, duration] }));
                                    } else {
                                      setFilters(prev => ({ ...prev, duration: prev.duration.filter(d => d !== duration) }));
                                    }
                                  }}
                                />
                                <Label htmlFor={`duration-${duration}`} className="text-sm cursor-pointer">
                                  {duration}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Stipend Range */}
                        <div>
                          <Label className="text-sm font-medium mb-3 block">Stipend Range (₹/month)</Label>
                          <div className="space-y-4">
                            <Slider
                              value={filters.stipendRange}
                              onValueChange={(value:string) => setFilters((prev:any) => ({ ...prev, stipendRange: value }))}
                              max={25000}
                              step={1000}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>₹{filters.stipendRange[0].toLocaleString()}</span>
                              <span>₹{filters.stipendRange[1].toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-6 pt-4 border-t">
                        <Button 
                          onClick={() => setFilters({ type: [], location: [], stipendRange: [0, 25000], duration: [] })}
                          variant="outline" 
                          className="flex-1"
                        >
                          Clear All Filters
                        </Button>
                        <Button 
                          onClick={() => setShowFilters(false)}
                          className="flex-1"
                        >
                          Apply Filters
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading internships...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="text-sm text-muted-foreground mb-4">
                  Found {filteredInternships.length} internships from various platforms
                </div>
                
                {filteredInternships.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-2">No internships found</p>
                    <p className="text-sm text-muted-foreground">
                      {availableInternships.length === 0 
                        ? "Loading internships from database..." 
                        : "Try adjusting your filters or search query"}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {filteredInternships.map((internship, index) => (
                <motion.div
                  key={internship.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {internship.title}
                            <Badge variant="secondary" className="text-xs">
                              {internship.matchScore}% match
                            </Badge>
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {calculateAcceptanceRate(internship)}% acceptance
                            </Badge>
                          </CardTitle>
                          <CardDescription className="flex items-center gap-4 mt-2">
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-4 w-4" />
                              {internship.company || 'Unknown Company'}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {internship.location || 'Not specified'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {internship.duration || 'Not specified'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Globe className="h-4 w-4" />
                              {internship.source || 'Internova'}
                            </span>
                          </CardDescription>
                        </div>
                        <Badge variant={internship.type === 'Remote' ? 'default' : 'outline'}>
                          {internship.type}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <p className="text-muted-foreground mb-4">{internship.description || 'No description available'}</p>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {(internship.skills || []).map((skill:string) => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>💰 {internship.stipend || 'Not specified'}</span>
                          <span>📅 {internship.posted || 'Recently'}</span>
                          <span>👥 {internship.applicants || 0} applicants</span>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleSaveInternship(internship.id)}
                            className={savedInternships.has(internship.id) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : ''}
                          >
                            <Star className={`mr-2 h-4 w-4 ${savedInternships.has(internship.id) ? 'fill-current' : ''}`} />
                            {savedInternships.has(internship.id) ? 'Saved' : 'Save'}
                          </Button>
                          <Button 
                            size="sm" 
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleApplyInternship(internship.id)}
                            disabled={appliedInternships.has(internship.id)}
                          >
                            {appliedInternships.has(internship.id) ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Applied
                              </>
                            ) : (
                              <>
                                Apply Now
                                <ExternalLink className="ml-2 h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
          
          {/* Profile Builder */}
          <TabsContent value="profile" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile Completion
                  </CardTitle>
                  <CardDescription>
                    Complete your profile to get better internship recommendations and higher acceptance rates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Profile Completion</span>
                      <span>{profileCompletion()}%</span>
                    </div>
                    <Progress value={profileCompletion()} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Complete profiles get 3x better recommendations!
                    </p>
                  </div>
                  {profileCompletion() >= 80 && (
                    <Button 
                      className="mt-4 w-full" 
                      onClick={() => setActiveTab('feed')}
                    >
                      Profile Complete - Browse Internships →
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Photo Upload */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Profile Photo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-20 w-20">
                      {profile.photo ? (
                        <AvatarImage src={profile.photo} alt="Profile" />
                      ) : (
                        <AvatarFallback>
                          <Camera className="h-8 w-8" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <Label htmlFor="photo-upload" className="cursor-pointer">
                        <Button variant="outline" size="sm" asChild>
                          <span>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Photo
                          </span>
                        </Button>
                      </Label>
                      <Input
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload a professional photo to improve your profile visibility
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Resume Upload AI SECTION */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Resume Upload & AI Analysis
                  </CardTitle>
                  <CardDescription>
                    Upload any file (PDF, text, etc.). We'll automatically extract skills and add them to your profile.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {profile.resume && !isParsingResume ? (
                      <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
                        <Check className="h-5 w-5 text-green-600" />
                        <span className="text-sm text-green-800">
                          File processed successfully - Your skills have been extracted and added!
                        </span>
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="resume-upload" className="cursor-pointer">
                          <Button variant="outline" asChild disabled={isParsingResume}>
                            <span>
                              {isParsingResume ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Extracting Skills...
                                </>
                              ) : (
                                <>
                                  <Upload className="mr-2 h-4 w-4" />
                                  Upload Your Resume To Extract Skills
                                </>
                              )}
                            </span>
                          </Button>
                        </Label>
                        <Input
                          id="resume-upload"
                          type="file"
                          className="hidden"
                          onChange={handleResumeUpload}
                          disabled={isParsingResume}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          Resume
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            
            <div className="grid gap-6 md:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Academic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 relative">
                      <Label htmlFor="university">University/College</Label>
                      <Input
                        id="university"
                        placeholder="Search for your college..."
                        value={profile.university || collegeSearch}
                        onChange={(e) => {
                          setCollegeSearch(e.target.value);
                          setShowCollegeDropdown(true);
                        }}
                        onFocus={() => setShowCollegeDropdown(true)}
                      />
                      {showCollegeDropdown && getFilteredColleges().length > 0 && (
                        <div className="absolute z-10 w-full bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {getFilteredColleges().map((college) => (
                            <div
                              key={college}
                              className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                              onClick={() => {
                                updateProfile({ university: college });
                                setCollegeSearch('');
                                setShowCollegeDropdown(false);
                              }}
                            >
                              {college}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="course">Course/Degree</Label>
                      <Select value={profile.course} onValueChange={(value:string) => updateProfile({ course: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your course" />
                        </SelectTrigger>
                        <SelectContent>
                          {courses.map((course) => (
                            <SelectItem key={course} value={course}>{course}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="year">Year of Study</Label>
                        <Select value={profile.year} onValueChange={(value:string) => updateProfile({ year: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            {years.map((year) => (
                              <SelectItem key={year} value={year}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="cgpa">CGPA/Percentage</Label>
                        <Input
                          id="cgpa"
                          placeholder="e.g., 8.5"
                          value={profile.cgpa}
                          onChange={(e) => updateProfile({ cgpa: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="location">Preferred Location</Label>
                      <Select value={profile.location} onValueChange={(value:string) => updateProfile({ location: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select preferred location" />
                        </SelectTrigger>
                        <SelectContent>
                          {indianCities.map((city) => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Skills & Expertise
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Add Skills</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter a skill"
                          value={newSkill}
                          onChange={(e) => setNewSkill(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                        />
                        <Button onClick={addSkill} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Your Skills</Label>
                      <div className="flex flex-wrap gap-2">
                        {(profile.skills || []).map((skill:string, index:any) => (
                          <motion.div
                            key={skill}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <Badge variant="secondary" className="gap-1">
                              {skill}
                              <button onClick={() => removeSkill(skill)}>
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          </motion.div>
                        ))}
                      </div>
                      {(profile.skills || []).length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Add skills to improve your match scores!
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    About Me
                    <div className="flex gap-2">
                      {!profile.bio && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleAIBioCompletion}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          AI Complete Bio
                        </Button>
                      )}
                      {!editingBio && profile.bio && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setEditingBio(true);
                            setTempBio(profile.bio);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Update Bio
                        </Button>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingBio ? (
                    <div className="space-y-4">
                      <Textarea
                        placeholder="Tell us about yourself, your interests, career goals, and what makes you unique..."
                        rows={4}
                        value={tempBio}
                        onChange={(e) => setTempBio(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button onClick={updateBio}>
                          <Check className="h-4 w-4 mr-2" />
                          Update
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setEditingBio(false);
                            setTempBio('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        placeholder="Tell us about yourself, your interests, career goals, and what makes you unique..."
                        rows={4}
                        value={profile.bio}
                        onChange={(e) => updateProfile({ bio: e.target.value })}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
          
          {/* My Activity */}
          <TabsContent value="applications" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Tabs defaultValue="applied" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="applied">Applied ({appliedInternships.size})</TabsTrigger>
                  <TabsTrigger value="starred">Starred ({savedInternships.size})</TabsTrigger>
                  <TabsTrigger value="messages">
                    Messages ({messages.length})
                    {unreadCount > 0 && (
                      <span className="ml-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="applied" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>My Applications</CardTitle>
                      <CardDescription>
                        Track your internship applications and their status
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {applications.length > 0 ? (
                        <div className="space-y-4">
                          {applications.map((application: any) => {
                            const internship = availableInternships.find(i => i.id === application.internshipId);
                            if (!internship) return null;
                            
                            // Determine status badge variant and text
                            let statusVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
                            let statusText = application.status || "Applied";
                            
                            if (application.status === "Accepted") {
                              statusVariant = "default";
                              statusText = "Accepted";
                            } else if (application.status === "Rejected") {
                              statusVariant = "destructive";
                              statusText = "Rejected";
                            } else if (application.status === "Under Review") {
                              statusVariant = "secondary";
                              statusText = "Under Review";
                            }
                            
                            return (
                              <div key={application.id} className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="flex-1">
                                  <h4 className="font-medium">{internship.title}</h4>
                                  <p className="text-sm text-muted-foreground">{internship.company}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{internship.location} • {internship.duration}</p>
                                  {application.appliedAt && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Applied on {new Date(application.appliedAt).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <Badge variant={statusVariant}>{statusText}</Badge>
                                  {application.status === "Accepted" && (
                                    <span className="text-xs text-green-600 font-medium">🎉 Congratulations!</span>
                                  )}
                                  {application.status === "Rejected" && (
                                    <span className="text-xs text-red-600">Better luck next time</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No applications yet</p>
                          <p className="text-sm">Start applying to internships to see them here</p>
                          <Button 
                            variant="outline" 
                            className="mt-4"
                            onClick={() => setActiveTab('feed')}
                          >
                            Browse Internships
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="starred" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Starred Internships</CardTitle>
                      <CardDescription>
                        Internships you've saved for later
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {savedInternships.size > 0 ? (
                        <div className="space-y-4">
                          {Array.from(savedInternships).map((id) => {
                            const internship = availableInternships.find(i => i.id === id);
                            if (!internship) return null;
                            return (
                              <div key={id} className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="flex-1">
                                  <h4 className="font-medium">{internship.title}</h4>
                                  <p className="text-sm text-muted-foreground">{internship.company}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{internship.location} • {internship.duration} • {internship.stipend}</p>
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {(internship.skills || []).slice(0, 3).map((skill: string) => (
                                      <Badge key={skill} variant="outline" className="text-xs">
                                        {skill}
                                      </Badge>
                                    ))}
                                    {(internship.skills || []).length > 3 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{(internship.skills || []).length - 3} more
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleSaveInternship(internship.id)}
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Remove
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={() => handleApplyInternship(internship.id)}
                                    disabled={appliedInternships.has(internship.id)}
                                  >
                                    {appliedInternships.has(internship.id) ? (
                                      <>
                                        <Check className="mr-2 h-4 w-4" />
                                        Applied
                                      </>
                                    ) : (
                                      <>
                                        Apply Now
                                        <ExternalLink className="ml-2 h-4 w-4" />
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No starred internships yet</p>
                          <p className="text-sm">Star internships you're interested in to save them for later</p>
                          <Button 
                            variant="outline" 
                            className="mt-4"
                            onClick={() => setActiveTab('feed')}
                          >
                            Browse Internships
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="messages" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Messages & Notifications
                      </CardTitle>
                      <CardDescription>
                        Messages from companies and application updates
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {messages.length > 0 ? (
                        <div className="space-y-4">
                          {messages.map((message: any) => (
                            <Card 
                              key={message.id} 
                              className={`cursor-pointer transition-all ${
                                !message.read ? 'border-blue-200 bg-blue-50' : ''
                              }`}
                              onClick={() => markMessageAsRead(message.id)}
                            >
                              <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <CardTitle className="text-sm">{message.subject}</CardTitle>
                                      {!message.read && (
                                        <Badge variant="default" className="text-xs h-5">
                                          New
                                        </Badge>
                                      )}
                                      {message.type === 'acceptance' && (
                                        <Badge variant="default" className="text-xs h-5 bg-green-600">
                                          <Check className="h-3 w-3 mr-1" />
                                          Accepted
                                        </Badge>
                                      )}
                                      {message.type === 'interview' && (
                                        <Badge variant="default" className="text-xs h-5 bg-blue-600">
                                          <CalendarDays className="h-3 w-3 mr-1" />
                                          Interview
                                        </Badge>
                                      )}
                                    </div>
                                    <CardDescription className="text-xs">
                                      From: {message.from} • {new Date(message.timestamp).toLocaleDateString()} at {new Date(message.timestamp).toLocaleTimeString()}
                                    </CardDescription>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-sm whitespace-pre-wrap">
                                  {message.content}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No messages yet</p>
                          <p className="text-sm">Messages from companies will appear here</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}