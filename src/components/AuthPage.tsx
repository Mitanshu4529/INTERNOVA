  import React, { useState } from 'react';
  import { Button } from './ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
  import { Input } from './ui/input';
  import { Label } from './ui/label';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
  import { RadioGroup, RadioGroupItem } from './ui/radio-group';
  import { ArrowLeft, Target, User, Building2 } from 'lucide-react';
  
  interface AuthPageProps {
    onLogin: (email: string, password: string, name?: string, userType?: 'user' | 'company', companyName?: string) => Promise<{ success: boolean; error?: string; user?: any }>;
    onBack: () => void;
    dataStore: any;
    suggestedUserType?: 'user' | 'company' | null;
  }
  
  export function AuthPage({ onLogin, onBack, dataStore, suggestedUserType }: AuthPageProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [userType, setUserType] = useState<'user' | 'company'>(suggestedUserType || 'user');
    const [formData, setFormData] = useState({
      name: '',
      email: '',
      password: '',
      company: '',
    });
    const [error, setError] = useState('');
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      
      if (!formData.email || !formData.password) {
        setError('Please enter both email and password');
        return;
      }
      
      const email = formData.email.toLowerCase().trim();
      
      // For registration, need name and company name (if company)
      let name = formData.name?.trim();
      let companyName = formData.company?.trim();
      
      if (!isLogin) {
        if (!name) {
          setError('Please enter your name');
          return;
        }
        if (userType === 'company' && !companyName) {
          setError('Please enter your company name');
          return;
        }
      }
      
      const result = await onLogin(email, formData.password, name, userType, companyName);
      
      if (!result.success) {
        setError(result.error || 'Something went wrong');
      }
    };
  
    const handleInputChange = (field: string, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
    };
  
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <div className="w-full max-w-md">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
  
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="h-12 w-12 bg-primary rounded-lg flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <CardTitle>
                {isLogin ? 'Welcome Back' : suggestedUserType === 'company' ? 'Join as Company' : 'Get Started'}
              </CardTitle>
              <CardDescription>
                {isLogin ? 'Sign in to your account' : 
                 suggestedUserType === 'company' ? 'Create your company account and start posting opportunities' :
                 'Create your account and start your journey'}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Tabs value={isLogin ? 'login' : 'register'} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login" onClick={() => {
                    setIsLogin(true);
                    setError('');
                    setFormData({ name: '', email: '', password: '', company: '' });
                  }}>
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="register" onClick={() => {
                    setIsLogin(false);
                    setError('');
                    setFormData({ name: '', email: '', password: '', company: '' });
                  }}>
                    Sign Up
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="login" className="space-y-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <Label>Account Type</Label>
                      <RadioGroup value={userType} onValueChange={(value: 'user' | 'company') => setUserType(value)}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="user" id="user" />
                          <Label htmlFor="user" className="flex items-center cursor-pointer">
                            <User className="mr-2 h-4 w-4" />
                            Student/Intern
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="company" id="company" />
                          <Label htmlFor="company" className="flex items-center cursor-pointer">
                            <Building2 className="mr-2 h-4 w-4" />
                            Company/Recruiter
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                    
                    {error && (
                      <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                        {error}
                      </div>
                    )}
                    
                    <Button type="submit" className="w-full">
                      Sign In
                    </Button>
                    
                    <div className="text-center mt-4">
                      <p className="text-sm text-muted-foreground">
                        New user?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setIsLogin(false);
                            setError('');
                            setFormData({ name: '', email: '', password: '', company: '' });
                          }}
                          className="text-primary hover:underline font-medium"
                        >
                          Register now
                        </button>
                      </p>
                    </div>
                    
                    <div className="text-xs text-muted-foreground text-center mt-4 p-3 bg-muted/50 rounded-lg">
                      <p className="mb-2">Test credentials:</p>
                      <p><strong>Student:</strong> student@test.com / password123</p>
                      <p><strong>Companies:</strong></p>
                      <p>google@company.com / test123</p>
                      <p>microsoft@company.com / test123</p>
                      <p>amazon@company.com / test123</p>
                      <p>meta@company.com / test123</p>
                    </div>
                  </form>
                </TabsContent>
                
                <TabsContent value="register" className="space-y-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        placeholder="Enter your full name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email-register">Email</Label>
                      <Input
                        id="email-register"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password-register">Password</Label>
                      <Input
                        id="password-register"
                        type="password"
                        placeholder="Create a password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <Label>Account Type</Label>
                      <RadioGroup value={userType} onValueChange={(value: 'user' | 'company') => setUserType(value)}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="user" id="user-register" />
                          <Label htmlFor="user-register" className="flex items-center cursor-pointer">
                            <User className="mr-2 h-4 w-4" />
                            Student/Intern
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="company" id="company-register" />
                          <Label htmlFor="company-register" className="flex items-center cursor-pointer">
                            <Building2 className="mr-2 h-4 w-4" />
                            Company/Recruiter
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                    
                    {userType === 'company' && (
                      <div className="space-y-2">
                        <Label htmlFor="company-name">Company Name *</Label>
                        <Input
                          id="company-name"
                          placeholder="Enter your company name"
                          value={formData.company}
                          onChange={(e) => handleInputChange('company', e.target.value)}
                          required
                        />
                      </div>
                    )}
                    
                    {error && (
                      <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                        {error}
                      </div>
                    )}
                    
                    <Button type="submit" className="w-full">
                      Create Account
                    </Button>
                    
                    <div className="text-center mt-4">
                      <p className="text-sm text-muted-foreground">
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setIsLogin(true);
                            setError('');
                            setFormData({ name: '', email: '', password: '', company: '' });
                          }}
                          className="text-primary hover:underline font-medium"
                        >
                          Sign in here
                        </button>
                      </p>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }