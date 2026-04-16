import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Send, Users, Activity, TrendingUp, AlertTriangle, 
  Loader2, RefreshCw, Mail, Zap, Trophy, UserCheck, UserX, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const API = '/api';

// Engagement level colors
const ENGAGEMENT_COLORS = {
  new: "bg-blue-500",
  active: "bg-emerald-500",
  engaged: "bg-green-500",
  at_risk: "bg-yellow-500",
  inactive: "bg-orange-500",
  churned: "bg-red-500"
};

export default function PennyDashboardPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("all");

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(`${API}/admin/penny/dashboard`);
      setData(response.data);
    } catch (error) {
      console.error("Failed to fetch Penny dashboard:", error);
      toast.error("Failed to load Penny dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const sendCampaign = async (testMode = true) => {
    if (!selectedTemplate) {
      toast.error("Please select an email template");
      return;
    }

    setSending(true);
    try {
      const response = await axios.post(`${API}/admin/penny/send-campaign`, null, {
        params: {
          template_key: selectedTemplate,
          segment: selectedSegment,
          test_mode: testMode
        }
      });

      if (testMode) {
        toast.info(`Preview: Would send to ${response.data.would_send_to} creators`);
      } else {
        toast.success(`Campaign sent to ${response.data.sent_count} creators!`);
      }
    } catch (error) {
      console.error("Campaign error:", error);
      toast.error("Failed to send campaign");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
        <span className="ml-3 text-zinc-400">Loading Penny's dashboard...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="bg-red-900/20 border-red-800">
        <CardContent className="py-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-400">Failed to load Penny dashboard</p>
          <Button onClick={fetchDashboard} className="mt-4" variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { intro, engagement, featured_creators, recommendations, campaigns, templates_available } = data;

  return (
    <div className="space-y-6" data-testid="penny-dashboard-panel">
      {/* Penny's Header */}
      <Card className="bg-gradient-to-r from-pink-900/40 via-purple-900/40 to-zinc-900 border-pink-800/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0">
              P
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                Penny
                <Badge className="bg-pink-600 text-xs">AI Agent</Badge>
              </h2>
              <p className="text-sm text-zinc-300 mt-1 italic">"{intro}"</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Engagement Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">{engagement?.total_creators || 0}</p>
                <p className="text-xs text-zinc-400">Total Creators</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-2xl font-bold text-emerald-400">{engagement?.active_rate || 0}%</p>
                <p className="text-xs text-zinc-400">Active Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-yellow-400">{engagement?.at_risk_count || 0}</p>
                <p className="text-xs text-zinc-400">At Risk</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserX className="w-8 h-8 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-red-400">{engagement?.churned_count || 0}</p>
                <p className="text-xs text-zinc-400">Churned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Distribution */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Creator Engagement Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(engagement?.distribution || {}).map(([level, count]) => {
              const percentage = Math.round((count / engagement?.total_creators) * 100) || 0;
              return (
                <div key={level} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-300 capitalize flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${ENGAGEMENT_COLORS[level] || 'bg-zinc-500'}`} />
                      {level.replace('_', ' ')}
                    </span>
                    <span className="text-zinc-400">{count} ({percentage}%)</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="w-5 h-5 text-yellow-400" />
              Penny's Recommendations
            </CardTitle>
            <CardDescription>Action items to improve creator engagement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((rec, i) => (
              <div 
                key={i} 
                className={`p-3 rounded-lg border ${
                  rec.priority === 'high' ? 'bg-red-900/20 border-red-800' :
                  rec.priority === 'medium' ? 'bg-yellow-900/20 border-yellow-800' :
                  'bg-zinc-800/50 border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge className={`mb-2 ${
                      rec.priority === 'high' ? 'bg-red-600' :
                      rec.priority === 'medium' ? 'bg-yellow-600' :
                      'bg-zinc-600'
                    }`}>
                      {rec.priority} priority
                    </Badge>
                    <p className="text-sm text-zinc-300">{rec.message}</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setSelectedSegment(rec.segment);
                      setSelectedTemplate(rec.type === 're_engagement' ? 'inactive_reminder' : 
                                         rec.type === 'onboarding' ? 'welcome' : 'campaign_upload');
                    }}
                  >
                    {rec.action}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Campaign Sender */}
      <Card className="bg-gradient-to-r from-purple-900/30 to-zinc-900 border-purple-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="w-5 h-5 text-purple-400" />
            Send Campaign
          </CardTitle>
          <CardDescription>Send engagement emails to creators</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">Email Template</label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {(templates_available || []).map(template => (
                    <SelectItem key={template} value={template}>
                      {template.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">Target Segment</label>
              <Select value={selectedSegment} onValueChange={setSelectedSegment}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Select segment..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Creators</SelectItem>
                  <SelectItem value="new">New (Last 7 days)</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button 
              onClick={() => sendCampaign(true)} 
              variant="outline"
              disabled={sending || !selectedTemplate}
            >
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clock className="w-4 h-4 mr-2" />}
              Preview Campaign
            </Button>
            <Button 
              onClick={() => sendCampaign(false)} 
              className="bg-purple-600 hover:bg-purple-700"
              disabled={sending || !selectedTemplate}
            >
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send Campaign
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Featured Creators */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Featured Creators
          </CardTitle>
          <CardDescription>Top performing creators to highlight</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(featured_creators || []).map((creator, i) => (
              <div key={i} className="p-3 bg-zinc-800/50 rounded-lg flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                  {(creator.name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{creator.name}</p>
                  <p className="text-xs text-zinc-400">
                    {creator.video_count} videos • {creator.total_views?.toLocaleString() || 0} views
                  </p>
                </div>
                <Badge className={ENGAGEMENT_COLORS[creator.level] || 'bg-zinc-600'}>
                  {creator.level}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
