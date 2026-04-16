import { useState, useEffect } from "react";
import axios from "axios";
import { format, parseISO, addDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Clock, Video, CheckCircle, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, Loader2, Bell, Globe, Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const API = '/api';

// Common timezones
const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Africa/Lagos", label: "Lagos (WAT)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
];

const STATUS_CONFIG = {
  pending: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: AlertCircle, label: "Pending" },
  approved: { color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle, label: "Approved" },
  rejected: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle, label: "Rejected" },
  live: { color: "bg-red-600 text-white border-red-600", icon: Play, label: "LIVE" },
  completed: { color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", icon: CheckCircle, label: "Completed" },
  cancelled: { color: "bg-zinc-700/20 text-zinc-500 border-zinc-700/30", icon: XCircle, label: "Cancelled" },
};

// Time slot button component
function TimeSlot({ slot, selected, onClick, disabled }) {
  const isAvailable = slot.available && !disabled;
  
  return (
    <button
      onClick={() => isAvailable && onClick(slot)}
      disabled={!isAvailable}
      className={`
        px-3 py-2 rounded-lg text-sm font-medium transition-all
        ${selected 
          ? "bg-red-600 text-white ring-2 ring-red-400" 
          : isAvailable 
            ? "bg-zinc-800 text-white hover:bg-zinc-700" 
            : "bg-zinc-900 text-zinc-600 cursor-not-allowed"
        }
        ${slot.is_past ? "opacity-50" : ""}
      `}
    >
      {slot.time}
      {slot.taken_by && (
        <span className="block text-xs text-zinc-500 truncate max-w-[80px]">
          {slot.taken_by.creator_name || "Scheduled"}
        </span>
      )}
    </button>
  );
}

export default function ScheduleContent({ video, onClose, onScheduled }) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [slots, setSlots] = useState([]);
  const [notifyFollowers, setNotifyFollowers] = useState(true);

  // Fetch available slots when date or timezone changes
  useEffect(() => {
    fetchSlots();
  }, [selectedDate, timezone]);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const res = await axios.get(`${API}/schedule/availability`, {
        params: { date: dateStr, timezone }
      });
      setSlots(res.data.slots || []);
    } catch (error) {
      console.error("Error fetching slots:", error);
      toast.error("Failed to load available times");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSlot) {
      toast.error("Please select a time slot");
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/schedule/request`, {
        video_id: video.video_id,
        requested_time: selectedSlot.time_utc,
        timezone,
        notify_followers: notifyFollowers
      }, { withCredentials: true });

      if (res.data.success) {
        toast.success("Schedule request submitted!");
        onScheduled?.(res.data);
        onClose?.();
      } else {
        // Time slot conflict - show next available
        toast.error(res.data.message || "Time slot not available");
        if (res.data.next_available_local) {
          toast.info(`Next available: ${res.data.next_available_local}`);
        }
      }
    } catch (error) {
      console.error("Error scheduling:", error);
      toast.error(error.response?.data?.detail || "Failed to schedule content");
    } finally {
      setSubmitting(false);
    }
  };

  const navigateDate = (direction) => {
    setSelectedDate(prev => addDays(prev, direction));
    setSelectedSlot(null);
  };

  // Get duration in human-readable format
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}h ${remainMins}m`;
    }
    return `${mins} min`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-zinc-900 rounded-xl border border-zinc-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-red-500" />
            Schedule to Live TV
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Select when you want your content to air on ZTVLIVE
          </p>
        </div>

        {/* Video Preview */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex gap-4">
            <div className="w-32 h-20 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
              {video.thumbnail ? (
                <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Video className="w-8 h-8 text-zinc-600" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white line-clamp-2">{video.title}</h3>
              <div className="flex items-center gap-3 mt-2 text-sm text-zinc-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(video.duration_seconds || 300)}
                </span>
                <Badge variant="outline" className="border-zinc-700">
                  {video.category}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Timezone Selector */}
        <div className="p-6 border-b border-zinc-800">
          <label className="text-sm text-zinc-400 mb-2 block flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Your Timezone
          </label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value} className="text-white">
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Selector */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateDate(-1)}
              disabled={format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")}
              className="text-zinc-400 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="text-center">
              <p className="text-lg font-semibold text-white">
                {format(selectedDate, "EEEE, MMMM d")}
              </p>
              <p className="text-sm text-zinc-400">
                {format(selectedDate, "yyyy")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateDate(1)}
              className="text-zinc-400 hover:text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Quick date buttons */}
          <div className="flex gap-2 justify-center mb-4">
            {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
              const date = addDays(new Date(), offset);
              const isSelected = format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
              return (
                <button
                  key={offset}
                  onClick={() => {
                    setSelectedDate(date);
                    setSelectedSlot(null);
                  }}
                  className={`
                    px-3 py-2 rounded-lg text-sm transition-all
                    ${isSelected 
                      ? "bg-red-600 text-white" 
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }
                  `}
                >
                  {offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : format(date, "EEE")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slots */}
        <div className="p-6 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Available Time Slots
          </h3>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-2 max-h-[200px] overflow-y-auto pr-2">
              {slots.map((slot, idx) => (
                <TimeSlot
                  key={idx}
                  slot={slot}
                  selected={selectedSlot?.time === slot.time}
                  onClick={setSelectedSlot}
                  disabled={submitting}
                />
              ))}
            </div>
          )}

          {selectedSlot && (
            <div className="mt-4 p-4 bg-zinc-800 rounded-lg">
              <p className="text-white">
                <span className="text-zinc-400">Selected:</span>{" "}
                <strong>{format(selectedDate, "MMMM d, yyyy")}</strong> at{" "}
                <strong>{selectedSlot.time}</strong>
              </p>
              <p className="text-sm text-zinc-500 mt-1">
                Your content will air for approximately {formatDuration(video.duration_seconds || 300)}
              </p>
            </div>
          )}
        </div>

        {/* Notify Followers */}
        <div className="p-6 border-b border-zinc-800">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyFollowers}
              onChange={(e) => setNotifyFollowers(e.target.checked)}
              className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-red-600 focus:ring-red-500"
            />
            <div>
              <span className="text-white flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notify my followers
              </span>
              <span className="text-sm text-zinc-500">
                Send a notification when your content is approved
              </span>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="p-6 flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-zinc-700 text-zinc-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedSlot || submitting}
            className="bg-red-600 hover:bg-red-700"
            data-testid="submit-schedule-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-2" />
                Request Schedule
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Scheduled Content List Component
export function ScheduledContentList({ scheduled = [], onCancel }) {
  if (scheduled.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No scheduled content yet</p>
        <p className="text-sm">Schedule your videos to go live on ZTVLIVE</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {scheduled.map((item) => {
        const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
        const StatusIcon = statusConfig.icon;
        const scheduledTime = parseISO(item.scheduled_time);
        
        return (
          <div
            key={item.schedule_id}
            className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700"
          >
            <div className="flex gap-4">
              {/* Thumbnail */}
              <div className="w-24 h-16 rounded bg-zinc-700 overflow-hidden flex-shrink-0">
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-6 h-6 text-zinc-600" />
                  </div>
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-white line-clamp-1">{item.title}</h4>
                <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(scheduledTime, "MMM d, yyyy")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(scheduledTime, "h:mm a")}
                  </span>
                </div>
                <Badge className={`mt-2 ${statusConfig.color}`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
              
              {/* Actions */}
              {["pending", "approved"].includes(item.status) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCancel?.(item.schedule_id)}
                  className="text-zinc-400 hover:text-red-400"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
