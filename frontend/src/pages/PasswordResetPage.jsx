import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, Mail, CheckCircle, Tv } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function PasswordResetPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await axios.post(`${API}/api/auth/password-reset`, { email });
      setSubmitted(true);
    } catch (err) {
      // Always show success to prevent email enumeration
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Tv className="w-8 h-8 text-red-600" />
            <span className="text-2xl font-bold text-white">ZTVLIVE</span>
          </div>
          <CardTitle className="text-2xl text-white">
            {submitted ? 'Check Your Email' : 'Reset Password'}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {submitted 
              ? 'If an account exists with that email, you will receive password reset instructions.'
              : 'Enter your email address and we\'ll send you a link to reset your password.'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {submitted ? (
            <div className="text-center py-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-zinc-300 mb-6">
                Please check your inbox and follow the instructions to reset your password.
              </p>
              <Link to="/login">
                <Button className="w-full bg-red-600 hover:bg-red-500">
                  Return to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                    data-testid="reset-email-input"
                  />
                </div>
              </div>
              
              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-red-600 hover:bg-red-500"
                disabled={loading}
                data-testid="reset-submit-btn"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          )}
          
          <div className="mt-6 text-center">
            <Link 
              to="/login" 
              className="text-zinc-400 hover:text-white text-sm inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
