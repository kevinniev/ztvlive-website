/**
 * Notifications Tab Component for Creator Dashboard
 * 
 * Displays content review notifications and updates
 */

import { Bell, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotificationsTab({ 
  notifications = [], 
  onExpandNotification,
  formatDate 
}) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-yellow-400" />
          Content Review Notifications
        </CardTitle>
        <CardDescription>
          Updates about your content submissions and review status
        </CardDescription>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-emerald-600/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">All Caught Up!</h3>
            <p className="text-zinc-500">No pending notifications</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif, idx) => (
              <div 
                key={idx} 
                className="p-4 bg-zinc-800 rounded-lg border-l-4 border-yellow-600"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold">{notif.subject}</h4>
                  <span className="text-xs text-zinc-500">
                    {formatDate ? formatDate(notif.created_at) : notif.created_at}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 whitespace-pre-wrap line-clamp-3">
                  {notif.body?.substring(0, 200)}...
                </p>
                <Button 
                  size="sm" 
                  variant="link" 
                  className="text-red-400 p-0 mt-2"
                  onClick={() => onExpandNotification?.(notif)}
                  data-testid={`read-full-message-${idx}`}
                >
                  Read Full Message
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
