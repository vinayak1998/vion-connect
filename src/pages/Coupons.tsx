import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Tag, Eye, Percent, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type CouponType = Database["public"]["Enums"]["coupon_type"];

interface CouponForm {
  code: string;
  type: CouponType;
  value: number;
  expiry_date: string;
  max_uses: number | null;
  active: boolean;
}

const defaultCoupon: CouponForm = {
  code: "",
  type: "percentage",
  value: 10,
  expiry_date: "",
  max_uses: null,
  active: true,
};

export default function Coupons() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<string | null>(null);
  const [viewingRedemptions, setViewingRedemptions] = useState<string | null>(null);
  const [formData, setFormData] = useState<CouponForm>(defaultCoupon);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: redemptions } = useQuery({
    queryKey: ["coupon-redemptions", viewingRedemptions],
    enabled: !!viewingRedemptions,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupon_redemptions")
        .select(`
          *,
          customers(name),
          payments(amount, date)
        `)
        .eq("coupon_id", viewingRedemptions)
        .order("redeemed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (coupon: CouponForm) => {
      const { error } = await supabase.from("coupons").insert({
        code: coupon.code.toUpperCase(),
        type: coupon.type,
        value: coupon.value,
        expiry_date: coupon.expiry_date || null,
        max_uses: coupon.max_uses,
        active: coupon.active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setIsCreateOpen(false);
      setFormData(defaultCoupon);
      toast.success("Coupon created successfully");
    },
    onError: () => toast.error("Failed to create coupon"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...coupon }: CouponForm & { id: string }) => {
      const { error } = await supabase
        .from("coupons")
        .update({
          code: coupon.code.toUpperCase(),
          type: coupon.type,
          value: coupon.value,
          expiry_date: coupon.expiry_date || null,
          max_uses: coupon.max_uses,
          active: coupon.active,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setEditingCoupon(null);
      setFormData(defaultCoupon);
      toast.success("Coupon updated successfully");
    },
    onError: () => toast.error("Failed to update coupon"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("coupons").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success("Coupon status updated");
    },
    onError: () => toast.error("Failed to update coupon status"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success("Coupon deleted");
    },
    onError: () => toast.error("Failed to delete coupon"),
  });

  const handleEdit = (coupon: NonNullable<typeof coupons>[number]) => {
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      expiry_date: coupon.expiry_date || "",
      max_uses: coupon.max_uses,
      active: coupon.active,
    });
    setEditingCoupon(coupon.id);
  };

  const handleSubmit = () => {
    if (editingCoupon) {
      updateMutation.mutate({ id: editingCoupon, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const closeDialog = () => {
    setIsCreateOpen(false);
    setEditingCoupon(null);
    setFormData(defaultCoupon);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Coupons</h1>
          <p className="text-muted-foreground">Manage discount coupons</p>
        </div>
        <Dialog open={isCreateOpen || !!editingCoupon} onOpenChange={(open) => !open && closeDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Coupon
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCoupon ? "Edit Coupon" : "Add New Coupon"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Coupon Code</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., SAVE20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v as CouponType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="flat">Flat (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Uses (Optional)</Label>
                  <Input
                    type="number"
                    value={formData.max_uses || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, max_uses: e.target.value ? parseInt(e.target.value) : null })
                    }
                    placeholder="Unlimited"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
              </div>
              <Button onClick={handleSubmit} disabled={!formData.code || !formData.value} className="w-full">
                {editingCoupon ? "Update Coupon" : "Create Coupon"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!viewingRedemptions} onOpenChange={(open) => !open && setViewingRedemptions(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Coupon Redemptions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-auto">
            {redemptions?.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No redemptions yet</p>
            ) : (
              redemptions?.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{(r.customers as { name: string } | null)?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      ₹{(r.payments as { amount: number } | null)?.amount}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(r.redeemed_at), "MMM d, yyyy")}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : coupons?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No coupons found
                </TableCell>
              </TableRow>
            ) : (
              coupons?.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <span className="font-mono font-medium">{coupon.code}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {coupon.type === "percentage" ? (
                        <Percent className="h-3 w-3 mr-1" />
                      ) : (
                        <IndianRupee className="h-3 w-3 mr-1" />
                      )}
                      {coupon.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {coupon.type === "percentage" ? `${coupon.value}%` : `₹${coupon.value}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {coupon.expiry_date ? format(new Date(coupon.expiry_date), "MMM d, yyyy") : "Never"}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm">
                        {coupon.uses_count} / {coupon.max_uses || "∞"}
                      </div>
                      {coupon.max_uses && (
                        <Progress
                          value={(coupon.uses_count / coupon.max_uses) * 100}
                          className="h-1.5"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={coupon.active}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ id: coupon.id, active: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewingRedemptions(coupon.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(coupon)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(coupon.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
