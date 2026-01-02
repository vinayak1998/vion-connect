import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, CreditCard, Tag, Check, X, Send, Download, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

const statusColors: Record<PaymentStatus, string> = {
  Paid: "bg-green-500/20 text-green-400 border-green-500/30",
  Pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Failed: "bg-red-500/20 text-red-400 border-red-500/30",
};

const methodColors: Record<PaymentMethod, string> = {
  UPI: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Cash: "bg-green-500/20 text-green-400 border-green-500/30",
  Card: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Bank Transfer": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  Other: "bg-muted text-muted-foreground border-muted",
};

interface PaymentForm {
  customer_id: string;
  plan_id: string;
  amount: number;
  original_amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  coupon_code: string;
  coupon_id: string | null;
  notes: string;
}

const defaultPayment: PaymentForm = {
  customer_id: "",
  plan_id: "",
  amount: 0,
  original_amount: 0,
  method: "UPI",
  status: "Paid",
  coupon_code: "",
  coupon_id: null,
  notes: "",
};

interface PaymentLinkForm {
  customer_id: string;
  plan_id: string;
  amount: number;
  send_email: boolean;
}

const defaultPaymentLink: PaymentLinkForm = {
  customer_id: "",
  plan_id: "",
  amount: 0,
  send_email: true,
};

export default function Payments() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentLinkOpen, setIsPaymentLinkOpen] = useState(false);
  const [formData, setFormData] = useState<PaymentForm>(defaultPayment);
  const [paymentLinkForm, setPaymentLinkForm] = useState<PaymentLinkForm>(defaultPaymentLink);
  const [couponValid, setCouponValid] = useState<boolean | null>(null);
  const [discount, setDiscount] = useState(0);

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("payments")
        .select(`
          *,
          customers(name, phone),
          plans(name, price),
          coupons(code, type, value)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as PaymentStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["plans-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("active", true)
        .order("price");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payment: PaymentForm) => {
      const { coupon_code, ...paymentData } = payment;
      const { error } = await supabase.from("payments").insert({
        customer_id: paymentData.customer_id,
        plan_id: paymentData.plan_id || null,
        amount: paymentData.amount,
        original_amount: paymentData.original_amount || paymentData.amount,
        method: paymentData.method,
        status: paymentData.status,
        coupon_id: paymentData.coupon_id,
        notes: paymentData.notes || null,
      });
      if (error) throw error;

      // Update coupon uses_count if a coupon was used
      if (paymentData.coupon_id) {
        const { data: coupon } = await supabase
          .from("coupons")
          .select("uses_count")
          .eq("id", paymentData.coupon_id)
          .single();
        
        if (coupon) {
          await supabase
            .from("coupons")
            .update({ uses_count: coupon.uses_count + 1 })
            .eq("id", paymentData.coupon_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setIsCreateOpen(false);
      setFormData(defaultPayment);
      setCouponValid(null);
      setDiscount(0);
      toast.success("Payment recorded successfully");
    },
    onError: () => toast.error("Failed to record payment"),
  });

  const sendPaymentLinkMutation = useMutation({
    mutationFn: async (form: PaymentLinkForm) => {
      // First create a pending payment record
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          customer_id: form.customer_id,
          plan_id: form.plan_id || null,
          amount: form.amount,
          original_amount: form.amount,
          status: "Pending",
          method: "UPI",
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Get customer details
      const { data: customer } = await supabase
        .from("customers")
        .select("name, phone")
        .eq("id", form.customer_id)
        .single();

      // Call edge function to create payment link
      const { data, error } = await supabase.functions.invoke("create-payment-link", {
        body: {
          payment_id: payment.id,
          amount: form.amount,
          customer_name: customer?.name,
          customer_phone: customer?.phone,
          send_email: form.send_email,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setIsPaymentLinkOpen(false);
      setPaymentLinkForm(defaultPaymentLink);
      toast.success("Payment link created and sent!");
      if (data?.short_url) {
        navigator.clipboard.writeText(data.short_url);
        toast.info("Payment link copied to clipboard");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create payment link");
    },
  });

  const handlePlanChange = (planId: string) => {
    const plan = plans?.find((p) => p.id === planId);
    if (plan) {
      setFormData({
        ...formData,
        plan_id: planId,
        amount: plan.price,
        original_amount: plan.price,
      });
      setDiscount(0);
      setCouponValid(null);
      setFormData((prev) => ({ ...prev, coupon_code: "", coupon_id: null }));
    }
  };

  const handlePaymentLinkPlanChange = (planId: string) => {
    const plan = plans?.find((p) => p.id === planId);
    if (plan) {
      setPaymentLinkForm({
        ...paymentLinkForm,
        plan_id: planId,
        amount: plan.price,
      });
    }
  };

  const handleApplyCoupon = async () => {
    if (!formData.coupon_code) return;

    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", formData.coupon_code.toUpperCase())
      .eq("active", true)
      .single();

    if (error || !coupon) {
      setCouponValid(false);
      toast.error("Invalid or inactive coupon");
      return;
    }

    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
      setCouponValid(false);
      toast.error("Coupon has expired");
      return;
    }

    if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
      setCouponValid(false);
      toast.error("Coupon usage limit reached");
      return;
    }

    let discountAmount = 0;
    if (coupon.type === "percentage") {
      discountAmount = (formData.original_amount * coupon.value) / 100;
    } else {
      discountAmount = coupon.value;
    }

    const finalAmount = Math.max(0, formData.original_amount - discountAmount);
    setDiscount(discountAmount);
    setFormData({
      ...formData,
      amount: finalAmount,
      coupon_id: coupon.id,
    });
    setCouponValid(true);
    toast.success(`Coupon applied! Discount: ₹${discountAmount}`);
  };

  const filteredPayments = payments?.filter((payment) => {
    const customerName = (payment.customers as { name: string } | null)?.name || "";
    return customerName.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">Track and record payments</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isPaymentLinkOpen} onOpenChange={setIsPaymentLinkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Send className="mr-2 h-4 w-4" />
                Send Payment Link
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Send Payment Link</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select
                    value={paymentLinkForm.customer_id}
                    onValueChange={(v) => setPaymentLinkForm({ ...paymentLinkForm, customer_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} - {c.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={paymentLinkForm.plan_id} onValueChange={handlePaymentLinkPlanChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} - ₹{p.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input
                    type="number"
                    value={paymentLinkForm.amount}
                    onChange={(e) =>
                      setPaymentLinkForm({
                        ...paymentLinkForm,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Send Email Notification</Label>
                  <Switch
                    checked={paymentLinkForm.send_email}
                    onCheckedChange={(checked) =>
                      setPaymentLinkForm({ ...paymentLinkForm, send_email: checked })
                    }
                  />
                </div>
                <Button
                  onClick={() => sendPaymentLinkMutation.mutate(paymentLinkForm)}
                  disabled={!paymentLinkForm.customer_id || !paymentLinkForm.amount || sendPaymentLinkMutation.isPending}
                  className="w-full"
                >
                  {sendPaymentLinkMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Payment Link
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Record New Payment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select
                    value={formData.customer_id}
                    onValueChange={(v) => setFormData({ ...formData, customer_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} - {c.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plan (Optional)</Label>
                  <Select value={formData.plan_id} onValueChange={handlePlanChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} - ₹{p.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        amount: parseFloat(e.target.value) || 0,
                        original_amount: formData.original_amount || parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Coupon Code</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.coupon_code}
                      onChange={(e) => {
                        setFormData({ ...formData, coupon_code: e.target.value.toUpperCase() });
                        setCouponValid(null);
                      }}
                      placeholder="Enter coupon code"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleApplyCoupon}
                      disabled={!formData.coupon_code || !formData.original_amount}
                    >
                      Apply
                    </Button>
                  </div>
                  {couponValid === true && (
                    <p className="text-sm text-green-400 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Discount: ₹{discount}
                    </p>
                  )}
                  {couponValid === false && (
                    <p className="text-sm text-red-400 flex items-center gap-1">
                      <X className="h-3 w-3" /> Invalid coupon
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select
                      value={formData.method}
                      onValueChange={(v) => setFormData({ ...formData, method: v as PaymentMethod })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Card">Card</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v as PaymentStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paid">Paid</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={2}
                  />
                </div>
                <Button
                  onClick={() => createMutation.mutate(formData)}
                  disabled={!formData.customer_id || !formData.amount}
                  className="w-full"
                >
                  Record Payment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Coupon</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredPayments?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No payments found
                </TableCell>
              </TableRow>
            ) : (
              filteredPayments?.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">
                    {(payment.customers as { name: string } | null)?.name || "Unknown"}
                  </TableCell>
                  <TableCell>
                    {(payment.plans as { name: string } | null)?.name || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">₹{payment.amount}</span>
                      {payment.original_amount && payment.original_amount > payment.amount && (
                        <span className="text-xs text-muted-foreground line-through">
                          ₹{payment.original_amount}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={methodColors[payment.method]}>
                      {payment.method}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[payment.status]}>
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {payment.coupons ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        <Tag className="h-3 w-3 mr-1" />
                        {(payment.coupons as { code: string }).code}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(payment.date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {payment.link_url && payment.status === "Pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(payment.link_url, "_blank")}
                          title="Open payment link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      {payment.invoice_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(payment.invoice_url, "_blank")}
                          title="Download invoice"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
