import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, CalendarIcon, Save, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Constants } from "@/integrations/supabase/types";

const statusColors: Record<string, string> = {
  Open: "bg-warning/20 text-warning border-warning/30",
  "In Progress": "bg-info/20 text-info border-info/30",
  Installed: "bg-primary/20 text-primary border-primary/30",
  Verified: "bg-success/20 text-success border-success/30",
};

export default function InstallationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["install-ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("install_tickets")
        .select(`
          *,
          lead:leads(*),
          customer:customers(*),
          partner:partners(*)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      if (data.scheduled_date) {
        setScheduledDate(new Date(data.scheduled_date));
      }
      return data;
    },
  });

  const { data: partners } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("*");
      return data;
    },
  });

  const updateTicket = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from("install_tickets")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["install-ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["install-tickets"] });
      toast.success("Ticket updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const convertToCustomer = useMutation({
    mutationFn: async () => {
      if (!ticket?.lead) throw new Error("No lead associated");
      
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: ticket.lead.name,
          phone: ticket.lead.phone,
          address: ticket.lead.address,
          pincode: ticket.lead.pincode,
          lead_id: ticket.lead.id,
          partner_id: ticket.partner_id,
          installation_date: format(new Date(), "yyyy-MM-dd"),
          status: "Active",
        })
        .select()
        .single();

      if (customerError) throw customerError;

      // Update install ticket with customer_id
      await supabase
        .from("install_tickets")
        .update({ customer_id: customer.id })
        .eq("id", id);

      // Update lead stage
      await supabase
        .from("leads")
        .update({ stage: "Installed" })
        .eq("id", ticket.lead.id);

      return customer;
    },
    onSuccess: (customer) => {
      toast.success("Customer created successfully");
      navigate(`/customers/${customer.id}`);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateTicket.mutate({
      partner_id: formData.get("partner_id") || null,
      notes: formData.get("notes"),
      scheduled_date: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : null,
    });
  };

  const handleStatusChange = (status: string) => {
    updateTicket.mutate({ status });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!ticket) {
    return <div>Ticket not found</div>;
  }

  const contactInfo = ticket.lead || ticket.customer;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/installations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{contactInfo?.name}</h1>
          <p className="text-muted-foreground">Installation Ticket</p>
        </div>
        <Badge variant="outline" className={cn("ml-auto", statusColors[ticket.status])}>
          {ticket.status}
        </Badge>
      </div>

      {/* Status Pipeline */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {Constants.public.Enums.install_status.map((status) => (
              <Button
                key={status}
                variant={ticket.status === status ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusChange(status)}
                disabled={updateTicket.isPending}
              >
                {status}
              </Button>
            ))}
          </div>
          {ticket.status === "Verified" && ticket.lead && !ticket.customer && (
            <Button
              className="mt-4"
              onClick={() => convertToCustomer.mutate()}
              disabled={convertToCustomer.isPending}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Convert to Customer
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ticket Info Form */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Ticket Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scheduled Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !scheduledDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partner_id">Assigned Partner</Label>
                  <Select name="partner_id" defaultValue={ticket.partner_id || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select partner" />
                    </SelectTrigger>
                    <SelectContent>
                      {partners?.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" defaultValue={ticket.notes || ""} rows={4} />
              </div>
              <Button type="submit" disabled={updateTicket.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{contactInfo?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{contactInfo?.phone}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="font-medium">{contactInfo?.address}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pincode</p>
              <p className="font-medium">{contactInfo?.pincode}</p>
            </div>
            {ticket.partner && (
              <div>
                <p className="text-sm text-muted-foreground">Partner</p>
                <p className="font-medium">{ticket.partner.name}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
