import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle, XCircle, AlertTriangle, Music, Video, 
  Copyright, Shield, HelpCircle, ExternalLink, FileText,
  Mic, Image, Film, Volume2, Scale, BookOpen, Tv, ArrowLeft
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

const ContentGuidelinesPage = () => {
  const navigate = useNavigate();
  
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
            <Button variant="outline" size="sm" onClick={() => navigate("/upload")}>
              Upload Content
            </Button>
          </div>
        </div>
      </header>
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/30 to-zinc-900 border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-10 h-10 text-blue-500" />
            <div>
              <h1 className="text-3xl font-bold">Content Guidelines</h1>
              <p className="text-zinc-400">What you can and can't upload to ZTVLIVE</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Quick Summary */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-emerald-900/20 border border-emerald-700 rounded-lg p-4">
            <h3 className="font-semibold text-emerald-400 flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5" />
              Allowed Content
            </h3>
            <ul className="text-sm text-zinc-300 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                Original content you created
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                Content with royalty-free music
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                Licensed content you have rights to distribute
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                Public domain material
              </li>
            </ul>
          </div>
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <h3 className="font-semibold text-red-400 flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5" />
              Not Allowed
            </h3>
            <ul className="text-sm text-zinc-300 space-y-2">
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                Copyrighted music without license
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                Movie/TV clips you don't own
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                Re-uploaded content from other creators
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                Content that violates others' rights
              </li>
            </ul>
          </div>
        </div>

        {/* Music Section */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="p-4 bg-purple-900/20 border-b border-zinc-800">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Music className="w-6 h-6 text-purple-400" />
              Music & Audio Guidelines
            </h2>
            <p className="text-zinc-400 text-sm mt-1">
              Music is the #1 reason content gets flagged or removed
            </p>
          </div>
          <div className="p-4 space-y-4">
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-yellow-400">Why This Matters</h4>
                  <p className="text-sm text-zinc-300 mt-1">
                    Unlike YouTube, we broadcast to TV platforms (Roku, Fire TV, Samsung) that have strict 
                    music licensing requirements. Content with unlicensed music can get our entire channel 
                    removed from these platforms.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-emerald-400 mb-2">Safe Music Sources</h4>
                <ul className="text-sm text-zinc-300 space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>YouTube Audio Library (free)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Epidemic Sound (subscription)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Artlist (subscription)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Uppbeat (free tier available)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Your own original music</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-red-400 mb-2">Will Get Flagged</h4>
                <ul className="text-sm text-zinc-300 space-y-2">
                  <li className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span>Popular songs (Drake, Taylor Swift, etc.)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span>Movie/TV show soundtracks</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span>Video game music</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span>"No copyright" YouTube channels</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span>Covers of copyrighted songs</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">What About "Royalty-Free" Music from YouTube?</h4>
              <p className="text-sm text-zinc-300">
                Many "royalty-free" or "no copyright" music channels on YouTube are NOT actually cleared 
                for TV broadcast. They often have licenses only for YouTube uploads, not for distribution 
                to platforms like Roku or Samsung TV. Always check the actual license terms and use 
                official music licensing services.
              </p>
            </div>
          </div>
        </section>

        {/* Video Content Section */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="p-4 bg-blue-900/20 border-b border-zinc-800">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Video className="w-6 h-6 text-blue-400" />
              Video Content Guidelines
            </h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-emerald-400 mb-2">Allowed</h4>
                <ul className="text-sm text-zinc-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Content you filmed yourself</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Screen recordings of your own gameplay</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Animation/graphics you created</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Stock footage with commercial license</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Public domain footage</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-red-400 mb-2">Not Allowed</h4>
                <ul className="text-sm text-zinc-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Movie or TV show clips</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Re-uploads of other creators' videos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Sports broadcasts (NFL, NBA, etc.)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>News footage from networks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Concert footage you didn't film</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-zinc-800 rounded-lg p-4">
              <h4 className="font-semibold mb-2">What About Commentary/Reaction Videos?</h4>
              <p className="text-sm text-zinc-300">
                Fair use is a gray area. While brief clips with substantial commentary may qualify as fair use, 
                we cannot guarantee protection against copyright claims. If you include clips from others' content:
              </p>
              <ul className="text-sm text-zinc-400 mt-2 space-y-1">
                <li>• Keep clips very short (under 10 seconds)</li>
                <li>• Add substantial original commentary</li>
                <li>• Be prepared for potential claims</li>
                <li>• Consider using audio-only or screenshots instead</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Content Standards */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="p-4 bg-red-900/20 border-b border-zinc-800">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-red-400" />
              Community Standards
            </h2>
            <p className="text-zinc-400 text-sm mt-1">
              Content that violates these standards will be rejected or removed
            </p>
          </div>
          <div className="p-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-red-400 mb-3">Prohibited Content</h4>
                <ul className="text-sm text-zinc-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Hate speech or discrimination</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Harassment or bullying</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Violence or graphic content</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Dangerous activities</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Illegal activities</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Misinformation or scams</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Explicit adult content (without age-gate)</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-yellow-400 mb-3">Technical Requirements</h4>
                <ul className="text-sm text-zinc-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <span>Minimum 720p resolution</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <span>Clear audio (no major distortion)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <span>No watermarks from other platforms</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <span>No embedded ads or promotions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <span>Maximum 2 hours per video</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Review Process */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="p-4 bg-emerald-900/20 border-b border-zinc-800">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-emerald-400" />
              Our Review Process
            </h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-zinc-800 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                  1
                </div>
                <h4 className="font-semibold mb-2">Automated Scan</h4>
                <p className="text-sm text-zinc-400">
                  AI checks for copyrighted music and flagged content
                </p>
              </div>
              <div className="text-center p-4 bg-zinc-800 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                  2
                </div>
                <h4 className="font-semibold mb-2">Human Review</h4>
                <p className="text-sm text-zinc-400">
                  Our team reviews flagged content and spot-checks submissions
                </p>
              </div>
              <div className="text-center p-4 bg-zinc-800 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                  3
                </div>
                <h4 className="font-semibold mb-2">Approval</h4>
                <p className="text-sm text-zinc-400">
                  Approved content goes live within 24-72 hours
                </p>
              </div>
            </div>

            <div className="bg-zinc-800 rounded-lg p-4">
              <h4 className="font-semibold mb-2">What Happens If My Content Is Flagged?</h4>
              <ul className="text-sm text-zinc-300 space-y-2">
                <li>1. You'll receive an email explaining the issue</li>
                <li>2. You have 48 hours to respond with documentation (licenses, cue sheets, etc.)</li>
                <li>3. If resolved, content will be approved. If not, it will be rejected.</li>
                <li>4. Repeated violations may result in account restrictions.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="p-4 bg-zinc-800 border-b border-zinc-700">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-zinc-400" />
              Frequently Asked Questions
            </h2>
          </div>
          <div className="divide-y divide-zinc-800">
            <div className="p-4">
              <h4 className="font-semibold mb-2">Can I use music if I credit the artist?</h4>
              <p className="text-sm text-zinc-400">
                No. Credit does not equal a license. You still need explicit permission or a proper license to use copyrighted music.
              </p>
            </div>
            <div className="p-4">
              <h4 className="font-semibold mb-2">My content is fine on YouTube. Why might it get flagged here?</h4>
              <p className="text-sm text-zinc-400">
                YouTube has licensing deals with major labels that allow them to monetize copyrighted music. We broadcast to TV platforms that don't have these deals, so stricter rules apply.
              </p>
            </div>
            <div className="p-4">
              <h4 className="font-semibold mb-2">Can I dispute a copyright flag?</h4>
              <p className="text-sm text-zinc-400">
                Yes. Email content@ztvlivestream.com with proof of your license or rights to the flagged material.
              </p>
            </div>
            <div className="p-4">
              <h4 className="font-semibold mb-2">What's a music cue sheet and do I need one?</h4>
              <p className="text-sm text-zinc-400">
                A cue sheet lists all music used in your content with composer, publisher, and duration. You may be asked to provide one if your content is flagged or selected for syndication.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="bg-gradient-to-r from-red-900/30 to-purple-900/30 border border-red-800/50 rounded-lg p-6 text-center">
          <h3 className="text-xl font-bold mb-2">Ready to Upload?</h3>
          <p className="text-zinc-400 mb-4">
            Make sure your content follows these guidelines, then accept the Creator Agreement.
          </p>
          <div className="flex justify-center gap-4">
            <Button asChild className="bg-red-600 hover:bg-red-700">
              <Link to="/creator-agreement">
                <Scale className="w-4 h-4 mr-2" />
                View Creator Agreement
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-zinc-700">
              <Link to="/upload-and-earn">
                <Video className="w-4 h-4 mr-2" />
                Go to Upload
              </Link>
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-500 text-xs">
          Last updated: April 2026 • Questions? Contact content@ztvlivestream.com
        </p>
      </div>
    </div>
  );
};

export default ContentGuidelinesPage;
