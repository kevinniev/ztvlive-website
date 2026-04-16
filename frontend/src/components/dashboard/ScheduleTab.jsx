/**
 * Schedule Tab Component for Creator Dashboard
 * 
 * Displays scheduled slots and allows booking new ones
 */

import { Link } from "react-router-dom";
import { Calendar, Plus, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function ScheduleTab({ bookings = [], onCopyShareLink }) {
  const copyShareLink = (bookingId) => {
    const shareUrl = `${window.location.origin}/watch?slot=${bookingId}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied!");
    onCopyShareLink?.(bookingId);
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>My Scheduled Slots</CardTitle>
        <Button asChild className="bg-purple-600 hover:bg-purple-700">
          <Link to="/schedule-slot">
            <Plus className="w-4 h-4 mr-2" />
            Book New Slot
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Scheduled Slots</h3>
            <p className="text-zinc-500 mb-4">
              Book a time slot to feature your content on the 24/7 stream
            </p>
            <Button asChild className="bg-purple-600 hover:bg-purple-700">
              <Link to="/schedule-slot">Book a Slot</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking, idx) => {
              const isPast = new Date(booking.slot_date) < new Date();
              return (
                <div 
                  key={idx} 
                  className={`flex items-center gap-4 p-4 rounded-lg ${
                    isPast ? 'bg-zinc-800/50 opacity-60' : 'bg-zinc-800'
                  }`}
                >
                  <div className="w-16 text-center">
                    <p className="text-2xl font-bold">
                      {new Date(booking.slot_date).getDate()}
                    </p>
                    <p className="text-xs text-zinc-500 uppercase">
                      {new Date(booking.slot_date).toLocaleDateString('en-US', { month: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{booking.title || "Scheduled Content"}</p>
                    <p className="text-sm text-zinc-500">
                      {booking.slot_start_hour}:{String(booking.slot_start_minute || 0).padStart(2, '0')} - 
                      {booking.duration_minutes || 15} minutes
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={
                      booking.status === "approved" || booking.status === "confirmed"
                        ? "bg-emerald-600" 
                        : booking.status === "rejected"
                          ? "bg-red-600"
                          : "bg-yellow-600"
                    }>
                      {booking.status}
                    </Badge>
                    {!isPast && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => copyShareLink(booking.booking_id)}
                        data-testid={`share-slot-${idx}`}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
