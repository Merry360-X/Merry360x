import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  DollarSign, 
  Users, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  RefreshCw, 
  Loader2, 
  Percent, 
  Share2, 
  Building2, 
  Smartphone, 
  CreditCard 
} from "lucide-react";

export default function BecomeReferralPartner() {
  const { user, refreshRoles, isReferral, isLoading: authLoading, rolesLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    companyName: "",
    referralCode: "",
    payoutMethod: "mtn_momo", // 'mtn_momo' | 'airtel_money' | 'bank'
    payoutPhone: "",
    payoutAccountName: "",
    payoutBankName: "",
    payoutAccountNumber: "",
  });

  // Pre-fill user profile info if available
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        fullName: prev.fullName || user.user_metadata?.full_name || "",
        phone: prev.phone || user.user_metadata?.phone_number || "",
        payoutPhone: prev.payoutPhone || user.user_metadata?.phone_number || "",
      }));

      // Check if user is already an affiliate/referral partner
      const checkExisting = async () => {
        const { data } = await supabase
          .from("affiliates")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data) {
          if (data.referral_code) {
            navigate("/referral-dashboard", { replace: true });
          }
        }
      };

      checkExisting();
    }
  }, [user, navigate]);

  // If already has referral role and not loading, direct to dashboard
  useEffect(() => {
    if (!authLoading && !rolesLoading && isReferral) {
      navigate("/referral-dashboard", { replace: true });
    }
  }, [isReferral, authLoading, rolesLoading, navigate]);

  // Generate random unique referral code
  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const { data, error } = await supabase.rpc("generate_referral_code");
      if (error) throw error;
      if (data) {
        setFormData(prev => ({ ...prev, referralCode: String(data).toUpperCase() }));
      }
    } catch {
      // Fallback generator in JS
      const randomCode = "REF" + Math.random().toString(36).substring(2, 8).toUpperCase();
      setFormData(prev => ({ ...prev, referralCode: randomCode }));
    } finally {
      setGeneratingCode(false);
    }
  };

  // Auto-generate a starter code if empty
  useEffect(() => {
    if (!formData.referralCode) {
      handleGenerateCode();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in or create an account to become a referral partner.",
        variant: "destructive",
      });
      navigate(`/auth?redirect=${encodeURIComponent("/become-referral")}`);
      return;
    }

    if (!formData.fullName.trim()) {
      toast({ title: "Name required", description: "Please provide your full name.", variant: "destructive" });
      return;
    }

    if (!formData.phone.trim()) {
      toast({ title: "Phone number required", description: "Please enter your contact phone number.", variant: "destructive" });
      return;
    }

    const cleanCode = formData.referralCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (cleanCode.length < 3) {
      toast({ title: "Invalid referral code", description: "Referral code must be at least 3 alphanumeric characters.", variant: "destructive" });
      return;
    }

    if (!termsAccepted) {
      toast({
        title: "Terms acceptance required",
        description: "Please accept the Referral Partner Terms & Agreement (10% commission).",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Update user profile with contact and payout info
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.fullName.trim(),
          phone: formData.phone.trim(),
          payout_method: formData.payoutMethod,
          payout_phone: formData.payoutPhone.trim() || formData.phone.trim(),
          payout_account_name: formData.payoutAccountName.trim() || null,
          payout_bank_name: formData.payoutBankName.trim() || null,
          payout_bank_account: formData.payoutAccountNumber.trim() || null,
        } as any)
        .eq("user_id", user.id);

      if (profileError) {
        console.warn("Could not update profiles table:", profileError.message);
      }

      // 2. Check if affiliate record already exists
      const { data: existingAffiliate } = await supabase
        .from("affiliates")
        .select("id, user_id, referral_code")
        .eq("user_id", user.id)
        .maybeSingle();

      const affiliatePayload: any = {
        user_id: user.id,
        referral_code: cleanCode,
        affiliate_code: cleanCode,
        company_name: formData.companyName.trim() || null,
        commission_rate: 10.00,
        status: "active",
      };

      if (existingAffiliate?.id) {
        const { error: updateErr } = await supabase
          .from("affiliates")
          .update(affiliatePayload)
          .eq("id", existingAffiliate.id);

        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from("affiliates")
          .insert(affiliatePayload);

        if (insertErr) throw insertErr;
      }

      // 3. Grant 'referral' role in user_roles
      try {
        await supabase
          .from("user_roles")
          .insert({ user_id: user.id, role: "referral" as any } as any);
      } catch (roleErr) {
        console.warn("user_roles insert notice:", roleErr);
      }

      toast({
        title: "Welcome to the Partner Program! 🎉",
        description: `Your unique referral code ${cleanCode} is now active with 10% commission.`,
      });

      await refreshRoles();
      navigate("/referral-dashboard");
    } catch (err: any) {
      console.error("Partner signup error:", err);
      toast({
        title: "Registration failed",
        description: err.message || "Failed to register referral partner. Please try another code.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      <Navbar />

      <main className="flex-1 py-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Merry360x Partner Program
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Earn <span className="text-rose-500">10% Commission</span> on Every Referral
            </h1>
            <p className="text-slate-600 max-w-2xl mx-auto text-base">
              Join our partner network. Share your unique referral code with travelers, guests, and audiences to earn 10% cash commissions on every completed booking.
            </p>
          </div>

          {/* Value Props Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-slate-200/80 bg-white/80 backdrop-blur shadow-sm">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shrink-0">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">10% Per Booking</h3>
                  <p className="text-xs text-slate-500 mt-1">Get paid 10% on accommodations, curated tours, and transport services.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/80 backdrop-blur shadow-sm">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Unique Code & Link</h3>
                  <p className="text-xs text-slate-500 mt-1">Generate your customized code and 1-click shareable links for social media.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/80 backdrop-blur shadow-sm">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Instant Mobile Payouts</h3>
                  <p className="text-xs text-slate-500 mt-1">Fast withdrawals directly to MTN Mobile Money, Airtel Money, or Bank.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Registration Form Card */}
          <Card className="border-slate-200 shadow-md bg-white">
            <CardHeader className="border-b border-slate-100 pb-6">
              <CardTitle className="text-xl font-bold text-slate-900">
                Complete Your Partner Profile
              </CardTitle>
              <CardDescription className="text-slate-500">
                Fill in your details below to activate your referral code and partner dashboard.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                    1. Partner Contact Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName" className="text-sm font-medium text-slate-700">
                        Full Name <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="fullName"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder="e.g. Marie Claire Uwase"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
                        Phone Number <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="e.g. +250 788 123 456"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="companyName" className="text-sm font-medium text-slate-700">
                      Company / Agency / Brand Name <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                    </Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="e.g. Kigali Wanderlust Tours or uwase_travels"
                    />
                  </div>
                </div>

                {/* Unique Referral Code */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                    2. Choose Your Unique Referral Code
                  </h3>
                  <div className="space-y-1.5">
                    <Label htmlFor="referralCode" className="text-sm font-medium text-slate-700">
                      Unique Referral Code <span className="text-rose-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="referralCode"
                          value={formData.referralCode}
                          onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                          placeholder="e.g. MARIE10, RWANDA2026"
                          className="font-mono uppercase font-bold tracking-wider"
                          maxLength={20}
                          required
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleGenerateCode}
                        disabled={generatingCode}
                        className="gap-1.5 shrink-0"
                      >
                        <RefreshCw className={`w-4 h-4 ${generatingCode ? "animate-spin" : ""}`} />
                        Randomize
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      This is the code your referrals will enter at checkout or in your shareable link.
                    </p>
                  </div>
                </div>

                {/* Payout Information */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                    3. Payout Method
                  </h3>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-slate-700">
                      How would you like to receive your commissions?
                    </Label>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, payoutMethod: "mtn_momo" })}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                          formData.payoutMethod === "mtn_momo"
                            ? "border-amber-400 bg-amber-50/50 text-amber-900 font-semibold ring-2 ring-amber-400/30"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <Smartphone className="w-5 h-5 text-amber-500" />
                        <span className="text-xs">MTN MoMo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, payoutMethod: "airtel_money" })}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                          formData.payoutMethod === "airtel_money"
                            ? "border-red-400 bg-red-50/50 text-red-900 font-semibold ring-2 ring-red-400/30"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <Smartphone className="w-5 h-5 text-red-500" />
                        <span className="text-xs">Airtel Money</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, payoutMethod: "bank" })}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                          formData.payoutMethod === "bank"
                            ? "border-blue-400 bg-blue-50/50 text-blue-900 font-semibold ring-2 ring-blue-400/30"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <CreditCard className="w-5 h-5 text-blue-500" />
                        <span className="text-xs">Bank Transfer</span>
                      </button>
                    </div>

                    {formData.payoutMethod !== "bank" ? (
                      <div className="space-y-1.5 pt-2">
                        <Label htmlFor="payoutPhone" className="text-sm font-medium text-slate-700">
                          {formData.payoutMethod === "mtn_momo" ? "MTN MoMo Number" : "Airtel Money Number"}
                        </Label>
                        <Input
                          id="payoutPhone"
                          value={formData.payoutPhone}
                          onChange={(e) => setFormData({ ...formData, payoutPhone: e.target.value })}
                          placeholder="e.g. 0788123456"
                        />
                      </div>
                    ) : (
                      <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="payoutBankName" className="text-xs font-medium text-slate-700">Bank Name</Label>
                            <Input
                              id="payoutBankName"
                              value={formData.payoutBankName}
                              onChange={(e) => setFormData({ ...formData, payoutBankName: e.target.value })}
                              placeholder="e.g. Bank of Kigali, I&M Bank"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="payoutAccountName" className="text-xs font-medium text-slate-700">Account Holder Name</Label>
                            <Input
                              id="payoutAccountName"
                              value={formData.payoutAccountName}
                              onChange={(e) => setFormData({ ...formData, payoutAccountName: e.target.value })}
                              placeholder="e.g. Marie Claire Uwase"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="payoutAccountNumber" className="text-xs font-medium text-slate-700">Account Number / IBAN</Label>
                          <Input
                            id="payoutAccountNumber"
                            value={formData.payoutAccountNumber}
                            onChange={(e) => setFormData({ ...formData, payoutAccountNumber: e.target.value })}
                            placeholder="e.g. 000123456789"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Terms and Conditions Acceptance */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="termsAccepted"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(Boolean(checked))}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <label htmlFor="termsAccepted" className="text-sm font-medium text-slate-900 cursor-pointer">
                        I accept the Merry360x Referral Partner Terms & Agreement
                      </label>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        I understand that I will receive a <strong>10% commission</strong> for each completed booking made by customers who use my unique referral code at checkout. Commissions are processed upon booking confirmation and completion.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <Button
                  type="submit"
                  disabled={loading || !termsAccepted}
                  className="w-full h-12 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-base shadow-md shadow-rose-500/20 transition-all gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Activating Partner Account...
                    </>
                  ) : (
                    <>
                      Activate Referral Code & Enter Dashboard
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
