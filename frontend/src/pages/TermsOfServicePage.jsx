import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Tv, ArrowLeft, FileText, Shield, Scale, Users, Video, DollarSign, AlertTriangle, Gavel } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold">ZTVLIVE</span>
          </Link>
          <Link 
            to="/" 
            className="text-sm text-zinc-400 hover:text-white flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Title */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-600/10 text-blue-500 px-4 py-2 rounded-full text-sm mb-4">
              <Scale className="w-4 h-4" />
              Legal Document
            </div>
            <h1 className="text-4xl font-bold mb-4">ZTVLIVE Terms of Service</h1>
            <p className="text-zinc-400">Last Updated: March 2026</p>
          </div>

          {/* Quick Navigation */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            <Link to="/creator-agreement" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">
              Creator Agreement
            </Link>
            <Link to="/terms" className="px-4 py-2 bg-red-600 rounded-lg text-sm">
              Terms of Service
            </Link>
            <Link to="/privacy" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">
              Privacy Policy
            </Link>
          </div>

          {/* Key Highlights */}
          <div className="grid md:grid-cols-4 gap-4 mb-12">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <DollarSign className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <div className="text-lg font-bold text-green-500">70%</div>
              <div className="text-xs text-zinc-400">Revenue Share</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <div className="text-lg font-bold text-blue-500">$0</div>
              <div className="text-xs text-zinc-400">Threshold</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <Video className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <div className="text-lg font-bold text-purple-500">5+</div>
              <div className="text-xs text-zinc-400">Platforms</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <Shield className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
              <div className="text-lg font-bold text-yellow-500">100%</div>
              <div className="text-xs text-zinc-400">Tips to You</div>
            </div>
          </div>

          {/* Agreement Content */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 md:p-12">
            <div className="prose prose-invert prose-zinc max-w-none">
              
              <p className="text-lg text-zinc-300 mb-8">
                These Terms of Service ("Agreement") constitute a legally binding agreement between you 
                ("Creator," "User," or "You") and ZTVLIVE ("Company," "We," "Us," or "Platform"), governing 
                your access to and use of the ZTVLIVE website (www.ztvlivestream.com), mobile applications, 
                and associated services, including distribution on OTT platforms such as Roku, Amazon Fire TV, 
                Samsung Smart TV, and LG Smart TV.
              </p>

              <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4 mb-8">
                <p className="text-red-400 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  By creating an account, uploading content, or using our professional production services, 
                  you agree to be bound by these terms.
                </p>
              </div>

              {/* Section 1 */}
              <section className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">1</span>
                  SERVICES PROVIDED
                </h2>
                <p className="text-zinc-300 mb-4">
                  ZTVLIVE is a multi-platform streaming media and OTT distribution service. We provide:
                </p>
                <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-4">
                  <li>24/7 live streaming and video-on-demand (VOD) distribution across Web, Roku, Amazon Fire TV, Samsung Smart TV, and LG Smart TV</li>
                  <li>Live streaming and event videography</li>
                  <li>Corporate video production and post-production</li>
                  <li>Automated scheduling for 24/7 linear broadcast</li>
                  <li>Distribution across Web, Roku, Fire TV, Samsung (Tizen), and LG (webOS)</li>
                </ul>
              </section>

              {/* Section 2 */}
              <section className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">2</span>
                  CREATOR ELIGIBILITY AND ACCOUNT
                </h2>
                
                <h3 className="text-lg font-semibold text-white mt-4 mb-2">2.1 No Threshold Requirement</h3>
                <p className="text-zinc-300 mb-4">
                  Unlike traditional platforms, ZTVLIVE does not require a minimum subscriber count or 
                  watch-hour threshold to begin monetization.
                </p>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">2.2 Account Responsibility</h3>
                <p className="text-zinc-300 mb-4">
                  You are responsible for maintaining the confidentiality of your login credentials and for 
                  all activities that occur under your account.
                </p>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">2.3 Accuracy of Information</h3>
                <p className="text-zinc-300">
                  You must provide accurate and complete information, including valid payment details (PayPal) 
                  for revenue distribution.
                </p>
              </section>

              {/* Section 3 */}
              <section className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">3</span>
                  CONTENT OWNERSHIP AND LICENSING
                </h2>
                
                <h3 className="text-lg font-semibold text-white mt-4 mb-2">3.1 Ownership</h3>
                <p className="text-zinc-300 mb-4">
                  <span className="text-green-500 font-semibold">You retain all ownership rights</span> to 
                  the content you upload to ZTVLIVE.
                </p>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">3.2 Grant of License (Non-Exclusive Distribution Rights)</h3>
                <p className="text-zinc-300 mb-4">
                  By submitting content, you grant ZTVLIVE a non-exclusive, worldwide, royalty-free, 
                  sublicensable license to use, reproduce, distribute, publicly display, and broadcast your 
                  content on the Platform, including on our network and partner OTT platforms, across all 
                  Company-affiliated platforms, including but not limited to our web platform and OTT 
                  applications (Roku, Fire TV, Samsung, LG, etc.).
                </p>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">3.3 Marketing License</h3>
                <p className="text-zinc-300">
                  You grant ZTVLIVE the right to use your name, likeness, and snippets of your content for 
                  the purpose of promoting the Platform and your specific channel.
                </p>
              </section>

              {/* Section 4 - Monetization */}
              <section className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-sm">4</span>
                  MONETIZATION AND REVENUE SHARE
                </h2>
                
                <div className="bg-green-600/10 border border-green-600/30 rounded-xl p-4 mb-4">
                  <p className="text-green-400 font-medium">💰 Industry-leading creator compensation!</p>
                </div>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">4.1 Revenue Split (70% Ad Revenue Share)</h3>
                <p className="text-zinc-300 mb-4">
                  For all qualifying advertising revenue generated directly by your content, ZTVLIVE shall 
                  pay the Creator <span className="text-green-500 font-bold">70% of Net Revenue</span>. 
                  ZTVLIVE retains 30%.
                </p>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">4.2 Tips and Donations (100% to Creators)</h3>
                <p className="text-zinc-300 mb-4">
                  Creators shall receive <span className="text-green-500 font-bold">100% of fan tips</span> and 
                  direct donations processed through the Platform's tipping interface. ZTVLIVE takes $0 from 
                  these specific transactions, though third-party payment processing fees may apply.
                </p>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">4.3 Payout Schedule</h3>
                <p className="text-zinc-300 mb-4">
                  Payouts are issued on a <span className="font-semibold text-white">weekly basis</span>.
                </p>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">4.4 Minimum Payout</h3>
                <p className="text-zinc-300 mb-4">
                  To trigger a disbursement, the Creator's balance must reach a minimum of 
                  <span className="font-semibold text-white"> $50.00 USD</span>. Balances below this amount 
                  will roll over to the following week.
                </p>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">4.5 Payment Method</h3>
                <p className="text-zinc-300">
                  All payments are currently processed via PayPal. Creators are responsible for any fees 
                  charged by PayPal or local tax authorities.
                </p>
              </section>

              {/* Section 5 */}
              <section className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-sm">5</span>
                  CONTENT STANDARDS AND CONDUCT
                </h2>
                
                <h3 className="text-lg font-semibold text-white mt-4 mb-2">5.1 Prohibited Content</h3>
                <p className="text-zinc-300 mb-2">You agree not to upload content that:</p>
                <ul className="list-disc list-inside text-zinc-300 space-y-1 ml-4 mb-4">
                  <li>Infringes on any third-party intellectual property or copyrights</li>
                  <li>Is illegal, defamatory, or promotes hate speech</li>
                  <li>Contains sexually explicit material or extreme violence</li>
                  <li>Violates the privacy rights of any individual</li>
                </ul>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">5.2 Professional Broadcast Standards</h3>
                <p className="text-zinc-300 mb-4">
                  You agree to comply with standard professional broadcast standards, including using lawful 
                  rights-cleared media, avoiding misleading or deceptive programming practices, and refraining 
                  from content or conduct that would reasonably harm viewers, advertisers, distribution partners, 
                  or the reputation of the Platform.
                </p>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">5.3 DMCA Compliance</h3>
                <p className="text-zinc-300">
                  ZTVLIVE respects copyright law. We will remove content upon receipt of a valid DMCA takedown 
                  notice and may terminate repeat infringers.
                </p>
              </section>

              {/* Section 6 */}
              <section className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">6</span>
                  PROFESSIONAL PRODUCTION SERVICES
                </h2>
                
                <h3 className="text-lg font-semibold text-white mt-4 mb-2">6.1 Scope of Work</h3>
                <p className="text-zinc-300 mb-4">
                  For corporate and event clients, the specific scope of production, post-production, and 
                  broadcast services will be governed by a separate Statement of Work (SOW).
                </p>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">6.2 Cancellation</h3>
                <p className="text-zinc-300">
                  Cancellations for scheduled live event videography must be made in accordance with the 
                  specific service agreement provided at the time of booking.
                </p>
              </section>

              {/* Section 7 */}
              <section className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-sm">7</span>
                  PLATFORM OPERATION AND "SCHEDULED BROADCAST"
                </h2>
                
                <h3 className="text-lg font-semibold text-white mt-4 mb-2">7.1 Guaranteed Airtime</h3>
                <p className="text-zinc-300 mb-4">
                  <span className="text-purple-400 font-semibold">Unlike algorithmic platforms</span>, ZTVLIVE 
                  operates on a scheduled programming model. Content accepted into our 24/7 linear stream is 
                  guaranteed broadcast time as determined by our programming department.
                </p>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">7.2 Analytics and Dashboard</h3>
                <p className="text-zinc-300 mb-4">
                  The Platform may provide a Creator Dashboard and analytics (e.g., views, watch time, audience 
                  and performance metrics, revenue estimates). These tools are provided for informational purposes 
                  and may be delayed, estimated, or subject to change. You agree not to misuse the Dashboard 
                  (including attempting to manipulate metrics, access other creators' data, scrape or extract 
                  data at scale, or bypass access controls).
                </p>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">7.3 Service Availability</h3>
                <p className="text-zinc-300">
                  While we strive for 100% uptime, ZTVLIVE does not guarantee uninterrupted service and is not 
                  liable for technical outages on third-party OTT hardware (Roku, Fire TV, etc.).
                </p>
              </section>

              {/* Section 8 */}
              <section className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">8</span>
                  LIMITATION OF LIABILITY
                </h2>
                <p className="text-zinc-300">
                  To the maximum extent permitted by law, ZTVLIVE shall not be liable for any indirect, 
                  incidental, or consequential damages, including loss of profits, data, or goodwill, resulting 
                  from your use of the platform or the performance of your content.
                </p>
              </section>

              {/* Section 9 */}
              <section className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">9</span>
                  INDEMNIFICATION
                </h2>
                <p className="text-zinc-300">
                  You agree to indemnify and hold harmless ZTVLIVE and its officers, directors, and employees 
                  from any claims, damages, or expenses (including legal fees) arising from your breach of this 
                  Agreement or your infringement of any third-party rights.
                </p>
              </section>

              {/* Section 10 */}
              <section className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">10</span>
                  TERMINATION
                </h2>
                
                <h3 className="text-lg font-semibold text-white mt-4 mb-2">10.1 By Creator</h3>
                <p className="text-zinc-300 mb-4">
                  You may terminate your account at any time. Any accrued revenue above the $50 threshold 
                  will be paid in the next cycle.
                </p>

                <h3 className="text-lg font-semibold text-white mt-4 mb-2">10.2 By Company</h3>
                <p className="text-zinc-300">
                  ZTVLIVE reserves the right to suspend or terminate accounts that violate these terms or 
                  engage in fraudulent activity.
                </p>
              </section>

              {/* Section 11 */}
              <section className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">11</span>
                  GOVERNING LAW
                </h2>
                <p className="text-zinc-300">
                  This Agreement shall be governed by and construed in accordance with the laws of the 
                  <span className="font-semibold text-white"> State of Arizona, United States</span>, without 
                  regard to conflict of law principles.
                </p>
              </section>

              {/* Section 12 */}
              <section className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">12</span>
                  AMENDMENTS
                </h2>
                <p className="text-zinc-300">
                  ZTVLIVE reserves the right to modify these terms at any time. We will notify creators of 
                  significant changes via the Creator Dashboard or email. Continued use of the platform 
                  constitutes acceptance of the updated terms.
                </p>
              </section>

              {/* Contact Information */}
              <section className="mt-12 pt-8 border-t border-zinc-700">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Gavel className="w-6 h-6 text-zinc-400" />
                  Contact Information
                </h2>
                <p className="text-zinc-300">
                  For legal inquiries or support, please contact:{" "}
                  <a href="mailto:legal@ztvlivestream.com" className="text-red-500 hover:underline">
                    legal@ztvlivestream.com
                  </a>
                </p>
              </section>

            </div>
          </div>

          {/* Related Documents */}
          <div className="mt-12">
            <h3 className="text-xl font-bold mb-6 text-center">Related Legal Documents</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <Link 
                to="/creator-agreement"
                className="bg-zinc-900 border border-zinc-800 hover:border-red-600 rounded-xl p-6 transition-colors"
              >
                <FileText className="w-8 h-8 text-red-500 mb-3" />
                <h4 className="font-semibold text-white mb-2">Creator Agreement</h4>
                <p className="text-sm text-zinc-400">Detailed terms for content creators including revenue share, payment terms, and content requirements.</p>
              </Link>
              <Link 
                to="/privacy"
                className="bg-zinc-900 border border-zinc-800 hover:border-blue-600 rounded-xl p-6 transition-colors"
              >
                <Shield className="w-8 h-8 text-blue-500 mb-3" />
                <h4 className="font-semibold text-white mb-2">Privacy Policy</h4>
                <p className="text-sm text-zinc-400">How we collect, use, and protect your personal information.</p>
              </Link>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <p className="text-zinc-400 mb-6">
              Ready to start creating with ZTVLIVE?
            </p>
            <Link 
              to="/register"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-semibold transition-colors"
            >
              Create Your Account
            </Link>
          </div>

        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-zinc-500 text-sm">
          <p>© 2026 ZTVLIVE. All rights reserved.</p>
          <div className="flex justify-center gap-4 mt-4">
            <Link to="/terms" className="hover:text-white text-red-500">Terms of Service</Link>
            <Link to="/creator-agreement" className="hover:text-white">Creator Agreement</Link>
            <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
