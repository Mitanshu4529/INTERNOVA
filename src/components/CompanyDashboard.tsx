import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { 
  Target, 
  LogOut, 
  Building2, 
  Plus, 
  Users, 
  Eye,
  Edit,
  Trash2,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  Star,
  Send,
  ArrowLeft,
  Download,
  MessageSquare,
  CalendarDays,
  Check,
  X as XIcon
} from 'lucide-react';

interface CompanyDashboardProps {
  user: any;
  onLogout: () => void;
  onBack: () => void;
  dataStore: any;
}

// Get real data from dataStore
const getCompanyInternships = (companyId: string, dataStore: any) => {
  return dataStore.getInternshipsByCompany(companyId);
};

const getCompanyApplications = (companyId: string, dataStore: any) => {
  return dataStore.getApplicationsByCompany(companyId);
};

export function CompanyDashboard({ user, onLogout, onBack, dataStore }: CompanyDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [showNewInternshipForm, setShowNewInternshipForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // To force refresh
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [editingInternship, setEditingInternship] = useState<any>(null);
  const [editInternshipData, setEditInternshipData] = useState<any>(null);
  const [newInternship, setNewInternship] = useState({
    title: '',
    location: '',
    type: 'Remote' as 'Remote' | 'On-site' | 'Hybrid',
    duration: '',
    stipend: '',
    description: '',
    skills: '',
    requirements: '',
  });

  // State for real data
  const [companyInternships, setCompanyInternships] = useState<any[]>([]);
  const [companyApplications, setCompanyApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const activeInternships = companyInternships.filter((i: any) => i.status === 'Active');

  // Load data on mount and when refreshKey changes
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        console.log('CompanyDashboard: Loading data for company:', user.id, 'company name:', user.profile?.company || user.name);
        const [internships, applications] = await Promise.all([
          dataStore.getInternshipsByCompany(user.id),
          dataStore.getApplicationsByCompany(user.id)
        ]);
        console.log('CompanyDashboard: Loaded', internships.length, 'internships and', applications.length, 'applications');
        setCompanyInternships(internships);
        setCompanyApplications(applications);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading company data:', error);
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [refreshKey, user.id, user.profile?.company, user.name, dataStore]);

  const handleCreateInternship = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Parse skills string into array
      const skillsArray = newInternship.skills.split(',').map(skill => skill.trim()).filter(Boolean);
      
      // Create internship in dataStore
      const internshipData = {
        title: newInternship.title,
        company: user.profile?.company || user.name,
        location: newInternship.location,
        type: newInternship.type,
        duration: newInternship.duration,
        stipend: `₹${newInternship.stipend}/month`,
        stipendAmount: parseInt(newInternship.stipend),
        description: newInternship.description,
        skills: skillsArray,
        status: 'Active' as const,
        requirements: {
          cgpa: 7.0, // Default requirement
          year: ['2nd Year', '3rd Year', '4th Year'],
          experience: 'Beginner'
        }
      };
      
      await dataStore.createInternship(user.id, internshipData);
      
      // Reset form and switch to internships tab
      setNewInternship({
        title: '',
        location: '',
        type: 'Remote',
        duration: '',
        stipend: '',
        description: '',
        skills: '',
        requirements: '',
      });
      
      setShowNewInternshipForm(false);
      setActiveTab('internships');
      setRefreshKey(prev => prev + 1); // Force refresh
      alert('Internship posted successfully!');
    } catch (error) {
      console.error('Error creating internship:', error);
      alert('Failed to create internship. Please try again.');
    }
  };

  const handleDeleteInternship = async (internshipId: string) => {
    if (confirm('Are you sure you want to delete this internship?')) {
      try {
        await dataStore.deleteInternship(internshipId);
        setRefreshKey(prev => prev + 1); // Force refresh
        alert('Internship deleted successfully!');
      } catch (error) {
        console.error('Error deleting internship:', error);
        alert('Failed to delete internship. Please try again.');
      }
    }
  };

  const handleSendMessage = async (studentEmail: string, type: 'message' | 'interview' | 'acceptance' = 'message') => {
    if (!messageContent.trim()) {
      alert('Please enter a message');
      return;
    }

    let subject = messageSubject || 'Message from ' + (user.profile?.company || user.name);
    let content = messageContent;

    if (type === 'interview') {
      subject = 'Interview Invitation - ' + (user.profile?.company || user.name);
      content = `Dear Student,\n\nWe would like to invite you for an interview.\n\n${messageContent}\n\nBest regards,\n${user.profile?.company || user.name}`;
    } else if (type === 'acceptance') {
      subject = 'Congratulations! Application Accepted';
      content = `Dear Student,\n\nCongratulations! Your profile has been selected for the internship position.\n\n${messageContent}\n\nWe're excited to have you join our team!\n\nBest regards,\n${user.profile?.company || user.name}`;
    }

    try {
      await dataStore.sendMessage(user.email, studentEmail, subject, content, type, selectedStudent?.internshipId);
      
      setMessageDialogOpen(false);
      setMessageContent('');
      setMessageSubject('');
      setRefreshKey(prev => prev + 1); // Refresh to show updated data
      alert('Message sent successfully!');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleAcceptApplication = async (application: any) => {
    try {
      await dataStore.updateApplicationStatus(application.id, 'Accepted');
      
      // Send acceptance message
      const subject = 'Congratulations! Application Accepted';
      const content = `Dear ${application.studentDetails.name},

Congratulations! Your profile has been selected for the ${dataStore.getInternshipById(application.internshipId)?.title} position at ${user.profile?.company || user.name}.

We were impressed by your qualifications and believe you would be a great fit for our team. We're excited to have you join us!

Our HR team will contact you soon with next steps and onboarding information.

Best regards,
${user.profile?.company || user.name} Team`;

      await dataStore.sendMessage(user.email, application.studentDetails.email, subject, content, 'acceptance', application.internshipId);
      
      setRefreshKey(prev => prev + 1);
      alert('Application accepted and student notified!');
    } catch (error) {
      console.error('Error accepting application:', error);
      alert('Failed to accept application. Please try again.');
    }
  };

  const handleRejectApplication = async (application: any) => {
    try {
      await dataStore.updateApplicationStatus(application.id, 'Rejected');
      
      // Send rejection message
      const subject = 'Application Update';
      const content = `Dear ${application.studentDetails.name},

Thank you for your interest in the ${dataStore.getInternshipById(application.internshipId)?.title} position at ${user.profile?.company || user.name}.

After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.

We appreciate the time you took to apply and wish you the best in your future endeavors.

Best regards,
${user.profile?.company || user.name} Team`;

      await dataStore.sendMessage(user.email, application.studentDetails.email, subject, content, 'rejection', application.internshipId);
      
      setRefreshKey(prev => prev + 1);
      alert('Application rejected and student notified.');
    } catch (error) {
      console.error('Error rejecting application:', error);
      alert('Failed to reject application. Please try again.');
    }
  };

  const handleEditInternship = (internship: any) => {
    setEditingInternship(internship);
    setEditInternshipData({
      title: internship.title,
      location: internship.location,
      type: internship.type,
      duration: internship.duration,
      stipend: internship.stipendAmount.toString(),
      description: internship.description,
      skills: internship.skills.join(', ')
    });
  };

  const handleUpdateInternship = async () => {
    if (!editInternshipData.title.trim()) {
      alert('Please enter a title');
      return;
    }

    const skillsArray = editInternshipData.skills.split(',').map((skill: string) => skill.trim()).filter(Boolean);
    
    const updates = {
      title: editInternshipData.title,
      location: editInternshipData.location,
      type: editInternshipData.type,
      duration: editInternshipData.duration,
      stipend: `₹${editInternshipData.stipend}/month`,
      stipendAmount: parseInt(editInternshipData.stipend),
      description: editInternshipData.description,
      skills: skillsArray
    };

    try {
      await dataStore.updateInternship(editingInternship.id, updates);
      setEditingInternship(null);
      setEditInternshipData(null);
      setRefreshKey(prev => prev + 1);
      alert('Internship updated successfully!');
    } catch (error) {
      console.error('Error updating internship:', error);
      alert('Failed to update internship. Please try again.');
    }
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
            <div className="flex items-center space-x-2 cursor-pointer" onClick={onBack}>
              <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                <Target className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold">Internova</span>
              <Badge variant="outline">Company</Badge>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Avatar>
              <AvatarFallback>
                <Building2 className="h-5 w-5" />
              </AvatarFallback>
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

      {/* Main Content */}
      <div className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-muted p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'overview' 
                    ? 'bg-background shadow-sm text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('internships')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'internships' 
                    ? 'bg-background shadow-sm text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                My Listings
              </button>
              <button
                onClick={() => setActiveTab('applicants')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'applicants' 
                    ? 'bg-background shadow-sm text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Applicants
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'create' 
                    ? 'bg-background shadow-sm text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Post New
              </button>
            </div>
          </div>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Internships</p>
                      <p className="text-2xl font-semibold">{activeInternships.length}</p>
                    </div>
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Applicants</p>
                      <p className="text-2xl font-semibold">{companyApplications.length}</p>
                    </div>
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Under Review</p>
                      <p className="text-2xl font-semibold">{companyApplications.filter((app: any) => app.status === 'Applied' || app.status === 'Under Review').length}</p>
                    </div>
                    <Eye className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Accepted</p>
                      <p className="text-2xl font-semibold">{companyApplications.filter((app: any) => app.status === 'Accepted').length}</p>
                    </div>
                    <Star className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Recent Applications</CardTitle>
                <CardDescription>Latest applications to your internships</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {companyApplications.length > 0 ? (
                    companyApplications.slice(0, 3).map((application: any) => {
                      const internship = companyInternships.find((i: any) => i.id === application.internshipId);
                      return (
                        <div key={application.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <Avatar>
                              <AvatarFallback>
                                {application.studentDetails.name.split(' ').map((n: string) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{application.studentDetails.name}</p>
                              <p className="text-sm text-muted-foreground">{internship?.title}</p>
                              <p className="text-xs text-muted-foreground">{application.studentProfile.university} • {application.studentProfile.year}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <Badge variant="outline">{application.status}</Badge>
                            <Badge variant="secondary">
                              {application.studentProfile.cgpa ? `${application.studentProfile.cgpa} CGPA` : 'No CGPA'}
                            </Badge>
                            <Button size="sm" onClick={() => setActiveTab('applicants')}>View Profile</Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No applications yet</p>
                      <p className="text-sm">Applications will appear here once students start applying</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* My Internships Tab */}
          <TabsContent value="internships" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold">My Listings</h2>
                <p className="text-muted-foreground">Manage your posted internship opportunities</p>
              </div>
              <Button onClick={() => setActiveTab('create')}>
                <Plus className="mr-2 h-4 w-4" />
                Post New Internship
              </Button>
            </div>
            
            <div className="grid gap-6">
              {companyInternships.length > 0 ? companyInternships.map((internship: any) => (
                <Card key={internship.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{internship.title}</CardTitle>
                        <CardDescription className="flex items-center gap-4 mt-2">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {internship.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {internship.duration}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {internship.stipend}
                          </span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={internship.status === 'Active' ? 'default' : 'secondary'}>
                          {internship.status}
                        </Badge>
                        <Badge variant="outline">{internship.type}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{internship.description}</p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {internship.skills.map((skill: string) => (
                        <Badge key={skill} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {companyApplications.filter((app: any) => app.internshipId === internship.id).length} applicants
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Posted {internship.posted}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger
                            className="trigger-button-outline"
                            onClick={() => handleEditInternship(internship)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby="edit-internship-description">
                            <DialogHeader>
                              <DialogTitle>Edit Internship</DialogTitle>
                            </DialogHeader>
                            <div id="edit-internship-description" className="sr-only">
                              Edit the details of your internship posting
                            </div>
                            {editInternshipData && (
                              <div className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="edit-title">Internship Title</Label>
                                    <Input
                                      id="edit-title"
                                      value={editInternshipData.title}
                                      onChange={(e) => setEditInternshipData((prev: any[]) => ({ ...prev, title: e.target.value }))}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="edit-location">Location</Label>
                                    <Input
                                      id="edit-location"
                                      value={editInternshipData.location}
                                      onChange={(e) => setEditInternshipData((prev: any[]) => ({ ...prev, location: e.target.value }))}
                                    />
                                  </div>
                                </div>
                                
                                <div className="grid md:grid-cols-3 gap-4">
                                  <div>
                                    <Label htmlFor="edit-type">Work Type</Label>
                                    <Select 
                                      value={editInternshipData.type} 
                                      onValueChange={(value:string) => setEditInternshipData((prev: any) => ({ ...prev, type: value }))}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Remote">Remote</SelectItem>
                                        <SelectItem value="On-site">On-site</SelectItem>
                                        <SelectItem value="Hybrid">Hybrid</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label htmlFor="edit-duration">Duration</Label>
                                    <Input
                                      id="edit-duration"
                                      value={editInternshipData.duration}
                                      onChange={(e) => setEditInternshipData((prev: any) => ({ ...prev, duration: e.target.value }))}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="edit-stipend">Monthly Stipend (₹)</Label>
                                    <Input
                                      id="edit-stipend"
                                      type="number"
                                      value={editInternshipData.stipend}
                                      onChange={(e) => setEditInternshipData((prev: any) => ({ ...prev, stipend: e.target.value }))}
                                    />
                                  </div>
                                </div>
                                
                                <div>
                                  <Label htmlFor="edit-description">Description</Label>
                                  <Textarea
                                    id="edit-description"
                                    rows={4}
                                    value={editInternshipData.description}
                                    onChange={(e) => setEditInternshipData((prev: any) => ({ ...prev, description: e.target.value }))}
                                  />
                                </div>
                                
                                <div>
                                  <Label htmlFor="edit-skills">Skills (comma separated)</Label>
                                  <Input
                                    id="edit-skills"
                                    value={editInternshipData.skills}
                                    onChange={(e) => setEditInternshipData((prev:any) => ({ ...prev, skills: e.target.value }))}
                                  />
                                </div>
                                
                                <div className="flex gap-2">
                                  <Button onClick={handleUpdateInternship} className="flex-1">
                                    Update Internship
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    onClick={() => {
                                      setEditingInternship(null);
                                      setEditInternshipData(null);
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        
                        <Button variant="outline" size="sm" onClick={() => setActiveTab('applicants')}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Applicants
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteInternship(internship.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <div className="text-center py-12">
                  <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No internships posted yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first internship to start attracting talented students</p>
                  <Button onClick={() => setActiveTab('create')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Post Your First Internship
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
          
          {/* Applicants Tab */}
          <TabsContent value="applicants" className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Applicants</h2>
              <p className="text-muted-foreground">Review and manage internship applications</p>
            </div>
            
            <div className="grid gap-6">
              {companyApplications.length > 0 ? companyApplications.map((application: any) => {
                const internship = companyInternships.find((i: any) => i.id === application.internshipId);
                return (
                <Card key={application.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>
                            {application.studentDetails.name.split(' ').map((n: string) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle>{application.studentDetails.name}</CardTitle>
                          <CardDescription>
                            {application.studentProfile.course} • {application.studentProfile.year} • {application.studentProfile.university}
                          </CardDescription>
                          <p className="text-sm text-muted-foreground mt-1">
                            Applied for: {internship?.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {application.studentDetails.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {application.studentProfile.cgpa ? `${application.studentProfile.cgpa} CGPA` : 'No CGPA'}
                        </Badge>
                        <Badge variant="outline">{application.status}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium">CGPA</p>
                        <p className="text-sm text-muted-foreground">
                          {application.studentProfile.cgpa ? `${application.studentProfile.cgpa}/10` : 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Applied</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(application.appliedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Location</p>
                        <p className="text-sm text-muted-foreground">
                          {application.studentProfile.location || 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Bio</p>
                        <p className="text-sm text-muted-foreground">
                          {application.studentProfile.bio ? 
                            `${application.studentProfile.bio.substring(0, 50)}...` : 
                            'No bio provided'
                          }
                        </p>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2">Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {application.studentProfile.skills && application.studentProfile.skills.length > 0 ? (
                          application.studentProfile.skills.map((skill: string) => (
                            <Badge key={skill} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">No skills listed</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      <Dialog>
                        <DialogTrigger className="trigger-button-primary">
                          <Eye className="mr-2 h-4 w-4" />
                          View Full Profile
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby="student-profile-description">
                          <DialogHeader>
                            <DialogTitle>Student Profile - {application.studentDetails.name}</DialogTitle>
                          </DialogHeader>
                          <div id="student-profile-description" className="sr-only">
                            Detailed student profile information including contact details, academic background, skills, and resume
                          </div>
                          <div className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <p className="font-medium">Contact Information</p>
                                <p className="text-sm text-muted-foreground">Email: {application.studentDetails.email}</p>
                                <p className="text-sm text-muted-foreground">Location: {application.studentProfile.location || 'Not specified'}</p>
                              </div>
                              <div>
                                <p className="font-medium">Academic Details</p>
                                <p className="text-sm text-muted-foreground">University: {application.studentProfile.university || 'Not specified'}</p>
                                <p className="text-sm text-muted-foreground">Course: {application.studentProfile.course || 'Not specified'}</p>
                                <p className="text-sm text-muted-foreground">Year: {application.studentProfile.year || 'Not specified'}</p>
                                <p className="text-sm text-muted-foreground">CGPA: {application.studentProfile.cgpa || 'Not specified'}</p>
                              </div>
                            </div>
                            
                            <div>
                              <p className="font-medium mb-2">About</p>
                              <p className="text-sm text-muted-foreground">
                                {application.studentProfile.bio || 'No bio provided'}
                              </p>
                            </div>
                            
                            <div>
                              <p className="font-medium mb-2">Skills</p>
                              <div className="flex flex-wrap gap-2">
                                {application.studentProfile.skills && application.studentProfile.skills.length > 0 ? (
                                  application.studentProfile.skills.map((skill: string) => (
                                    <Badge key={skill} variant="outline" className="text-xs">
                                      {skill}
                                    </Badge>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground">No skills listed</p>
                                )}
                              </div>
                            </div>

                            {application.studentProfile.resume && (
                              <div>
                                <p className="font-medium mb-2">Resume</p>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    // Create a blob URL and download the resume
                                    const resume = application.studentProfile.resume;
                                    if (resume instanceof File) {
                                      const url = URL.createObjectURL(resume);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `${application.studentDetails.name}_Resume.pdf`;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      URL.revokeObjectURL(url);
                                    } else {
                                      alert('Resume file not available for download');
                                    }
                                  }}
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Download Resume
                                </Button>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={messageDialogOpen} onOpenChange={(open: boolean) => {
                        setMessageDialogOpen(open);
                        if (!open) {
                          setSelectedStudent(null);
                          setMessageSubject('');
                          setMessageContent('');
                        }
                      }}>
                        <DialogTrigger 
                          className="trigger-button-outline"
                          onClick={() => {
                            setSelectedStudent({
                              ...application.studentDetails,
                              internshipId: application.internshipId
                            });
                            setMessageSubject('');
                            setMessageContent('');
                            setMessageDialogOpen(true);
                          }}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Contact Student
                        </DialogTrigger>
                        <DialogContent aria-describedby="contact-student-description">
                          <DialogHeader>
                            <DialogTitle>Contact {selectedStudent?.name || 'Student'}</DialogTitle>
                          </DialogHeader>
                          <div id="contact-student-description" className="sr-only">
                            Send a message, schedule an interview, or contact the student about their application
                          </div>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="subject">Subject</Label>
                              <Input
                                id="subject"
                                placeholder="Enter message subject"
                                value={messageSubject}
                                onChange={(e) => setMessageSubject(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="message">Message</Label>
                              <Textarea
                                id="message"
                                placeholder="Enter your message..."
                                rows={4}
                                value={messageContent}
                                onChange={(e) => setMessageContent(e.target.value)}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                onClick={() => handleSendMessage(selectedStudent?.email, 'message')}
                                className="flex-1"
                              >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Send Message
                              </Button>
                              <Button 
                                onClick={() => handleSendMessage(selectedStudent?.email, 'interview')}
                                variant="outline"
                              >
                                <CalendarDays className="mr-2 h-4 w-4" />
                                Book Interview
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAcceptApplication(application)}
                          className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Accept
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleRejectApplication(application)}
                          className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                        >
                          <XIcon className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              }) : (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No applications yet</h3>
                  <p className="text-muted-foreground mb-4">Applications will appear here once students start applying to your internships</p>
                  <Button onClick={() => setActiveTab('internships')}>
                    <Building2 className="mr-2 h-4 w-4" />
                    View My Internships
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
          
          {/* Create New Internship Tab */}
          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Post a New Internship</CardTitle>
                <CardDescription>
                  Create a new internship opportunity to attract talented students
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleCreateInternship} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Internship Title *</Label>
                      <Input
                        id="title"
                        placeholder="e.g., Frontend Developer Intern"
                        value={newInternship.title}
                        onChange={(e) => setNewInternship(prev => ({ ...prev, title: e.target.value }))}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="location">Location *</Label>
                      <Input
                        id="location"
                        placeholder="e.g., San Francisco, CA"
                        value={newInternship.location}
                        onChange={(e) => setNewInternship(prev => ({ ...prev, location: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Work Type *</Label>
                      <Select value={newInternship.type} onValueChange={(value:string) => setNewInternship((prev:any) => ({ ...prev, type: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Remote">Remote</SelectItem>
                          <SelectItem value="On-site">On-site</SelectItem>
                          <SelectItem value="Hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration *</Label>
                      <Input
                        id="duration"
                        placeholder="e.g., 3 months"
                        value={newInternship.duration}
                        onChange={(e) => setNewInternship(prev => ({ ...prev, duration: e.target.value }))}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="stipend">Monthly Stipend (₹) *</Label>
                      <Input
                        id="stipend"
                        type="number"
                        placeholder="e.g., 15000"
                        value={newInternship.stipend}
                        onChange={(e) => setNewInternship(prev => ({ ...prev, stipend: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Job Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the internship role, responsibilities, and what the intern will learn..."
                      rows={4}
                      value={newInternship.description}
                      onChange={(e) => setNewInternship(prev => ({ ...prev, description: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="skills">Required Skills *</Label>
                    <Input
                      id="skills"
                      placeholder="e.g., React, JavaScript, CSS, Git (comma separated)"
                      value={newInternship.skills}
                      onChange={(e) => setNewInternship(prev => ({ ...prev, skills: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="requirements">Additional Requirements</Label>
                    <Textarea
                      id="requirements"
                      placeholder="Any additional requirements, qualifications, or preferences..."
                      rows={3}
                      value={newInternship.requirements}
                      onChange={(e) => setNewInternship(prev => ({ ...prev, requirements: e.target.value }))}
                    />
                  </div>
                  
                  <div className="flex gap-4">
                    <Button type="submit" className="flex-1">
                      Post Internship
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setActiveTab('overview')}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Action Button */}
      {activeTab !== 'create' && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
            onClick={() => setActiveTab('create')}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}