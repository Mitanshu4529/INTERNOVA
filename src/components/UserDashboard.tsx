import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { extractTextFromFile, parseResumeWithAI } from '../utils/resumeParser';
import { recommendationService } from '../services/recommendationService';
import { sameCity } from '../utils/locations';

// Skills to show and search for a listing: its stated skills, or, when it
// states none, the likely skills inferred from its title.
const listingSkills = (internship: any): string[] => {
  const stated = Array.isArray(internship?.skills) ? internship.skills : [];
  if (stated.length > 0) return stated;
  const inferred = internship?.inferredSkills;
  return inferred ? [...(inferred.explicit || []), ...(inferred.typical || [])].slice(0, 6) : [];
};
// Lets Enter or Space activate an element that is clickable but is not a
// native button (filter chips, list rows), so it works from the keyboard.
const activateOnKey = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
};
// Work modes a student can prefer. Select items cannot have an empty value,
// so "no preference" has its own marker and is stored as ''.
const WORK_MODES = ['Remote', 'On-site', 'Hybrid'];
const NO_PREFERENCE = 'none';

// Site name of a listing's original posting, e.g. "internshala.com".
const sourceHost = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'the source site';
  }
};
import type { Internship, UserProfile, RecommendationResult } from '../types/recommendation';
import { normalizeSkills } from '../utils/dataNormalizer';
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
  Loader2,
  Info
} from 'lucide-react';
import { notify } from '../utils/notify';
import { isSupportedPhoto, resizePhoto, PHOTO_MAX_BYTES } from '../utils/image';

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
    // Optional preferences used in matching ('' = no preference).
    preferredWorkMode: '',
    minStipend: '',
    skills: [] as string[],
    experience: [] as any[],
    projects: [] as any[],
    photo: null as string | null,
    resume: null as File | null,
    ...user.profile
  });

  const [newSkill, setNewSkill] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  // The feed can hold thousands of listings; only this many cards are drawn at
  // a time (best matches first), with a button to show more.
  const FEED_PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);
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

  // Recommendation engine results
  const [recommendationResults, setRecommendationResults] = useState<Map<string, RecommendationResult>>(new Map());
  const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());

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

  // Load the saved profile for this account. It arrives with the signed-in user
  // (from the database for real accounts, from the demo store for the demo).
  useEffect(() => {
    if (!user.profile || typeof user.profile !== 'object') return;
    setProfile((prev: any) => ({
      ...prev,
      ...user.profile,
      skills: Array.isArray(user.profile.skills) ? user.profile.skills : prev.skills,
      experience: Array.isArray(user.profile.experience) ? user.profile.experience : prev.experience,
      projects: Array.isArray(user.profile.projects) ? user.profile.projects : prev.projects,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Load ALL data including internships on mount and when user changes
  useEffect(() => {
    const handleInternshipCreated = async (e: CustomEvent) => {
      console.log('Received internship:created event:', e.detail);
      // Re-fetch internships to get the new one
      const updatedInternships = await dataStore.getInternships();
      setAvailableInternships(updatedInternships);
    };

    const handleApplicationStatusChanged = async () => {
      console.log('Received application:status-changed event');
      // Re-fetch applications
      const applicationsData = await dataStore.getApplicationsByStudent(user.id);
      setApplications(applicationsData);
      setAppliedInternships(new Set(applicationsData.map((app: any) => app.internshipId)));
    };

    // Must match the names dispatched by dataStore (they were 'internship:created' /
    // 'application:status-changed' here, so these listeners never fired).
    window.addEventListener('internova:internship-created', handleInternshipCreated as unknown as EventListener);
    window.addEventListener('internova:application-status-changed', handleApplicationStatusChanged as unknown as EventListener);

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

        // Build user profile for recommendation engine
        const userProfile: UserProfile = {
          id: user.id,
          name: user.name,
          email: user.email,
          skills: profile.skills || [],
          location: profile.location || undefined,
          preferredLocation: profile.location || undefined,
          expectedStipend: Number(profile.minStipend) > 0 ? String(profile.minStipend) : undefined,
          preferredWorkMode: WORK_MODES.includes(profile.preferredWorkMode) ? [profile.preferredWorkMode] : undefined,
          experience: 0,
          cgpa: profile.cgpa ? parseFloat(profile.cgpa) : undefined,
          profileCompletion: profileCompletion(),
          university: profile.university,
          course: profile.course,
          year: profile.year
        };

        // Run multi-factor recommendation engine
        let results: RecommendationResult[] = [];
        try {
          const typedInternships: Internship[] = internships.map((i: any) => ({
            id: i.id || '',
            title: i.title || '',
            company: i.company || '',
            location: i.location || '',
            stipend: i.stipend || '',
            duration: i.duration || '',
            description: i.description || '',
            skills: normalizeSkills(Array.isArray(i.skills) ? i.skills.join(', ') : (i.skills || '')),
            inferredSkills: i.inferredSkills,
            type: (i.type || 'On-site') as any,
            status: (i.status || 'Active') as any,
            source: i.source || '',
            companyId: i.companyId || i.company_id || '',
            requirements: i.requirements,
            cgpaRequirement: i.cgpaRequirement || i.cgpa_requirement,
            experienceLevel: i.experienceLevel || i.experience_level
          }));

          results = await recommendationService.getRecommendations(userProfile, typedInternships, 0);
        } catch (recError) {
          console.warn('Recommendation engine failed, falling back to basic scoring:', recError);
          // Fallback: basic scoring
          results = internships.map((internship: any, index: number) => ({
            internship: { ...internship, id: internship.id || '', skills: Array.isArray(internship.skills) ? internship.skills : [] },
            score: {
              totalScore: internship.matchScore || 50,
              factors: [],
              internshipId: internship.id || '',
              matchedSkills: [],
              missingSkills: [],
              explanation: 'Recommendation engine unavailable'
            },
            rank: index + 1
          }));
        }

        // Build a lookup map for quick access
        const resultMap = new Map<string, RecommendationResult>();
        results.forEach(r => resultMap.set(r.internship.id, r));

        // Enrich internships with recommendation scores + applicant counts
        const enrichedInternships = internships.map((internship: any) => {
          const applicantCount = allApplications.filter((app: any) => app.internshipId === internship.id).length;
          const result = resultMap.get(internship.id);
          const matchScore = result?.score.totalScore ?? internship.matchScore ?? 50;

          return {
            ...internship,
            matchScore,
            applicants: applicantCount
          };
        });

        console.log('Enriched internships:', enrichedInternships.length, '(via recommendation engine)');
        setAvailableInternships(enrichedInternships);
        setRecommendationResults(resultMap);
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

    return () => {
      clearInterval(interval);
      window.removeEventListener('internova:internship-created', handleInternshipCreated as unknown as EventListener);
      window.removeEventListener('internova:application-status-changed', handleApplicationStatusChanged as unknown as EventListener);
    };
  // Re-run when anything the match depends on changes. (This used to watch only
  // the number of skills, so changing the location did not re-rank the feed.)
  }, [user.id, user.email, dataStore, (profile.skills || []).join('|'), profile.location, profile.preferredWorkMode, profile.minStipend]);

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
      notify('Failed to save internship. Please try again.');
    }
  };

  const handleApplyInternship = async (id: string) => {
    console.log('handleApplyInternship called with id:', id);
    try {
      // Check if already applied
      if (appliedInternships.has(id)) {
        notify('You have already applied to this internship.');
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

      notify('Application submitted successfully!');
    } catch (error) {
      console.error('Error applying to internship:', error);
      // Revert UI on error
      const updatedApplications = await dataStore.getApplicationsByStudent(user.id);
      setAppliedInternships(new Set(updatedApplications.map((app: any) => app.internshipId)));
      setApplications(updatedApplications);
      notify('Failed to submit application. Please try again.');
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
      notify('Could not save your profile. Please try again.');
    }
  };

  const updateBio = () => {
    updateProfile({ bio: tempBio });
    setEditingBio(false);
    setTempBio('');
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // so choosing the same file again is noticed
    if (!file) return;
    if (!isSupportedPhoto(file)) {
      notify('Please choose a JPEG, PNG, WebP or GIF image for your photo.');
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      notify('That image is larger than 10 MB. Please choose a smaller one.');
      return;
    }
    try {
      // Scaled down in the browser: the photo is stored inside the profile.
      updateProfile({ photo: await resizePhoto(file) });
    } catch (error) {
      console.error('Photo upload failed:', error);
      notify('Could not read that image. Please try a different file.');
    }
  };

  // ============================================================
  //  AI RESUME PARSING LOGIC
  // ============================================================
  // ... inside UserDashboard component ...

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      // Only text-like documents up to 5 MB are read.
      const isSupported = /\.(pdf|txt|md)$/i.test(file.name) || file.type === 'application/pdf' || file.type.startsWith('text/');
      if (!isSupported) {
        notify('Please upload your resume as a PDF or plain-text file.');
        event.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        notify('That file is larger than 5 MB. Please upload a smaller resume.');
        event.target.value = '';
        return;
      }
      setIsParsingResume(true);
      try {
        // 1. Extract raw text from any file type
        const text = await extractTextFromFile(file);

        // 2. Skills found in the resume (may be none)
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

        notify(extractedSkills.length > 0
          ? `Found ${extractedSkills.length} skill${extractedSkills.length === 1 ? '' : 's'} in your resume: ${extractedSkills.join(', ')}. Profile updated.`
          : 'Resume uploaded, but no known skills were found in it. You can add your skills manually.');

      } catch (error) {
        console.error("File parsing failed:", error);
        notify("Could not process file. Please try again.");
      } finally {
        setIsParsingResume(false);
      }
    } else {
      notify('Please select a file');
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
    notify('Bio completed with AI assistance!');
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

  // Get recommendation result for an internship (score breakdown, explanation)
  const getRecommendationResult = (internshipId: string): RecommendationResult | undefined => {
    return recommendationResults.get(internshipId);
  };

  const toggleExplanation = (internshipId: string) => {
    setExpandedExplanations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(internshipId)) newSet.delete(internshipId);
      else newSet.add(internshipId);
      return newSet;
    });
  };

  const filteredInternships = availableInternships.filter(internship => {
    // Text search
    const matchesSearch = (internship.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (internship.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      listingSkills(internship).some((skill:string) => skill.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (internship.location || '').toLowerCase().includes(searchQuery.toLowerCase());

    // Type filter
    const matchesType = filters.type.length === 0 || filters.type.includes(internship.type);

    // Location filter: case-insensitive containment, so "Bangalore" also matches
    // "Bangalore, Karnataka, India".
    const internshipLocation = (internship.location || '').toLowerCase();
    const matchesLocation = filters.location.length === 0 ||
      filters.location.some(loc => internshipLocation.includes(loc.toLowerCase()) || sameCity(loc, internship.location));

    // Stipend filter: only applied once the user has moved the slider. At its
    // default position it used to hide every listing above the slider maximum.
    const stipendAmount = internship.stipendAmount || 0;
    const stipendFilterActive = filters.stipendRange[0] > 0 || filters.stipendRange[1] < 25000;
    const matchesStipend = !stipendFilterActive ||
      (stipendAmount >= filters.stipendRange[0] &&
        (filters.stipendRange[1] >= 25000 || stipendAmount <= filters.stipendRange[1]));

    // Duration filter (case-insensitive: "3 months" vs "3 Months")
    const internshipDuration = (internship.duration || '').toLowerCase();
    const matchesDuration = filters.duration.length === 0 ||
                           filters.duration.some(dur => internshipDuration.includes(dur.toLowerCase()));

    return matchesSearch && matchesType && matchesLocation && matchesStipend && matchesDuration;
  }).sort((a, b) => {
    // Recommendations first: best match on top, newest first among equal scores.
    // (Sorting by date first meant the match score almost never affected the order.)
    const scoreDiff = (b.matchScore || 0) - (a.matchScore || 0);
    if (scoreDiff !== 0) return scoreDiff;
    const dateA = new Date(a.createdAt || a.posted || 0).getTime();
    const dateB = new Date(b.createdAt || b.posted || 0).getTime();
    return (dateB || 0) - (dateA || 0);
  });

  // A new search or filter starts again from the first page of results.
  useEffect(() => {
    setVisibleCount(FEED_PAGE_SIZE);
  }, [searchQuery, filters]);

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
            <button type="button" className="flex items-center space-x-2 cursor-pointer" onClick={handleLogoClick} aria-label="Internova home">
              <span className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center" aria-hidden="true">
                <Target className="h-5 w-5 text-primary-foreground" />
              </span>
              <span className="text-xl font-semibold">Internova</span>
            </button>
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
            <Button variant="ghost" size="sm" onClick={onLogout} aria-label="Log out" title="Log out">
              <LogOut className="h-4 w-4" aria-hidden="true" />
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
      <div className="container py-6" role="main">
        <h1 className="sr-only">Student dashboard</h1>
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
                    aria-label="Search internships, companies, or skills"
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
                        role="button"
                        tabIndex={0}
                        aria-label="Remove this filter"
                        onKeyDown={activateOnKey}
                        className="ml-1 h-3 w-3"
                        onClick={() => setFilters(prev => ({ ...prev, type: prev.type.filter(t => t !== type) }))}
                      />
                    </Badge>
                  ))}
                  {filters.location.map((location) => (
                    <Badge key={location} variant="secondary" className="cursor-pointer">
                      📍 {location}
                      <X
                        role="button"
                        tabIndex={0}
                        aria-label="Remove this filter"
                        onKeyDown={activateOnKey}
                        className="ml-1 h-3 w-3"
                        onClick={() => setFilters(prev => ({ ...prev, location: prev.location.filter(l => l !== location) }))}
                      />
                    </Badge>
                  ))}
                  {filters.duration.map((duration) => (
                    <Badge key={duration} variant="secondary" className="cursor-pointer">
                      ⏱️ {duration}
                      <X
                        role="button"
                        tabIndex={0}
                        aria-label="Remove this filter"
                        onKeyDown={activateOnKey}
                        className="ml-1 h-3 w-3"
                        onClick={() => setFilters(prev => ({ ...prev, duration: prev.duration.filter(d => d !== duration) }))}
                      />
                    </Badge>
                  ))}
                  {(filters.stipendRange[0] > 0 || filters.stipendRange[1] < 25000) && (
                    <Badge variant="secondary" className="cursor-pointer">
                      💰 ₹{filters.stipendRange[0].toLocaleString()}-₹{filters.stipendRange[1].toLocaleString()}
                      <X
                        role="button"
                        tabIndex={0}
                        aria-label="Remove this filter"
                        onKeyDown={activateOnKey}
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
                              onValueChange={(value: number[]) => setFilters((prev:any) => ({ ...prev, stipendRange: value }))}
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
                    {filteredInternships.slice(0, visibleCount).map((internship, index) => (
                <motion.div
                  key={internship.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index % FEED_PAGE_SIZE, 8) * 0.05 }}
                >
                  <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="w-full">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle>{internship.title}</CardTitle>
                            <Badge variant="secondary" className="text-xs">
                              {internship.matchScore}% match
                            </Badge>
                            {internship.type && (
                              <Badge variant={internship.type === 'Remote' ? 'default' : 'outline'}>
                                {internship.type}
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="flex flex-wrap items-center gap-4 mt-2">
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
                              {/^https?:\/\//i.test(internship.source || '') ? (
                                <a
                                  href={internship.source}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:text-blue-600"
                                >
                                  View original listing on {sourceHost(internship.source)}
                                </a>
                              ) : (
                                internship.source || 'Internova'
                              )}
                            </span>
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      {internship.description && (
                        <p className="text-muted-foreground mb-4">{internship.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        {(internship.skills || []).length === 0 && listingSkills(internship).length > 0 && (
                          <span className="text-xs text-muted-foreground" title="This listing does not state its skills; these are inferred from the title.">
                            Likely skills:
                          </span>
                        )}
                        {listingSkills(internship).map((skill:string) => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>

                      {/* Recommendation Breakdown */}
                      {getRecommendationResult(internship.id) && (
                        <div className="bg-gray-50 p-3 rounded-lg mb-4 border border-gray-100">
                          <div
                            className="flex items-center justify-between cursor-pointer"
                            role="button"
                            tabIndex={0}
                            aria-expanded={expandedExplanations.has(internship.id)}
                            onKeyDown={activateOnKey}
                            onClick={() => toggleExplanation(internship.id)}
                          >
                            <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                              <Info className="h-3 w-3" /> Why this match?
                            </span>
                            <span className="text-xs text-gray-500">
                              {expandedExplanations.has(internship.id) ? 'Hide details' : 'Show details'}
                            </span>
                          </div>
                          {expandedExplanations.has(internship.id) && (
                            <div className="mt-3 space-y-2 text-sm">
                              <p className="text-gray-700 italic mb-2">"{getRecommendationResult(internship.id)?.score.explanation}"</p>
                              <div className="grid grid-cols-2 gap-2 match-factor-grid">
                                {getRecommendationResult(internship.id)?.score.factors.filter(factor => factor.applies !== false).map((factor, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-xs" title={factor.details}>
                                    <span className="text-gray-600">{factor.name}</span>
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 bg-gray-200 rounded-full h-1.5" aria-hidden="true">
                                        <div
                                          className={`h-1.5 rounded-full ${
                                            factor.score >= 70 ? 'bg-green-500' :
                                            factor.score >= 40 ? 'bg-yellow-500' : 'bg-gray-400'
                                          }`}
                                          style={{ width: `${Math.max(0, Math.min(100, factor.score))}%` }}
                                        />
                                      </div>
                                      <span className="font-medium w-8 text-right">{Math.round(factor.score)}%</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {/* What the percentage could not take into account, and why. */}
                              {(() => {
                                const unused = (getRecommendationResult(internship.id)?.score.factors || [])
                                  .filter(factor => factor.applies === false && factor.name !== 'Profile Completion Bonus');
                                if (unused.length === 0) return null;
                                return (
                                  <p className="text-xs text-gray-600 pt-1">
                                    Not counted: {unused.map(factor => `${factor.name === 'CGPA Match' ? 'CGPA' : factor.name.replace(' Match', '').toLowerCase()} (${factor.details.charAt(0).toLowerCase()}${factor.details.slice(1)})`).join('; ')}.
                                  </p>
                                );
                              })()}
                              {(getRecommendationResult(internship.id)?.score.matchedSkills.length ?? 0) > 0 && (
                                <div className="pt-2 border-t border-gray-200 mt-2">
                                  <span className="text-xs text-green-700 font-medium">Matched Skills: </span>
                                  {getRecommendationResult(internship.id)?.score.matchedSkills.join(', ')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span>💰 {internship.stipend || 'Not specified'}</span>
                          <span>📅 {internship.posted || 'Recently'}</span>
                          {/* A student can only see their own applications, so a count is
                              shown only when there is one to show (never a false "0"). */}
                          {(internship.applicants || 0) > 0 && (
                            <span>👥 {internship.applicants} applicant{internship.applicants === 1 ? '' : 's'}</span>
                          )}
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
                    {filteredInternships.length > visibleCount && (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <p className="text-sm text-muted-foreground">
                          Showing the {visibleCount} best matches of {filteredInternships.length}
                        </p>
                        <Button variant="outline" onClick={() => setVisibleCount(count => count + FEED_PAGE_SIZE)}>
                          Show {Math.min(FEED_PAGE_SIZE, filteredInternships.length - visibleCount)} more
                        </Button>
                      </div>
                    )}
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
                              role="button"
                              tabIndex={0}
                              onKeyDown={activateOnKey}
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
                        <SelectTrigger id="course" aria-label="Course or degree">
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
                          <SelectTrigger id="year" aria-label="Year of study">
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
                        <SelectTrigger id="location" aria-label="Preferred location">
                          <SelectValue placeholder="Select preferred location" />
                        </SelectTrigger>
                        <SelectContent>
                          {indianCities.map((city) => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Optional preferences: used in the match only when filled in. */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="work-mode">Preferred Work Mode</Label>
                        <Select
                          value={profile.preferredWorkMode || NO_PREFERENCE}
                          onValueChange={(value: string) => updateProfile({ preferredWorkMode: value === NO_PREFERENCE ? '' : value })}
                        >
                          <SelectTrigger id="work-mode" aria-label="Preferred work mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_PREFERENCE}>No preference</SelectItem>
                            {WORK_MODES.map(mode => (
                              <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="min-stipend">Minimum Stipend (₹ per month)</Label>
                        <Input
                          id="min-stipend"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1000}
                          placeholder="No minimum"
                          value={profile.minStipend ?? ''}
                          onChange={(e) => setProfile((prev: any) => ({ ...prev, minStipend: e.target.value }))}
                          onBlur={(e) => {
                            // Saved when the field is left, not on every keystroke.
                            const amount = Math.round(Number(e.target.value));
                            updateProfile({ minStipend: amount > 0 ? String(amount) : '' });
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Work mode and stipend are optional. When filled in, they count towards each listing's match percentage.
                    </p>
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
                          aria-label="Skill to add"
                          value={newSkill}
                          onChange={(e) => setNewSkill(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                        />
                        <Button onClick={addSkill} size="sm" aria-label="Add skill" title="Add skill">
                          <Plus className="h-4 w-4" aria-hidden="true" />
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
                              <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>
                                <X className="h-3 w-3" aria-hidden="true" />
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
                              role="button"
                              tabIndex={0}
                              aria-label={`${message.read ? '' : 'Unread message: '}${message.subject || 'Message'}`}
                              onKeyDown={activateOnKey}
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