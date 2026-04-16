import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Shield, AlertTriangle, Lock, Unlock, RefreshCw, 
  Loader2, Activity, Key, Ban, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

const API = '/api';

export default function SecurityPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blockIp, setBlockIp] = useState("");
  const [blocking, setBlocking] = useState(false);

  const fetchSecurity = async () => {
    try {
      const response = await axios.get(`${API}/admin/security/stats`);
      setData(response.data);
    } catch (error) {
      console.error("Failed to fetch security stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurity();
    const interval = setInterval(fetchSecurity, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleBlockIp = async () => {
    if (!blockIp.trim()) return;
    
    setBlocking(true);
    try {
      await axios.post(`${API}/admin/security/block-ip`, null, {
        params: { ip: blockIp, duration_minutes: 30, reason: "Manual block by admin" }
      });
      toast.success(`IP ${blockIp} blocked for 30 minutes`);
      setBlockIp("");
      fetchSecurity();
    } catch (error) {
      toast.error("Failed to block IP");
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblockIp = async (ip) => {
    try {
      await axios.post(`${API}/admin/security/unblock-ip`, null, { params: { ip } });
      toast.success(`IP ${ip} unblocked`);
      fetchSecurity();
    } catch (error) {
      toast.error("Failed to unblock IP");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-red-400" />
        <span className="ml-3 text-zinc-400">Loading security data...</span>
      </div>
    );
  }

  const { stats, blocked_ips, recent_threats } = data || {};

  return (
    <div className="space-y-6" data-testid="security-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-400" />
            Security Center
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Monitor threats, blocked IPs, and suspicious activity
          </p>
        </div>
        <Button onClick={fetchSecurity} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={`bg-zinc-900/50 border-zinc-800 ${stats?.blocked_ips_count > 0 ? 'border-red-800' : ''}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Ban className="w-8 h-8 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats?.blocked_ips_count || 0}</p>
                <p className="text-xs text-zinc-400">Blocked IPs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-zinc-900/50 border-zinc-800 ${stats?.suspicious_activities_24h > 0 ? 'border-yellow-800' : ''}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats?.suspicious_activities_24h || 0}</p>
                <p className="text-xs text-zinc-400">Alerts (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-zinc-900/50 border-zinc-800 ${stats?.high_severity_alerts > 0 ? 'border-red-800' : ''}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-orange-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats?.high_severity_alerts || 0}</p>
                <p className="text-xs text-zinc-400">High Severity</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Key className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats?.api_keys_active || 0}</p>
                <p className="text-xs text-zinc-400">API Keys</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual IP Block */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="w-5 h-5 text-red-400" />
            Block IP Address
          </CardTitle>
          <CardDescription>Manually block suspicious IP addresses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Enter IP address (e.g., 192.168.1.1)"
              value={blockIp}
              onChange={(e) => setBlockIp(e.target.value)}
              className="bg-zinc-800 border-zinc-700 flex-1"
            />
            <Button 
              onClick={handleBlockIp} 
              disabled={blocking || !blockIp.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {blocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
              Block
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Blocked IPs */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ban className="w-5 h-5 text-red-400" />
            Currently Blocked IPs ({blocked_ips?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {blocked_ips && blocked_ips.length > 0 ? (
            <div className="space-y-2">
              {blocked_ips.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-red-900/20 border border-red-800 rounded-lg">
                  <div>
                    <p className="text-white font-mono">{item.ip}</p>
                    <p className="text-xs text-zinc-400">
                      Expires in {item.remaining_minutes} minutes
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleUnblockIp(item.ip)}
                  >
                    <Unlock className="w-4 h-4 mr-1" />
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-center py-4">No IPs currently blocked</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Threats */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Eye className="w-5 h-5 text-yellow-400" />
            Recent Suspicious Activity
          </CardTitle>
          <CardDescription>Last 20 detected threats</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {recent_threats && recent_threats.length > 0 ? (
              <div className="space-y-2">
                {recent_threats.map((threat, i) => (
                  <div 
                    key={i} 
                    className={`p-3 rounded-lg border ${
                      threat.severity === 'high' ? 'bg-red-900/20 border-red-800' : 'bg-yellow-900/20 border-yellow-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={threat.severity === 'high' ? 'bg-red-600' : 'bg-yellow-600'}>
                            {threat.severity}
                          </Badge>
                          <span className="text-sm text-white">{threat.activity_type}</span>
                        </div>
                        <p className="text-xs text-zinc-400 font-mono">{threat.ip}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {new Date(threat.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Shield className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                <p className="text-zinc-400">No suspicious activity detected</p>
                <p className="text-xs text-zinc-500">Your platform is secure</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
