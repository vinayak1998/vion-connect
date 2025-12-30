import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Wrench, Ticket, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const installStatusColors: Record<string, string> = {
  "Open": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "In Progress": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Installed": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Verified": "bg-green-500/20 text-green-400 border-green-500/30",
};

const ticketStatusColors: Record<string, string> = {
  "Open": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "In Progress": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Resolved": "bg-green-500/20 text-green-400 border-green-500/30",
  "Closed": "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export default function PartnerDashboard() {
  const { partnerName, partnerId } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["partner-stats", partnerId],
    queryFn: async () => {
      const [installations, tickets] = await Promise.all([
        supabase.from("install_tickets").select("status"),
        supabase.from("tickets").select("status"),
      ]);

      const installsByStatus = installations.data?.reduce((acc, i) => {
        acc[i.status] = (acc[i.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const ticketsByStatus = tickets.data?.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        totalInstalls: installations.data?.length || 0,
        pendingInstalls: (installsByStatus["Open"] || 0) + (installsByStatus["In Progress"] || 0),
        completedInstalls: (installsByStatus["Installed"] || 0) + (installsByStatus["Verified"] || 0),
        totalTickets: tickets.data?.length || 0,
        openTickets: (ticketsByStatus["Open"] || 0) + (ticketsByStatus["In Progress"] || 0),
      };
    },
    enabled: !!partnerId,
  });

  const { data: recentInstallations } = useQuery({
    queryKey: ["partner-recent-installations", partnerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("install_tickets")
        .select(`
          id,
          scheduled_date,
          status,
          lead:leads(name, phone, address),
          customer:customers(name, phone, address)
        `)
        .order("scheduled_date", { ascending: true })
        .limit(5);
      return data;
    },
    enabled: !!partnerId,
  });

  const { data: recentTickets } = useQuery({
    queryKey: ["partner-recent-tickets", partnerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select(`
          id,
          description,
          status,
          priority,
          created_at,
          customer:customers(name)
        `)
        .in("status", ["Open", "In Progress"])
        .order("created_at", { ascending: false })
        .limit(5);
      return data;
    },
    enabled: !!partnerId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {partnerName}</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Installations</CardTitle>
            <Wrench className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalInstalls}</div>
            <p className="text-xs text-muted-foreground">Assigned to you</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Installations</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingInstalls}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.openTickets}</div>
            <p className="text-xs text-muted-foreground">Awaiting resolution</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed Installations</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completedInstalls}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Work */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Installations */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Upcoming Installations
            </CardTitle>
            <Link to="/partner/installations">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentInstallations?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No installations assigned</p>
              ) : (
                recentInstallations?.map((install) => {
                  const customer = install.customer || install.lead;
                  return (
                    <div key={install.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {customer?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {customer?.address}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(install.scheduled_date), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge variant="outline" className={installStatusColors[install.status]}>
                        {install.status}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Open Tickets */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-warning" />
              Open Tickets
            </CardTitle>
            <Link to="/partner/tickets">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTickets?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No open tickets</p>
              ) : (
                recentTickets?.map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {ticket.customer?.name || "Unknown Customer"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {ticket.description.slice(0, 50)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(ticket.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className={ticketStatusColors[ticket.status]}>
                        {ticket.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{ticket.priority}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
