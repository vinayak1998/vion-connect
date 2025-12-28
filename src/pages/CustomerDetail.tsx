import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Phone,
  MapPin,
  Calendar,
  Package,
  Ticket,
  CreditCard,
  UserCircle,
  Plus,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Constants } from "@/integrations/supabase/types";

const statusColors: Record<string, string> = {
  Active: "bg-success/20 text-success border-success/30",
  Suspended: "bg-warning/20 text-warning border-warning/30",
  Churned: "bg-destructive/20 text-destructive border-destructive/30",
};

export default function CustomerDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select(`
          *,
          partner:partners(name, phone)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: currentPlan } = useQuery({
    queryKey: ["customer-plan", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_plans")
        .select(`
          *,
          plan:plans(*)
        `)
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: tickets } = useQuery({
    queryKey: ["customer-tickets", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data;
    },
    enabled: !!id,
  });

  const { data: payments } = useQuery({
    queryKey: ["customer-payments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select(`
          *,
          plan:plans(name)
        `)
        .eq("customer_id", id)
        .order("date", { ascending: false })
        .limit(5);
      return data;
    },
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: async (status: typeof Constants.public.Enums.customer_status[number]) => {
      const { error } = await supabase
        .from("customers")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Status updated");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!customer) {
    return <div>Customer not found</div>;
  }

  const daysRemaining = currentPlan
    ? differenceInDays(new Date(currentPlan.expiry_date), new Date())
    : 0;
  const planProgress = currentPlan
    ? Math.max(0, Math.min(100, (daysRemaining / currentPlan.plan.validity_days) * 100))
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/customers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <div className="flex items-center gap-4 text-muted-foreground text-sm mt-1">
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {customer.phone}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {customer.pincode}
            </span>
          </div>
        </div>
        <Select value={customer.status} onValueChange={(v) => updateStatus.mutate(v as typeof customer.status)}>
          <SelectTrigger className="w-[140px]">
            <Badge variant="outline" className={statusColors[customer.status]}>
              {customer.status}
            </Badge>
          </SelectTrigger>
          <SelectContent>
            {Constants.public.Enums.customer_status.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Plan */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Current Plan
              </CardTitle>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Change Plan
              </Button>
            </CardHeader>
            <CardContent>
              {currentPlan ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">{currentPlan.plan.name}</h3>
                      <p className="text-muted-foreground">
                        {currentPlan.plan.speed_mbps} Mbps • ₹{currentPlan.plan.price}
                      </p>
                    </div>
                    <Badge variant={daysRemaining > 7 ? "default" : "destructive"}>
                      {daysRemaining > 0 ? `${daysRemaining} days left` : "Expired"}
                    </Badge>
                  </div>
                  <Progress value={planProgress} className="h-2" />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Start: {format(new Date(currentPlan.start_date), "MMM d, yyyy")}</span>
                    <span>Expiry: {format(new Date(currentPlan.expiry_date), "MMM d, yyyy")}</span>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No active plan</p>
              )}
            </CardContent>
          </Card>

          {/* Tickets */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-warning" />
                Recent Tickets
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link to="/tickets">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {tickets && tickets.length > 0 ? (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ticket.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(ticket.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge variant="outline">{ticket.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No tickets</p>
              )}
            </CardContent>
          </Card>

          {/* Payments */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-success" />
                Payment History
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link to="/payments">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {payments && payments.length > 0 ? (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                    >
                      <div>
                        <p className="font-medium">₹{Number(payment.amount).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {payment.plan?.name || "General"} • {payment.method}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={payment.status === "Paid" ? "default" : "secondary"}>
                          {payment.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(payment.date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No payments</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-primary" />
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{customer.address}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Installation Date</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {customer.installation_date
                    ? format(new Date(customer.installation_date), "MMM d, yyyy")
                    : "-"}
                </p>
              </div>
              {customer.partner && (
                <div>
                  <p className="text-sm text-muted-foreground">Partner</p>
                  <p className="font-medium">{customer.partner.name}</p>
                  <p className="text-sm text-muted-foreground">{customer.partner.phone}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Customer Since</p>
                <p className="font-medium">
                  {format(new Date(customer.created_at), "MMM d, yyyy")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/payments">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Record Payment
                </Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/tickets">
                  <Ticket className="h-4 w-4 mr-2" />
                  Create Ticket
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
