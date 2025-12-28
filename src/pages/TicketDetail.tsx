import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, User, Tag, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import type { Database } from "@/integrations/supabase/types";

type TicketStatus = Database["public"]["Enums"]["ticket_status"];
type TicketPriority = Database["public"]["Enums"]["ticket_priority"];

const statusColors: Record<TicketStatus, string> = {
  Open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "In Progress": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Resolved: "bg-green-500/20 text-green-400 border-green-500/30",
  Closed: "bg-muted text-muted-foreground border-muted",
};

const priorityColors: Record<TicketPriority, string> = {
  Low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  Medium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  High: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

const statusFlow: TicketStatus[] = ["Open", "In Progress", "Resolved", "Closed"];

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [resolutionNotes, setResolutionNotes] = useState("");

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          customers(id, name, phone, address),
          ticket_categories(name, assignment_type),
          partners(name)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (ticket?.resolution_notes) {
      setResolutionNotes(ticket.resolution_notes);
    }
  }, [ticket?.resolution_notes]);

  const updateMutation = useMutation({
    mutationFn: async (updates: { status?: TicketStatus; resolution_notes?: string }) => {
      const { error } = await supabase
        .from("tickets")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Ticket updated");
    },
    onError: () => toast.error("Failed to update ticket"),
  });

  const handleStatusChange = (newStatus: TicketStatus) => {
    updateMutation.mutate({ status: newStatus });
  };

  const handleSaveNotes = () => {
    updateMutation.mutate({ resolution_notes: resolutionNotes });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ticket not found</p>
        <Button variant="link" onClick={() => navigate("/tickets")}>
          Back to Tickets
        </Button>
      </div>
    );
  }

  const customer = ticket.customers as { id: string; name: string; phone: string; address: string } | null;
  const category = ticket.ticket_categories as { name: string; assignment_type: string } | null;
  const partner = ticket.partners as { name: string } | null;
  const currentStatusIndex = statusFlow.indexOf(ticket.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/tickets")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Ticket Details</h1>
          <p className="text-muted-foreground">
            Created {format(new Date(ticket.created_at), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{customer?.name || "Unknown"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{customer?.phone || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="font-medium">{customer?.address || "-"}</p>
            </div>
            {customer && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate(`/customers/${customer.id}`)}
              >
                View Customer Profile
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Ticket Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Category</span>
              <span className="font-medium">{category?.name || "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Priority</span>
              <Badge variant="outline" className={priorityColors[ticket.priority]}>
                {ticket.priority}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="outline" className={statusColors[ticket.status]}>
                {ticket.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Assignment</span>
              <span className="font-medium">
                {ticket.assigned_to_type === "Partner"
                  ? partner?.name || "Unassigned Partner"
                  : ticket.internal_queue || "Internal Queue"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Issue Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{ticket.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Status Workflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {statusFlow.map((status, index) => (
              <Button
                key={status}
                variant={ticket.status === status ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusChange(status)}
                disabled={updateMutation.isPending}
                className={ticket.status === status ? "" : index <= currentStatusIndex ? "opacity-50" : ""}
              >
                {status}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resolution Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Add resolution notes..."
              rows={4}
            />
          </div>
          <Button
            onClick={handleSaveNotes}
            disabled={updateMutation.isPending || resolutionNotes === ticket.resolution_notes}
          >
            Save Notes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
