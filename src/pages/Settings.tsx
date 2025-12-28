import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Pencil, Trash2, Users, MapPin, Tag } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type TicketAssignmentType = Database["public"]["Enums"]["ticket_assignment_type"];

// Partner Form
interface PartnerForm {
  name: string;
  phone: string;
  notes: string;
}

const defaultPartner: PartnerForm = { name: "", phone: "", notes: "" };

// Area Form
interface AreaForm {
  pincode: string;
  area_name: string;
  partner_id: string;
  is_active: boolean;
}

const defaultArea: AreaForm = { pincode: "", area_name: "", partner_id: "", is_active: true };

// Category Form
interface CategoryForm {
  name: string;
  assignment_type: TicketAssignmentType;
}

const defaultCategory: CategoryForm = { name: "", assignment_type: "Internal" };

export default function Settings() {
  const queryClient = useQueryClient();

  // Partners state
  const [isPartnerOpen, setIsPartnerOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<string | null>(null);
  const [partnerForm, setPartnerForm] = useState<PartnerForm>(defaultPartner);

  // Areas state
  const [isAreaOpen, setIsAreaOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [areaForm, setAreaForm] = useState<AreaForm>(defaultArea);

  // Categories state
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(defaultCategory);

  // Queries
  const { data: partners, isLoading: loadingPartners } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: areas, isLoading: loadingAreas } = useQuery({
    queryKey: ["serviceable-areas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("serviceable_areas")
        .select(`*, partners(name)`)
        .order("pincode");
      if (error) throw error;
      return data;
    },
  });

  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Partner mutations
  const createPartnerMutation = useMutation({
    mutationFn: async (partner: PartnerForm) => {
      const { error } = await supabase.from("partners").insert(partner);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      setIsPartnerOpen(false);
      setPartnerForm(defaultPartner);
      toast.success("Partner created");
    },
    onError: () => toast.error("Failed to create partner"),
  });

  const updatePartnerMutation = useMutation({
    mutationFn: async ({ id, ...partner }: PartnerForm & { id: string }) => {
      const { error } = await supabase.from("partners").update(partner).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      setEditingPartner(null);
      setPartnerForm(defaultPartner);
      toast.success("Partner updated");
    },
    onError: () => toast.error("Failed to update partner"),
  });

  const deletePartnerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast.success("Partner deleted");
    },
    onError: () => toast.error("Failed to delete partner"),
  });

  // Area mutations
  const createAreaMutation = useMutation({
    mutationFn: async (area: AreaForm) => {
      const { error } = await supabase.from("serviceable_areas").insert({
        ...area,
        partner_id: area.partner_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceable-areas"] });
      setIsAreaOpen(false);
      setAreaForm(defaultArea);
      toast.success("Area created");
    },
    onError: () => toast.error("Failed to create area"),
  });

  const updateAreaMutation = useMutation({
    mutationFn: async ({ id, ...area }: AreaForm & { id: string }) => {
      const { error } = await supabase
        .from("serviceable_areas")
        .update({ ...area, partner_id: area.partner_id || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceable-areas"] });
      setEditingArea(null);
      setAreaForm(defaultArea);
      toast.success("Area updated");
    },
    onError: () => toast.error("Failed to update area"),
  });

  const toggleAreaMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("serviceable_areas").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceable-areas"] });
      toast.success("Area status updated");
    },
    onError: () => toast.error("Failed to update area status"),
  });

  const deleteAreaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("serviceable_areas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceable-areas"] });
      toast.success("Area deleted");
    },
    onError: () => toast.error("Failed to delete area"),
  });

  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: async (category: CategoryForm) => {
      const { error } = await supabase.from("ticket_categories").insert(category);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-categories"] });
      setIsCategoryOpen(false);
      setCategoryForm(defaultCategory);
      toast.success("Category created");
    },
    onError: () => toast.error("Failed to create category"),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...category }: CategoryForm & { id: string }) => {
      const { error } = await supabase.from("ticket_categories").update(category).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-categories"] });
      setEditingCategory(null);
      setCategoryForm(defaultCategory);
      toast.success("Category updated");
    },
    onError: () => toast.error("Failed to update category"),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ticket_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-categories"] });
      toast.success("Category deleted");
    },
    onError: () => toast.error("Failed to delete category"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage partners, areas, and categories</p>
      </div>

      <Tabs defaultValue="partners" className="space-y-6">
        <TabsList>
          <TabsTrigger value="partners" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="areas" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Serviceable Areas
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Ticket Categories
          </TabsTrigger>
        </TabsList>

        {/* Partners Tab */}
        <TabsContent value="partners" className="space-y-4">
          <div className="flex justify-end">
            <Dialog
              open={isPartnerOpen || !!editingPartner}
              onOpenChange={(open) => {
                if (!open) {
                  setIsPartnerOpen(false);
                  setEditingPartner(null);
                  setPartnerForm(defaultPartner);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={() => setIsPartnerOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Partner
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingPartner ? "Edit Partner" : "Add Partner"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={partnerForm.name}
                      onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={partnerForm.phone}
                      onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={partnerForm.notes}
                      onChange={(e) => setPartnerForm({ ...partnerForm, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={() =>
                      editingPartner
                        ? updatePartnerMutation.mutate({ id: editingPartner, ...partnerForm })
                        : createPartnerMutation.mutate(partnerForm)
                    }
                    disabled={!partnerForm.name || !partnerForm.phone}
                    className="w-full"
                  >
                    {editingPartner ? "Update" : "Create"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPartners ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : partners?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No partners found
                    </TableCell>
                  </TableRow>
                ) : (
                  partners?.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell className="font-medium">{partner.name}</TableCell>
                      <TableCell>{partner.phone}</TableCell>
                      <TableCell className="text-muted-foreground">{partner.notes || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setPartnerForm({
                                name: partner.name,
                                phone: partner.phone,
                                notes: partner.notes || "",
                              });
                              setEditingPartner(partner.id);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePartnerMutation.mutate(partner.id)}
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
        </TabsContent>

        {/* Areas Tab */}
        <TabsContent value="areas" className="space-y-4">
          <div className="flex justify-end">
            <Dialog
              open={isAreaOpen || !!editingArea}
              onOpenChange={(open) => {
                if (!open) {
                  setIsAreaOpen(false);
                  setEditingArea(null);
                  setAreaForm(defaultArea);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={() => setIsAreaOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Area
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingArea ? "Edit Area" : "Add Area"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Pincode</Label>
                    <Input
                      value={areaForm.pincode}
                      onChange={(e) => setAreaForm({ ...areaForm, pincode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Area Name</Label>
                    <Input
                      value={areaForm.area_name}
                      onChange={(e) => setAreaForm({ ...areaForm, area_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Partner</Label>
                    <Select
                      value={areaForm.partner_id}
                      onValueChange={(v) => setAreaForm({ ...areaForm, partner_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select partner" />
                      </SelectTrigger>
                      <SelectContent>
                        {partners?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Active</Label>
                    <Switch
                      checked={areaForm.is_active}
                      onCheckedChange={(checked) => setAreaForm({ ...areaForm, is_active: checked })}
                    />
                  </div>
                  <Button
                    onClick={() =>
                      editingArea
                        ? updateAreaMutation.mutate({ id: editingArea, ...areaForm })
                        : createAreaMutation.mutate(areaForm)
                    }
                    disabled={!areaForm.pincode || !areaForm.area_name}
                    className="w-full"
                  >
                    {editingArea ? "Update" : "Create"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pincode</TableHead>
                  <TableHead>Area Name</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAreas ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : areas?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No areas found
                    </TableCell>
                  </TableRow>
                ) : (
                  areas?.map((area) => (
                    <TableRow key={area.id}>
                      <TableCell className="font-mono">{area.pincode}</TableCell>
                      <TableCell className="font-medium">{area.area_name}</TableCell>
                      <TableCell>
                        {(area.partners as { name: string } | null)?.name || "-"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={area.is_active}
                          onCheckedChange={(checked) =>
                            toggleAreaMutation.mutate({ id: area.id, is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setAreaForm({
                                pincode: area.pincode,
                                area_name: area.area_name,
                                partner_id: area.partner_id || "",
                                is_active: area.is_active,
                              });
                              setEditingArea(area.id);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAreaMutation.mutate(area.id)}
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
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            <Dialog
              open={isCategoryOpen || !!editingCategory}
              onOpenChange={(open) => {
                if (!open) {
                  setIsCategoryOpen(false);
                  setEditingCategory(null);
                  setCategoryForm(defaultCategory);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={() => setIsCategoryOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assignment Type</Label>
                    <Select
                      value={categoryForm.assignment_type}
                      onValueChange={(v) =>
                        setCategoryForm({ ...categoryForm, assignment_type: v as TicketAssignmentType })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Internal">Internal</SelectItem>
                        <SelectItem value="Partner">Partner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() =>
                      editingCategory
                        ? updateCategoryMutation.mutate({ id: editingCategory, ...categoryForm })
                        : createCategoryMutation.mutate(categoryForm)
                    }
                    disabled={!categoryForm.name}
                    className="w-full"
                  >
                    {editingCategory ? "Update" : "Create"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Assignment Type</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingCategories ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 3 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : categories?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No categories found
                    </TableCell>
                  </TableRow>
                ) : (
                  categories?.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>{category.assignment_type}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setCategoryForm({
                                name: category.name,
                                assignment_type: category.assignment_type,
                              });
                              setEditingCategory(category.id);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteCategoryMutation.mutate(category.id)}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
