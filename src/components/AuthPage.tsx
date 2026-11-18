  import React, { useState } from 'react';
  import { Button } from './ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
  import { Input } from './ui/input';
  import { Label } from './ui/label';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
  import { RadioGroup, RadioGroupItem } from './ui/radio-group';
  import { ArrowLeft, Target, User, Building2, FlaskConical } from 'lucide-react';
  import { DEMO_COMPANIES } from '../utils/api';

  interface AuthPageProps {
    onLogin: (email: string, password: string, name?: string, userType?: 'user' | 'company', companyName?: string) => Promise<{ success: boolean; error?: string; user?: any; needsEmailConfirmation?: boolean; message?: string }>;
    /** Starts the browser-only demo (no account, nothing saved to the database). */
    onStartDemo: (type: 'user' | 'company', companySlug?: string) => void;
    onBack: () => void;
    dataStore: any;
    suggestedUserType?: 'user' | 'company' | null;
  }

  export function AuthPage({ onLogin, onStartDemo, onBack, suggestedUserType }: AuthPageProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [userType, setUserType] = useState<'user' | 'company'>(suggestedUserType || 'user');
    const [formData, setFormData] = useState({
      name: '',
      email: '',
      password: '',
      company: '',
    });
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [demoCompany, setDemoCompany] = useState(DEMO_COMPANIES[0].slug);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setError('');
      setNotice('');

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
        if (formData.password.length < 8) {
          setError('Password must be at least 8 characters long');
          return;
        }
      }

      setSubmitting(true);
      try {
        // Signing in sends no name: the account type comes from the server, not from this form.
        const result = isLogin
          ? await onLogin(email, formData.password)
          : await onLogin(email, formData.password, name, userType, companyName);

        if (!result.success) {
          setError(result.error || 'Something went wrong');
        } else if (result.needsEmailConfirmation) {
          // Account created, but it cannot be used until the emailed link is opened.
          setNotice(result.message || 'Check your email for a confirmation link, then sign in.');
          setIsLogin(true);
          setFormData({ name: '', email, password: '', company: '' });
        }
      } catch (err: any) {
        setError(err?.message || 'Something went wrong');
      } finally {
        setSubmitting(false);
      }
    };

    const handleInputChange = (field: string, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4" role="main">
        <h1 className="sr-only">Sign in to Internova</h1>
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
                    setNotice('');
                    setFormData({ name: '', email: '', password: '', company: '' });
                  }}>
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="register" onClick={() => {
                    setIsLogin(false);
                    setError('');
                    setNotice('');
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
                        autoComplete="email"
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
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                      />
                    </div>

                    {notice && (
                      <div role="status" className="text-sm bg-muted p-3 rounded-lg">
                        {notice}
                      </div>
                    )}

                    {error && (
                      <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                        {error}
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? 'Signing in…' : 'Sign In'}
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
                        autoComplete="email"
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
                        autoComplete="new-password"
                        minLength={8}
                        placeholder="Create a password (at least 8 characters)"
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

                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? 'Creating account…' : 'Create Account'}
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

              {/* Browser-only demo: no account, nothing is written to the database. */}
              <div className="mt-6 pt-6 border-t space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FlaskConical className="h-4 w-4" />
                  Just looking? Try the demo
                </div>
                <p className="text-xs text-muted-foreground">
                  No account needed. Everything you do in the demo stays in this browser and is never saved to Internova.
                </p>
                <Button type="button" variant="outline" className="w-full" onClick={() => onStartDemo('user')}>
                  <User className="mr-2 h-4 w-4" />
                  Explore as a demo student
                </Button>
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label="Demo company"
                    value={demoCompany}
                    onChange={(e) => setDemoCompany(e.target.value)}
                    className="flex-1 min-w-0 h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    {DEMO_COMPANIES.map(company => (
                      <option key={company.slug} value={company.slug}>{company.name}</option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" onClick={() => onStartDemo('company', demoCompany)}>
                    <Building2 className="mr-2 h-4 w-4" />
                    Demo company
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }