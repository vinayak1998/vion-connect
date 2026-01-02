import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Wifi, MapPin, Phone, User, Home, LogIn, LogOut, LayoutDashboard } from "lucide-react";
import { z } from "zod";
import LandingChatbot from "@/components/LandingChatbot";

const leadSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit phone number"),
  address: z.string().min(5, "Address must be at least 5 characters").max(500),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
});

const waitlistSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit phone number"),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
});

export default function Landing() {
  const navigate = useNavigate();
  const { user, userRole, signIn, signOut, loading } = useAuth();
  
  const [pincode, setPincode] = useState("");
  const [checkResult, setCheckResult] = useState<"available" | "unavailable" | null>(null);
  const [checkedPincode, setCheckedPincode] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  // Lead form state
  const [leadForm, setLeadForm] = useState({ name: "", phone: "", address: "" });
  const [leadErrors, setLeadErrors] = useState<Record<string, string>>({});

  // Waitlist form state
  const [waitlistForm, setWaitlistForm] = useState({ phone: "", email: "" });
  const [waitlistErrors, setWaitlistErrors] = useState<Record<string, string>>({});

  // Login form state
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error("Please enter email and password");
      return;
    }
    setIsLoggingIn(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoggingIn(false);
    if (error) {
      toast.error(error.message || "Login failed");
    } else {
      setLoginOpen(false);
      setLoginEmail("");
      setLoginPassword("");
      toast.success("Logged in successfully");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Logged out successfully");
  };

  const goToDashboard = () => {
    if (userRole === "partner") {
      navigate("/partner/dashboard");
    } else {
      navigate("/dashboard");
    }
  };

  const { data: plans } = useQuery({
    queryKey: ["active-plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("active", true)
        .order("price", { ascending: true });
      return data;
    },
  });

  const checkPincode = async () => {
    if (!/^\d{6}$/.test(pincode)) {
      toast.error("Please enter a valid 6-digit pincode");
      return;
    }
    
    setIsChecking(true);
    const { data } = await supabase
      .from("serviceable_areas")
      .select("id")
      .eq("pincode", pincode)
      .eq("is_active", true)
      .limit(1);
    
    setIsChecking(false);
    setCheckedPincode(pincode);
    setCheckResult(data && data.length > 0 ? "available" : "unavailable");
  };

  const leadMutation = useMutation({
    mutationFn: async (data: z.infer<typeof leadSchema>) => {
      // Create lead
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert({
          name: data.name,
          phone: data.phone,
          address: data.address,
          pincode: data.pincode,
          source: "Website",
          stage: "New",
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // Create booking
      const { error: bookingError } = await supabase
        .from("bookings")
        .insert({
          lead_id: lead.id,
          amount: 50,
          status: "Paid",
        });

      if (bookingError) throw bookingError;
      return lead;
    },
    onSuccess: () => {
      toast.success("Thank you! Our team will contact you shortly.");
      setLeadForm({ name: "", phone: "", address: "" });
      setCheckResult(null);
      setPincode("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Something went wrong");
    },
  });

  const waitlistMutation = useMutation({
    mutationFn: async (data: z.infer<typeof waitlistSchema>) => {
      const { error } = await supabase.from("waitlist").insert({
        phone: data.phone,
        pincode: data.pincode,
        email: data.email || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("You've been added to the waitlist! We'll notify you when we launch in your area.");
      setWaitlistForm({ phone: "", email: "" });
      setCheckResult(null);
      setPincode("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Something went wrong");
    },
  });

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = leadSchema.safeParse({ ...leadForm, pincode: checkedPincode });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0].toString()] = err.message;
      });
      setLeadErrors(errors);
      return;
    }
    setLeadErrors({});
    leadMutation.mutate(result.data);
  };

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = waitlistSchema.safeParse({ ...waitlistForm, pincode: checkedPincode });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0].toString()] = err.message;
      });
      setWaitlistErrors(errors);
      return;
    }
    setWaitlistErrors({});
    waitlistMutation.mutate(result.data);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="gradient-primary py-20 px-4 relative">
        {/* Login/Dashboard Button */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" />
          ) : user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:bg-primary-foreground/20"
                onClick={goToDashboard}
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:bg-primary-foreground/20"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </>
          ) : (
            <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary-foreground hover:bg-primary-foreground/20"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Admin / Partner Login
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Wifi className="h-5 w-5 text-primary" />
                    Vion Portal Login
                  </DialogTitle>
                  <DialogDescription>
                    Sign in to access the Admin or Partner dashboard
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoggingIn}>
                    {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Sign In
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-primary-foreground/20 rounded-xl backdrop-blur">
              <Wifi className="h-10 w-10 text-primary-foreground" />
            </div>
            <h1 className="text-5xl font-bold text-primary-foreground">Vion</h1>
          </div>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Lightning-fast fiber internet for your home. Reliable, affordable, and always connected.
          </p>
          
          {/* Pincode Checker */}
          <Card className="max-w-md mx-auto bg-card/95 backdrop-blur border-0 shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 justify-center">
                <MapPin className="h-5 w-5 text-primary" />
                Check Availability
              </CardTitle>
              <CardDescription>Enter your pincode to check if we serve your area</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter 6-digit pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-lg tracking-wider"
                />
                <Button onClick={checkPincode} disabled={isChecking}>
                  {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </header>

      {/* Result Section */}
      {checkResult && (
        <section className="py-12 px-4 animate-fade-in">
          <div className="max-w-md mx-auto">
            {checkResult === "available" ? (
              <Card className="border-success/50">
                <CardHeader className="text-center">
                  <div className="mx-auto p-3 bg-success/20 rounded-full w-fit mb-4">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                  <CardTitle className="text-success">Great News!</CardTitle>
                  <CardDescription>
                    Vion Fiber is available in {checkedPincode}. Fill in your details to get started.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLeadSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="flex items-center gap-2">
                        <User className="h-4 w-4" /> Full Name
                      </Label>
                      <Input
                        id="name"
                        placeholder="Your full name"
                        value={leadForm.name}
                        onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                      />
                      {leadErrors.name && <p className="text-sm text-destructive">{leadErrors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4" /> Phone Number
                      </Label>
                      <Input
                        id="phone"
                        placeholder="10-digit mobile number"
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                      />
                      {leadErrors.phone && <p className="text-sm text-destructive">{leadErrors.phone}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address" className="flex items-center gap-2">
                        <Home className="h-4 w-4" /> Full Address
                      </Label>
                      <Input
                        id="address"
                        placeholder="House/Flat No, Street, Area"
                        value={leadForm.address}
                        onChange={(e) => setLeadForm({ ...leadForm, address: e.target.value })}
                      />
                      {leadErrors.address && <p className="text-sm text-destructive">{leadErrors.address}</p>}
                    </div>
                    <Button type="submit" className="w-full" disabled={leadMutation.isPending}>
                      {leadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get Connected"}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      ₹50 booking fee applicable. Refundable on cancellation.
                    </p>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-destructive/50">
                <CardHeader className="text-center">
                  <div className="mx-auto p-3 bg-destructive/20 rounded-full w-fit mb-4">
                    <XCircle className="h-8 w-8 text-destructive" />
                  </div>
                  <CardTitle className="text-destructive">Not Available Yet</CardTitle>
                  <CardDescription>
                    We're not in {checkedPincode} yet, but we're expanding! Join the waitlist.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="waitlist-phone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4" /> Phone Number
                      </Label>
                      <Input
                        id="waitlist-phone"
                        placeholder="10-digit mobile number"
                        value={waitlistForm.phone}
                        onChange={(e) => setWaitlistForm({ ...waitlistForm, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                      />
                      {waitlistErrors.phone && <p className="text-sm text-destructive">{waitlistErrors.phone}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="waitlist-email">Email (optional)</Label>
                      <Input
                        id="waitlist-email"
                        type="email"
                        placeholder="your@email.com"
                        value={waitlistForm.email}
                        onChange={(e) => setWaitlistForm({ ...waitlistForm, email: e.target.value })}
                      />
                      {waitlistErrors.email && <p className="text-sm text-destructive">{waitlistErrors.email}</p>}
                    </div>
                    <Button type="submit" variant="secondary" className="w-full" disabled={waitlistMutation.isPending}>
                      {waitlistMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Waitlist"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Plans Section */}
      <section className="py-16 px-4 bg-secondary/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Our Plans</h2>
          <p className="text-center text-muted-foreground mb-10">
            Choose the perfect plan for your needs
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans?.map((plan) => (
              <Card key={plan.id} className="border-border/50 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">₹{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.validity_days} days</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span>{plan.speed_mbps} Mbps speed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span>Unlimited data</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span>24/7 support</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-4xl mx-auto text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Wifi className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Vion</span>
          </div>
          <p className="text-sm">© 2024 Vion Internet Services. All rights reserved.</p>
        </div>
      </footer>

      {/* AI Chatbot */}
      <LandingChatbot />
    </div>
  );
}
