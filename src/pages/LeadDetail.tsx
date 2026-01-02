import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, CalendarIcon, Save, Wrench, UserPlus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Constants } from "@/integrations/supabase/types";

const stageColors: Record<string, string> = {
  New: "bg-info/20 text-info border-info/30",
  Contacted: "bg-warning/20 text-warning border-warning/30",
  "Scheduled Installation": "bg-primary/20 text-primary border-primary/30",
  Installed: "bg-success/20 text-success border-success/30",
  Lost: "bg-destructive/20 text-destructive border-destructive/30",
};

interface ConvertForm {
  plan_id: string;
  partner_id: string;
  installation_date: Date | undefined;
  create_install_ticket: boolean;
}

const defaultConvertForm: ConvertForm = {
  plan_id: "",
  partner_id: "",
  installation_date: new Date(),
  create_install_ticket: true,
};

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [followupDate, setFollowupDate] = useState<Date | undefined>();
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [convertForm, setConvertForm] = useState<ConvertForm>(defaultConvertForm);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      if (data.next_followup_date) {
        setFollowupDate(new Date(data.next_followup_date));
      }
      return data;
    },
  });

  const { data: booking } = useQuery({
    queryKey: ["lead-booking", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("lead_id", id)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: partners } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("*");
      return data;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["plans-active"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").eq("active", true).order("price");
      return data;
    },
  });

  const updateLead = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const createInstallTicket = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("install_tickets").insert({
        lead_id: id,
        scheduled_date: format(new Date(), "yyyy-MM-dd"),
        status: "Open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Installation ticket created");
      navigate("/installations");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const convertToCustomer = useMutation({
    mutationFn: async (form: ConvertForm) => {
      const { data, error } = await supabase.functions.invoke("lead-to-customer", {
        body: {
          lead_id: id,
          plan_id: form.plan_id,
          partner_id: form.partner_id || null,
          installation_date: form.installation_date ? format(form.installation_date, "yyyy-MM-dd") : null,
          create_install_ticket: form.create_install_ticket,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setIsConvertOpen(false);
      toast.success("Lead converted to customer!");
      if (data?.customer_id) {
        navigate(`/customers/${data.customer_id}`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to convert lead");
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateLead.mutate({
      name: formData.get("name"),
      phone: formData.get("phone"),
      address: formData.get("address"),
      pincode: formData.get("pincode"),
      source: formData.get("source"),
      notes: formData.get("notes"),
      owner: formData.get("owner") || null,
      next_followup_date: followupDate ? format(followupDate, "yyyy-MM-dd") : null,
    });
  };

  const handleStageChange = (stage: string) => {
    updateLead.mutate({ stage });
  };

  const canConvert = lead?.stage !== "Lost" && lead?.stage !== "Installed";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!lead) {
    return <div>Lead not found</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/leads">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{lead.name}</h1>
          <p className="text-muted-foreground">{lead.phone}</p>
        </div>
        <Badge variant="outline" className={cn("ml-auto", stageColors[lead.stage])}>
          {lead.stage}
        </Badge>
      </div>

      {/* Stage Pipeline */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Stage Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {Constants.public.Enums.lead_stage.map((stage) => (
              <Button
                key={stage}
                variant={lead.stage === stage ? "default" : "outline"}
                size="sm"
                onClick={() => handleStageChange(stage)}
                disabled={updateLead.isPending}
              >
                {stage}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            {lead.stage === "Scheduled Installation" && (
              <Button
                onClick={() => createInstallTicket.mutate()}
                disabled={createInstallTicket.isPending}
              >
                <Wrench className="h-4 w-4 mr-2" />
                Create Installation Ticket
              </Button>
            )}
            {canConvert && (
              <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Convert to Customer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Convert Lead to Customer</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Plan *</Label>
                      <Select
                        value={convertForm.plan_id}
                        onValueChange={(v) => setConvertForm({ ...convertForm, plan_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans?.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name} - ₹{plan.price} ({plan.speed_mbps} Mbps)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Partner (Optional)</Label>
                      <Select
                        value={convertForm.partner_id}
                        onValueChange={(v) => setConvertForm({ ...convertForm, partner_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a partner" />
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
                    <div className="space-y-2">
                      <Label>Installation Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !convertForm.installation_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {convertForm.installation_date
                              ? format(convertForm.installation_date, "PPP")
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={convertForm.installation_date}
                            onSelect={(date) => setConvertForm({ ...convertForm, installation_date: date })}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Create Installation Ticket</Label>
                      <Switch
                        checked={convertForm.create_install_ticket}
                        onCheckedChange={(checked) =>
                          setConvertForm({ ...convertForm, create_install_ticket: checked })
                        }
                      />
                    </div>
                    <Button
                      onClick={() => convertToCustomer.mutate(convertForm)}
                      disabled={!convertForm.plan_id || convertToCustomer.isPending}
                      className="w-full"
                    >
                      {convertToCustomer.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Converting...
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Convert to Customer
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lead Info Form */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Lead Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" defaultValue={lead.name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={lead.phone} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input id="pincode" name="pincode" defaultValue={lead.pincode} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <Select name="source" defaultValue={lead.source || "Website"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="Referral">Referral</SelectItem>
                      <SelectItem value="Walk-in">Walk-in</SelectItem>
                      <SelectItem value="Partner">Partner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" name="address" defaultValue={lead.address} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="owner">Assigned To</Label>
                  <Input id="owner" name="owner" defaultValue={lead.owner || ""} placeholder="Owner name" />
                </div>
                <div className="space-y-2">
                  <Label>Next Follow-up</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !followupDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {followupDate ? format(followupDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={followupDate}
                        onSelect={setFollowupDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" defaultValue={lead.notes || ""} rows={4} />
              </div>
              <Button type="submit" disabled={updateLead.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sidebar Info */}
        <div className="space-y-4">
          {booking && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Booking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">₹{booking.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={booking.status === "Paid" ? "default" : "secondary"}>
                    {booking.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span>{format(new Date(booking.created_at), "MMM d, yyyy")}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                  <div>
                    <p className="font-medium">Lead Created</p>
                    <p className="text-muted-foreground">
                      {format(new Date(lead.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                </div>
                {lead.updated_at !== lead.created_at && (
                  <div className="flex gap-3">
                    <div className="h-2 w-2 rounded-full bg-muted mt-1.5" />
                    <div>
                      <p className="font-medium">Last Updated</p>
                      <p className="text-muted-foreground">
                        {format(new Date(lead.updated_at), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
