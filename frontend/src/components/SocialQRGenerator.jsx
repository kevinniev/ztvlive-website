import { useState, useEffect } from "react";
import axios from "axios";
import { 
  QrCode, Download, Copy, ExternalLink, Sparkles,
  Instagram, Twitter, Youtube, Globe, Users, TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const API = '/api';

// Platform icons
const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', icon: Sparkles, color: 'bg-pink-600' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'bg-gradient-to-br from-purple-600 to-pink-500' },
  { id: 'twitter', label: 'Twitter/X', icon: Twitter, color: 'bg-blue-500' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, color: 'bg-red-600' },
  { id: 'facebook', label: 'Facebook', icon: Globe, color: 'bg-blue-600' },
];

// Creator options (based on 4-Bin lineup)
const CREATORS = [
  { id: 'julian', label: 'Julian Shapiro-Barnum' },
  { id: 'sabrina_brier', label: 'Sabrina Brier' },
  { id: 'boman', label: 'Boman Martinez-Reid' },
  { id: 'vinny_thomas', label: 'Vinny Thomas' },
  { id: 'amelia', label: 'Amelia Dimoldenberg' },
  { id: 'mina_le', label: 'Mina Le' },
  { id: 'tefi_pessoa', label: 'Tefi Pessoa' },
  { id: 'matt_ryan', label: 'Matt & Ryan (Maker Table)' },
];

export default function SocialQRGenerator() {
  const [platform, setPlatform] = useState('tiktok');
  const [creator, setCreator] = useState('');
  const [campaign, setCampaign] = useState('7_day_squeeze');
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [recentLinks, setRecentLinks] = useState([]);

  // Fetch analytics on mount
  useEffect(() => {
    fetchAnalytics();
    fetchRecentLinks();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API}/social-game/analytics?days=7`);
      setAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  };

  const fetchRecentLinks = async () => {
    try {
      const res = await axios.get(`${API}/social-game/links?limit=10`);
      setRecentLinks(res.data.links || []);
    } catch (err) {
      console.error('Failed to fetch links:', err);
    }
  };

  const generateQR = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/social-game/generate-qr`, {
        platform,
        creator: creator || null,
        campaign,
        size: 400,
        format: 'png'
      });
      setQrData(res.data);
      toast.success("QR Code generated!");
      fetchRecentLinks();
    } catch (err) {
      toast.error("Failed to generate QR code");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied!");
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const downloadQR = () => {
    if (!qrData?.qr?.qr_url) return;
    
    const link = document.createElement('a');
    link.href = qrData.qr.qr_url;
    link.download = `ztvlive-qr-${platform}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("QR Code downloaded!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <QrCode className="w-6 h-6 text-purple-500" />
            Social Game Integration
          </h2>
          <p className="text-zinc-400 mt-1">
            Generate trackable QR codes and deep links for social media
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* QR Generator */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              Generate QR Code
            </CardTitle>
            <CardDescription>
              Create trackable QR codes for your social posts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Platform Selection */}
            <div>
              <Label className="text-zinc-400 mb-2 block">Platform</Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={platform === p.id ? "default" : "outline"}
                    className={platform === p.id ? p.color : "border-zinc-700"}
                    onClick={() => setPlatform(p.id)}
                  >
                    <p.icon className="w-4 h-4 mr-1" />
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Creator Selection */}
            <div>
              <Label className="text-zinc-400 mb-2 block">Creator (Optional)</Label>
              <select
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white"
              >
                <option value="">No specific creator</option>
                {CREATORS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Campaign */}
            <div>
              <Label className="text-zinc-400 mb-2 block">Campaign</Label>
              <Input
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                placeholder="e.g., 7_day_squeeze, launch_week"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>

            <Button 
              onClick={generateQR} 
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-500"
            >
              <QrCode className="w-4 h-4 mr-2" />
              {loading ? "Generating..." : "Generate QR Code"}
            </Button>

            {/* QR Result */}
            {qrData && (
              <div className="mt-6 p-4 bg-zinc-800 rounded-lg">
                <div className="flex justify-center mb-4">
                  <div className="bg-white p-2 rounded-lg">
                    <img 
                      src={qrData.qr.qr_url} 
                      alt="QR Code" 
                      className="w-48 h-48"
                    />
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Short Link:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-purple-400 text-xs">{qrData.links.short}</code>
                      <Button size="sm" variant="ghost" onClick={() => copyLink(qrData.links.short)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Invite Code:</span>
                    <Badge variant="outline" className="border-purple-500 text-purple-400">
                      {qrData.invite_code}
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button onClick={downloadQR} className="flex-1" variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download PNG
                  </Button>
                  <Button 
                    onClick={() => window.open(qrData.qr.qr_url, '_blank')} 
                    variant="outline"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analytics Summary */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Social Analytics (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics ? (
              <div className="space-y-4">
                {/* Top Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-800 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-white">{analytics.total_clicks}</div>
                    <div className="text-sm text-zinc-500">Total Clicks</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-400">{analytics.conversion_rate}</div>
                    <div className="text-sm text-zinc-500">Conversion Rate</div>
                  </div>
                </div>

                {/* By Platform */}
                <div>
                  <h4 className="text-sm font-semibold text-zinc-400 mb-2">By Platform</h4>
                  <div className="space-y-2">
                    {Object.entries(analytics.by_platform || {}).map(([platform, data]) => (
                      <div key={platform} className="flex items-center justify-between p-2 bg-zinc-800 rounded">
                        <span className="text-white capitalize">{platform}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-zinc-400">{data.clicks} clicks</span>
                          <Badge variant="outline" className="border-green-500 text-green-400">
                            {data.conversions} conv
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {Object.keys(analytics.by_platform || {}).length === 0 && (
                      <p className="text-zinc-500 text-sm">No data yet. Generate some QR codes!</p>
                    )}
                  </div>
                </div>

                {/* By Creator */}
                <div>
                  <h4 className="text-sm font-semibold text-zinc-400 mb-2">By Creator</h4>
                  <div className="space-y-2">
                    {Object.entries(analytics.by_creator || {}).slice(0, 5).map(([creator, data]) => (
                      <div key={creator} className="flex items-center justify-between p-2 bg-zinc-800 rounded">
                        <span className="text-white">{creator.replace('_', ' ')}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-zinc-400">{data.clicks} clicks</span>
                          <Badge variant="outline" className="border-blue-500 text-blue-400">
                            {data.conversions} conv
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Links */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Recent Invite Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left py-2 text-zinc-400">Code</th>
                  <th className="text-left py-2 text-zinc-400">Platform</th>
                  <th className="text-left py-2 text-zinc-400">Creator</th>
                  <th className="text-left py-2 text-zinc-400">Clicks</th>
                  <th className="text-left py-2 text-zinc-400">Created</th>
                  <th className="text-left py-2 text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentLinks.map((link) => (
                  <tr key={link.code} className="border-b border-zinc-800">
                    <td className="py-2">
                      <code className="text-purple-400">{link.code}</code>
                    </td>
                    <td className="py-2 capitalize text-white">{link.platform || '-'}</td>
                    <td className="py-2 text-zinc-400">{link.creator || 'Organic'}</td>
                    <td className="py-2">
                      <Badge variant="outline" className="border-green-500 text-green-400">
                        {link.clicks || 0}
                      </Badge>
                    </td>
                    <td className="py-2 text-zinc-500 text-xs">
                      {new Date(link.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => copyLink(`https://www.ztvlivestream.com/join/${link.code}`)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {recentLinks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      No links generated yet. Create your first QR code above!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
