/**
 * Revenue Tab Component for Creator Dashboard
 * 
 * Displays revenue statistics, payouts, and earnings breakdown
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  DollarSign, Eye, Wallet, CreditCard, BarChart3, Target,
  Trophy, Video, RefreshCw, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const API = '/api';

export default function RevenueTab({ user }) {
  const [revenueData, setRevenueData] = useState(null);
  const [revenuePeriod, setRevenuePeriod] = useState("month");
  const [loadingRevenue, setLoadingRevenue] = useState(false);

  const fetchRevenue = async (period = revenuePeriod) => {
    if (!user) return;
    setLoadingRevenue(true);
    setRevenuePeriod(period);
    
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const response = await axios.get(
        `${API}/revenue/creator/${user.user_id}?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRevenueData(response.data);
    } catch (error) {
      console.error("Failed to fetch revenue:", error);
    } finally {
      setLoadingRevenue(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRevenue();
    }
  }, [user]);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-green-400" />
            Revenue Dashboard
          </CardTitle>
          <CardDescription>Track your earnings and payouts</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={revenuePeriod}
            onChange={(e) => fetchRevenue(e.target.value)}
            className="h-9 px-3 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-white"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last Year</option>
            <option value="all">All Time</option>
          </select>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchRevenue(revenuePeriod)}
            disabled={loadingRevenue}
          >
            <RefreshCw className={`w-4 h-4 ${loadingRevenue ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadingRevenue ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-green-400" />
          </div>
        ) : revenueData ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-xl p-4">
                <DollarSign className="w-6 h-6 text-green-400 mb-2" />
                <p className="text-2xl font-bold text-green-400">
                  ${revenueData.summary?.total_revenue?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-zinc-400">Total Revenue</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <Eye className="w-6 h-6 text-blue-400 mb-2" />
                <p className="text-2xl font-bold">
                  {revenueData.summary?.total_views?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-zinc-400">Total Views</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <Wallet className="w-6 h-6 text-yellow-400 mb-2" />
                <p className="text-2xl font-bold text-yellow-400">
                  ${revenueData.summary?.pending_balance?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-zinc-400">Pending Payout</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <CreditCard className="w-6 h-6 text-purple-400 mb-2" />
                <p className="text-2xl font-bold">
                  ${revenueData.summary?.total_paid?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-zinc-400">Total Paid Out</p>
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-zinc-800/30 rounded-xl p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Revenue Breakdown
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Ad Revenue (CPM)</span>
                    <span className="font-medium text-green-400">
                      ${revenueData.summary?.ad_revenue?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Slot Booking Bonus</span>
                    <span className="font-medium text-blue-400">
                      ${revenueData.summary?.slot_revenue?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="border-t border-zinc-700 pt-2 flex justify-between items-center">
                    <span className="text-zinc-400">Videos</span>
                    <span className="font-medium">{revenueData.summary?.total_videos || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Avg per Video</span>
                    <span className="font-medium">
                      ${revenueData.summary?.avg_revenue_per_video?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-800/30 rounded-xl p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Next Payout
                </h4>
                {revenueData.next_payout?.status === "pending" ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">Amount</span>
                      <span className="font-bold text-green-400 text-xl">
                        ${revenueData.next_payout.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">Estimated Date</span>
                      <span className="font-medium">{revenueData.next_payout.estimated_date}</span>
                    </div>
                    <Badge className="bg-green-600">Ready for Payout</Badge>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-zinc-500 mb-2">
                      Minimum threshold: ${revenueData.next_payout?.threshold?.toFixed(2) || '50.00'}
                    </p>
                    <Progress value={(revenueData.summary?.pending_balance / 50) * 100} className="h-2" />
                    <p className="text-xs text-zinc-600 mt-1">
                      ${(50 - (revenueData.summary?.pending_balance || 0)).toFixed(2)} more to payout
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Revenue Chart */}
            <div className="bg-zinc-800/30 rounded-xl p-4">
              <h4 className="font-medium mb-4">Daily Revenue ({revenuePeriod})</h4>
              <div className="flex items-end gap-1 h-32">
                {(revenueData.daily_revenue || []).slice(-14).map((day, i) => {
                  const maxRevenue = Math.max(
                    ...(revenueData.daily_revenue || []).map(d => d.revenue || 1)
                  );
                  const height = ((day.revenue || 0) / maxRevenue) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className="w-full bg-green-500/60 rounded-t hover:bg-green-500 transition-colors"
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`${day.date}: $${day.revenue?.toFixed(2)}`}
                      />
                      {i % 2 === 0 && (
                        <span className="text-[8px] text-zinc-600">{day.date?.slice(-2)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Performing Videos */}
            <div className="bg-zinc-800/30 rounded-xl p-4">
              <h4 className="font-medium mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                Top Earning Videos
              </h4>
              <div className="space-y-3">
                {(revenueData.top_videos || []).slice(0, 5).map((video, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                    <span className="text-lg font-bold text-zinc-500 w-6">#{idx + 1}</span>
                    <div className="w-16 h-10 bg-zinc-700 rounded overflow-hidden flex-shrink-0">
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-4 h-4 text-zinc-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{video.title || "Untitled"}</p>
                      <p className="text-xs text-zinc-500">{video.views?.toLocaleString()} views</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-400">${video.total_revenue?.toFixed(2)}</p>
                      <p className="text-xs text-zinc-500">{video.times_scheduled || 0} slots</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rate Information */}
            <div className="bg-zinc-800/20 rounded-lg p-4 text-sm text-zinc-500">
              <h5 className="font-medium text-zinc-400 mb-2">Revenue Rates</h5>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p>CPM Rate</p>
                  <p className="text-white">${revenueData.revenue_rates?.cpm_rate || '2.50'}</p>
                </div>
                <div>
                  <p>Creator Share</p>
                  <p className="text-white">{revenueData.revenue_rates?.creator_share || '70%'}</p>
                </div>
                <div>
                  <p>Slot Bonus</p>
                  <p className="text-white">{revenueData.revenue_rates?.slot_bonus || '50%'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Wallet className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Revenue Data</h3>
            <p className="text-zinc-500 mb-4">Upload and schedule content to start earning</p>
            <Button asChild className="bg-red-600 hover:bg-red-700">
              <Link to="/upload-and-earn">Upload Content</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
