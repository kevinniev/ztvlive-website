import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  FileText, CheckCircle, AlertTriangle, Shield, Scale, 
  Music, Video, Copyright, DollarSign, AlertCircle,
  ChevronDown, ChevronUp, ArrowRight, Loader2, Tv, ArrowLeft
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";

const API = '/api';

const CreatorAgreementPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [sections, setSections] = useState({
    rights: false,
    music: false,
    indemnity: false,
    content: false,
    revenue: false
  });
  const [submitting, setSubmitting] = useState(false);
  const [hasExistingAgreement, setHasExistingAgreement] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      if (!token) {
        navigate("/login?redirect=/creator-agreement");
        return;
      }

      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data) {
        setUser(response.data);
        // Check if user already accepted agreement
        const agreementCheck = await axios.get(`${API}/content-review/agreement-status`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { accepted: false } }));
        
        setHasExistingAgreement(agreementCheck.data?.accepted || false);
      }
    } catch (error) {
      navigate("/login?redirect=/creator-agreement");
    } finally {
      setLoading(false);
    }
  };

  const allSectionsRead = Object.values(sections).every(v => v);

  const handleAcceptAgreement = async () => {
    if (!allSectionsRead) {
      toast.error("Please read all sections before accepting");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      await axios.post(`${API}/content-review/accept-agreement`, {
        user_id: user?.user_id,
        accepted_at: new Date().toISOString(),
        ip_address: "recorded_server_side",
        sections_read: sections
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success("Agreement accepted! You can now upload content.");
      navigate("/upload-and-earn");
    } catch (error) {
      toast.error("Failed to save agreement. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSection = (section) => {
    setSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (hasExistingAgreement) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        {/* Navigation Header */}
        <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Tv className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">ZTVLIVE</span>
            </Link>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-zinc-400">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/creator/dashboard")}>
                Dashboard
              </Button>
            </div>
          </div>
        </header>
        
        <div className="py-12 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-4">Agreement Already Accepted</h1>
            <p className="text-zinc-400 mb-8">
              You've already accepted the Creator Agreement. You're all set to upload content!
            </p>
            <Button onClick={() => navigate("/upload-and-earn")} className="bg-red-600 hover:bg-red-700">
              Go to Upload & Earn
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Navigation Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">ZTVLIVE</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-zinc-400">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/creator/dashboard")}>
              Dashboard
            </Button>
          </div>
        </div>
      </header>
      
      {/* Header */}
      <div className="bg-gradient-to-r from-red-900/30 to-zinc-900 border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-4">
            <Scale className="w-10 h-10 text-red-500" />
            <div>
              <h1 className="text-3xl font-bold">Creator Content Agreement</h1>
              <p className="text-zinc-400">Required before uploading content to ZTVLIVE</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Important Notice */}
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-yellow-400">Important: Please Read Carefully</h3>
              <p className="text-zinc-300 text-sm mt-1">
                This agreement protects both you and ZTVLIVE. By accepting, you certify that you have 
                the rights to all content you upload and accept responsibility for any copyright issues.
              </p>
            </div>
          </div>
        </div>

        {/* Agreement Sections */}
        <div className="space-y-4 mb-8">
          {/* Section 1: Content Rights */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection("rights")}
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Copyright className="w-5 h-5 text-red-400" />
                <span className="font-semibold">1. Content Ownership & Rights</span>
                {sections.rights && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              </div>
              {sections.rights ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {sections.rights && (
              <div className="p-4 pt-0 border-t border-zinc-800 text-zinc-300 text-sm space-y-3">
                <p><strong>1.1</strong> I certify that I am the original creator and sole owner of all content I upload, OR I have obtained written permission from all rights holders to distribute this content.</p>
                <p><strong>1.2</strong> I grant ZTVLIVE a non-exclusive, worldwide, royalty-free license to broadcast, stream, display, and promote my content across all platforms including but not limited to: web, mobile apps, smart TV apps (Roku, Fire TV, Samsung, LG), and syndication partners.</p>
                <p><strong>1.3</strong> I retain ownership of my original content. This license does not transfer ownership to ZTVLIVE.</p>
                <p><strong>1.4</strong> I understand that ZTVLIVE may use thumbnails, clips (under 60 seconds), and metadata from my content for promotional purposes.</p>
                <p><strong>1.5</strong> I can request removal of my content at any time by contacting support@ztvlivestream.com. Removal will be processed within 7 business days.</p>
              </div>
            )}
          </div>

          {/* Section 2: Music & Audio Rights */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection("music")}
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Music className="w-5 h-5 text-purple-400" />
                <span className="font-semibold">2. Music & Audio Licensing</span>
                {sections.music && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              </div>
              {sections.music ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {sections.music && (
              <div className="p-4 pt-0 border-t border-zinc-800 text-zinc-300 text-sm space-y-3">
                <p><strong>2.1</strong> I certify that ALL music and audio in my content falls into one of these categories:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Original music I created and own</li>
                  <li>Royalty-free music with a valid commercial license (Epidemic Sound, Artlist, etc.)</li>
                  <li>Creative Commons music used according to its license terms</li>
                  <li>Music I have obtained a sync license for TV/streaming distribution</li>
                  <li>Public domain music</li>
                </ul>
                <p><strong>2.2</strong> I understand that content containing unlicensed copyrighted music may be:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Rejected during review</li>
                  <li>Muted or removed after broadcast</li>
                  <li>Subject to DMCA takedown requests</li>
                </ul>
                <p><strong>2.3</strong> I agree to provide music cue sheets upon request, listing all tracks used, their composers, publishers, and duration.</p>
                <p><strong>2.4</strong> If my content receives a copyright claim, I am solely responsible for resolving it.</p>
              </div>
            )}
          </div>

          {/* Section 3: Indemnification */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection("indemnity")}
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-400" />
                <span className="font-semibold">3. Indemnification & Liability</span>
                {sections.indemnity && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              </div>
              {sections.indemnity ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {sections.indemnity && (
              <div className="p-4 pt-0 border-t border-zinc-800 text-zinc-300 text-sm space-y-3">
                <p><strong>3.1</strong> I agree to indemnify, defend, and hold harmless ZTVLIVE, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including legal fees) arising from:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Copyright or trademark infringement in my content</li>
                  <li>Breach of this agreement</li>
                  <li>Any third-party claims related to my content</li>
                </ul>
                <p><strong>3.2</strong> ZTVLIVE is not liable for any revenue loss if content is removed due to copyright issues.</p>
                <p><strong>3.3</strong> I understand that repeat copyright violations may result in permanent account termination.</p>
              </div>
            )}
          </div>

          {/* Section 4: Content Standards */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection("content")}
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Video className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold">4. Content Standards & Review</span>
                {sections.content && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              </div>
              {sections.content ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {sections.content && (
              <div className="p-4 pt-0 border-t border-zinc-800 text-zinc-300 text-sm space-y-3">
                <p><strong>4.1</strong> All content will be reviewed before broadcast. Review typically takes 24-72 hours.</p>
                <p><strong>4.2</strong> Content may be rejected for:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Suspected copyright infringement</li>
                  <li>Hate speech, harassment, or discrimination</li>
                  <li>Explicit adult content without proper labeling</li>
                  <li>Dangerous or illegal activities</li>
                  <li>Misleading content or scams</li>
                  <li>Poor technical quality (resolution, audio)</li>
                </ul>
                <p><strong>4.3</strong> ZTVLIVE reserves the right to reject or remove content at any time without explanation.</p>
                <p><strong>4.4</strong> I agree to respond to any content disputes within 48 hours of notification.</p>
              </div>
            )}
          </div>

          {/* Section 5: Revenue Sharing */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection("revenue")}
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-yellow-400" />
                <span className="font-semibold">5. Revenue Sharing & Payments</span>
                {sections.revenue && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              </div>
              {sections.revenue ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {sections.revenue && (
              <div className="p-4 pt-0 border-t border-zinc-800 text-zinc-300 text-sm space-y-3">
                <p><strong>5.1</strong> Revenue is generated from advertisements displayed during or around my content.</p>
                <p><strong>5.2</strong> Current revenue share: Creators receive 70% of net advertising revenue attributable to their content views.</p>
                <p><strong>5.3</strong> Payments are processed monthly for balances over $50 USD.</p>
                <p><strong>5.4</strong> I am responsible for all applicable taxes on my earnings.</p>
                <p><strong>5.5</strong> Revenue share percentages may change with 30 days notice.</p>
              </div>
            )}
          </div>
        </div>

        {/* Agreement Acceptance */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-6">
            <Checkbox
              id="accept"
              checked={agreementAccepted}
              onCheckedChange={setAgreementAccepted}
              disabled={!allSectionsRead}
              className="mt-1"
            />
            <label htmlFor="accept" className={`text-sm ${!allSectionsRead ? 'text-zinc-500' : 'text-white'}`}>
              I have read and understood all sections of this Creator Content Agreement. I certify that I have the rights 
              to all content I will upload and accept full responsibility for any copyright or legal issues that may arise. 
              I agree to all terms and conditions outlined above.
            </label>
          </div>

          {!allSectionsRead && (
            <p className="text-yellow-500 text-sm mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Please click on each section above to read the full terms
            </p>
          )}

          <div className="flex gap-4">
            <Button
              onClick={handleAcceptAgreement}
              disabled={!agreementAccepted || !allSectionsRead || submitting}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Accept Agreement & Continue
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="border-zinc-700"
            >
              Cancel
            </Button>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-zinc-500 text-xs mt-8">
          Last updated: April 2026 • Questions? Contact legal@ztvlivestream.com
        </p>
      </div>
    </div>
  );
};

export default CreatorAgreementPage;
