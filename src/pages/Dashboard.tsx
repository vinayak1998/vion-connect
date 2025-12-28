import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Ticket,
  CreditCard,
  Wrench,
  UserCircle,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { format, subDays } from "date-fns";

const COLORS = {
  primary: "hsl(258, 90%, 66%)",
  success: "hsl(142, 76%, 42%)",
  warning: "hsl(38, 92%, 50%)",
  info: "hsl(199, 89%, 55%)",
  destructive: "hsl(0, 62%, 50%)",
  muted: "hsl(222, 47%, 30%)",
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [leads, tickets, customers, payments, installations] = await Promise.all([
        supabase.from("leads").select("stage"),
        supabase.from("tickets").select("status"),
        supabase.from("customers").select("status"),
        supabase.from("payments").select("status, amount, date"),
        supabase.from("install_tickets").select("status"),
      ]);

      const leadsByStage = leads.data?.reduce((acc, l) => {
        acc[l.stage] = (acc[l.stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const ticketsByStatus = tickets.data?.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const openTickets = ticketsByStatus["Open"] || 0;
      const activeCustomers = customers.data?.filter(c => c.status === "Active").length || 0;
      const pendingPayments = payments.data?.filter(p => p.status === "Pending").length || 0;
      const awaitingVerification = installations.data?.filter(i => i.status === "Installed").length || 0;

      const monthRevenue = payments.data
        ?.filter(p => p.status === "Paid" && new Date(p.date) >= subDays(new Date(), 30))
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      return {
        openTickets,
        leadsByStage,
        ticketsByStatus,
        activeCustomers,
        pendingPayments,
        awaitingVerification,
        monthRevenue,
        totalLeads: leads.data?.length || 0,
      };
    },
  });

  const { data: recentPayments } = useQuery({
    queryKey: ["recent-payments-chart"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("amount, date, status")
        .gte("date", format(subDays(new Date(), 30), "yyyy-MM-dd"))
        .order("date", { ascending: true });

      const grouped = data?.reduce((acc, p) => {
        if (p.status === "Paid") {
          const date = format(new Date(p.date), "MMM dd");
          acc[date] = (acc[date] || 0) + Number(p.amount);
        }
        return acc;
      }, {} as Record<string, number>) || {};

      return Object.entries(grouped).map(([date, amount]) => ({ date, amount }));
    },
  });

  const { data: recentActivity } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const [leads, tickets, payments] = await Promise.all([
        supabase.from("leads").select("id, name, stage, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("tickets").select("id, description, status, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("payments").select("id, amount, status, created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      const activities = [
        ...(leads.data?.map(l => ({ type: "lead", ...l, time: new Date(l.created_at) })) || []),
        ...(tickets.data?.map(t => ({ type: "ticket", ...t, time: new Date(t.created_at) })) || []),
        ...(payments.data?.map(p => ({ type: "payment", ...p, time: new Date(p.created_at) })) || []),
      ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 8);

      return activities;
    },
  });

  const ticketChartData = stats ? [
    { name: "Open", value: stats.ticketsByStatus["Open"] || 0, color: COLORS.warning },
    { name: "In Progress", value: stats.ticketsByStatus["In Progress"] || 0, color: COLORS.info },
    { name: "Resolved", value: stats.ticketsByStatus["Resolved"] || 0, color: COLORS.success },
    { name: "Closed", value: stats.ticketsByStatus["Closed"] || 0, color: COLORS.muted },
  ] : [];

  const leadFunnelData = stats ? [
    { stage: "New", count: stats.leadsByStage["New"] || 0 },
    { stage: "Contacted", count: stats.leadsByStage["Contacted"] || 0 },
    { stage: "Scheduled", count: stats.leadsByStage["Scheduled Installation"] || 0 },
    { stage: "Installed", count: stats.leadsByStage["Installed"] || 0 },
    { stage: "Lost", count: stats.leadsByStage["Lost"] || 0 },
  ] : [];

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
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
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.openTickets}</div>
            <p className="text-xs text-muted-foreground">Awaiting resolution</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Customers</CardTitle>
            <UserCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeCustomers}</div>
            <p className="text-xs text-muted-foreground">Currently subscribed</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingPayments}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Month Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats?.monthRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={recentPayments || []}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 20%)" />
                  <XAxis dataKey="date" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222, 47%, 9%)",
                      border: "1px solid hsl(222, 47%, 16%)",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke={COLORS.primary}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tickets by Status */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-warning" />
              Tickets by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ticketChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {ticketChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222, 47%, 9%)",
                      border: "1px solid hsl(222, 47%, 16%)",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-4 justify-center mt-4">
              {ticketChartData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-muted-foreground">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Leads Funnel */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-info" />
              Leads Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadFunnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 20%)" />
                  <XAxis type="number" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <YAxis type="category" dataKey="stage" stroke="hsl(215, 20%, 65%)" fontSize={12} width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222, 47%, 9%)",
                      border: "1px solid hsl(222, 47%, 16%)",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill={COLORS.info} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[280px] overflow-auto">
              {recentActivity?.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                  <div className={`p-2 rounded-lg ${
                    activity.type === "lead" ? "bg-info/20 text-info" :
                    activity.type === "ticket" ? "bg-warning/20 text-warning" :
                    "bg-success/20 text-success"
                  }`}>
                    {activity.type === "lead" ? <Users className="h-4 w-4" /> :
                     activity.type === "ticket" ? <Ticket className="h-4 w-4" /> :
                     <CreditCard className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {activity.type === "lead" && `New lead: ${(activity as any).name}`}
                      {activity.type === "ticket" && `Ticket: ${(activity as any).description?.slice(0, 40)}...`}
                      {activity.type === "payment" && `Payment: ₹${Number((activity as any).amount).toLocaleString()}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(activity.time, "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
