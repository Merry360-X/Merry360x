import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Share2, 
  Copy, 
  Check, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Percent, 
  Sparkles, 
  ExternalLink, 
  Smartphone, 
  CreditCard, 
  ArrowUpRight, 
  Send,
  HelpCircle,
  QrCode,
  Building2,
  Calendar
} from "lucide-react";
import { formatNumber } from "@/lib/money";

export default function ReferralDashboard() {
  const { user, refreshRoles, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");

  // Fetch partner profile data
  const { data: affiliate, isLoading: isAffiliateLoading, refetch: refetchAffiliate } = useQuery({
    queryKey: ["referral-partner", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("affiliates")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch user profile for contact and payout info
  const { data: profile } = useQuery({
    queryKey: ["user-profile-payout", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, payout_method, payout_phone, payout_account_name, payout_bank_name, payout_bank_account")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // If user has no referral record and auth is loaded, redirect to signup
  useEffect(() => {
    if (!authLoading && !isAffiliateLoading && user && !affiliate) {
      navigate("/become-referral", { replace: true });
    }
  }, [user, affiliate, authLoading, isAffiliateLoading, navigate]);

  // Fetch commissions for this partner
  const { data: commissions = [], isLoading: isCommissionsLoading } = useQuery({
    queryKey: ["referral-commissions", affiliate?.id],
    queryFn: async () => {
      if (!affiliate?.id) return [];
      const { data, error } = await supabase
        .from("affiliate_commissions")
        .select(`
          *,
          bookings (
            id,
            booking_type,
            check_in,
            check_out,
            total_price,
            currency,
            status,
            payment_status,
            guest_name
          )
        `)
        .eq("affiliate_id", affiliate.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!affiliate?.id,
  });

  // Fetch payout history
  const { data: payouts = [], isLoading: isPayoutsLoading } = useQuery({
    queryKey: ["referral-payouts", affiliate?.id],
    queryFn: async () => {
      if (!affiliate?.id) return [];
      const { data, error } = await supabase
        .from("affiliate_payouts")
        .select("*")
        .eq("affiliate_id", affiliate.id)
        .order("requested_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!affiliate?.id,
  });

  // Real-time updates subscription
  useEffect(() => {
    if (!affiliate?.id) return;

    const channel = supabase
      .channel(`referral-partner-${affiliate.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "affiliate_commissions", filter: `affiliate_id=eq.${affiliate.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["referral-commissions", affiliate.id] });
          queryClient.invalidateQueries({ queryKey: ["referral-partner", user?.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "affiliate_payouts", filter: `affiliate_id=eq.${affiliate.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["referral-payouts", affiliate.id] });
          queryClient.invalidateQueries({ queryKey: ["referral-partner", user?.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [affiliate?.id, user?.id, queryClient]);

  const referralCode = affiliate?.referral_code || "";
  const siteUrl = window.location.origin;
  const shareableLink = referralCode ? `${siteUrl}/?ref=${referralCode}` : siteUrl;

  const copyToClipboard = (text: string, type: "code" | "link") => {
    navigator.clipboard.writeText(text);
    if (type === "code") {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      toast({ title: "Referral code copied!", description: text });
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast({ title: "Share link copied!", description: text });
    }
  };

  // Social Share Handlers
  const handleSocialShare = (platform: "whatsapp" | "twitter" | "facebook" | "email") => {
    const text = encodeURIComponent(
      `Book your stays, experiences, and tours on Merry360x using my referral code ${referralCode}!`
    );
    const url = encodeURIComponent(shareableLink);

    let shareUrl = "";
    if (platform === "whatsapp") {
      shareUrl = `https://api.whatsapp.com/send?text=${text}%20${url}`;
    } else if (platform === "twitter") {
      shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    } else if (platform === "facebook") {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    } else if (platform === "email") {
      shareUrl = `mailto:?subject=${encodeURIComponent("Join Merry360x with my referral code")}&body=${text}%0A%0A${url}`;
    }

    if (shareUrl) {
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Handle Payout Request Submission
  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!affiliate?.id) return;

    const amountNum = parseFloat(payoutAmount);
    const available = Number(affiliate.pending_earnings || affiliate.total_earnings || 0);

    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid payout amount.", variant: "destructive" });
      return;
    }

    if (amountNum > available) {
      toast({
        title: "Insufficient balance",
        description: `Your available balance is ${formatNumber(available)} RWF.`,
        variant: "destructive",
      });
      return;
    }

    setRequestingPayout(true);

    try {
      const { error } = await supabase.from("affiliate_payouts").insert({
        affiliate_id: affiliate.id,
        amount: amountNum,
        currency: "RWF",
        payment_method: affiliate.payout_method || profile?.payout_method || "mtn_momo",
        payment_details: {
          phone: affiliate.payout_phone || profile?.payout_phone || profile?.phone,
          account_name: affiliate.payout_account_name || profile?.payout_account_name || profile?.full_name,
          bank_name: affiliate.payout_bank_name || profile?.payout_bank_name,
          account_number: affiliate.payout_account_number || profile?.payout_bank_account,
        },
        status: "pending",
      } as any);

      if (error) throw error;

      toast({
        title: "Payout requested! 🎉",
        description: `Your request for ${formatNumber(amountNum)} RWF has been submitted to admin.`,
      });

      setPayoutDialogOpen(false);
      setPayoutAmount("");
      queryClient.invalidateQueries({ queryKey: ["referral-payouts", affiliate.id] });
    } catch (err: any) {
      toast({
        title: "Payout request failed",
        description: err.message || "Failed to submit payout request.",
        variant: "destructive",
      });
    } finally {
      setRequestingPayout(false);
    }
  };

  const totalEarnings = Number(affiliate?.total_earnings || 0);
  const pendingEarnings = Number(affiliate?.pending_earnings || 0);
  const paidEarnings = Number(affiliate?.paid_earnings || 0);
  const commissionRate = Number(affiliate?.commission_rate || 10.0);
  const totalReferrals = affiliate?.total_referrals || commissions.length || 0;
  const partnerDisplayName = affiliate?.full_name || profile?.full_name || affiliate?.company_name || user?.email;
  const partnerPayoutMethod = affiliate?.payout_method || profile?.payout_method || "mtn_momo";
  const partnerPayoutTarget = affiliate?.payout_phone || profile?.payout_phone || profile?.payout_bank_account || profile?.phone || "—";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      <Navbar />

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900">
                  Referral Partner Dashboard
                </h1>
                <Badge
                  variant={affiliate?.status === "active" ? "default" : "secondary"}
                  className={affiliate?.status === "active" ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                >
                  {affiliate?.status?.toUpperCase() || "ACTIVE"}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                Welcome, <strong className="text-slate-800 font-semibold">{partnerDisplayName}</strong>! Earning{" "}
                <span className="font-semibold text-rose-500">{commissionRate}% commission</span> on all referred bookings.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-rose-500 hover:bg-rose-600 text-white gap-1.5 shadow-sm">
                    <DollarSign className="w-4 h-4" />
                    Request Payout
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Request Commission Payout</DialogTitle>
                    <DialogDescription>
                      Available balance: <strong className="text-slate-900">{formatNumber(pendingEarnings > 0 ? pendingEarnings : totalEarnings)} RWF</strong>.
                      Payouts are sent to your configured {partnerPayoutMethod === "bank" ? "Bank Account" : "Mobile Money Number"}.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleRequestPayout} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="payoutAmount">Payout Amount (RWF)</Label>
                      <Input
                        id="payoutAmount"
                        type="number"
                        min="1000"
                        step="100"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        placeholder="e.g. 50000"
                        required
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Payout Method:</span>
                        <span className="font-medium text-slate-900 uppercase">{partnerPayoutMethod}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Receiving Account / Phone:</span>
                        <span className="font-medium text-slate-900">{partnerPayoutTarget}</span>
                      </div>
                    </div>

                    <Button type="submit" disabled={requestingPayout} className="w-full bg-rose-500 hover:bg-rose-600 text-white">
                      {requestingPayout ? "Submitting Request..." : "Confirm Payout Request"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Earnings</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-slate-900">{formatNumber(totalEarnings)} RWF</div>
                  <p className="text-xs text-slate-500 mt-1">Accumulated partner commission</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Commissions</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-slate-900">{formatNumber(pendingEarnings)} RWF</div>
                  <p className="text-xs text-slate-500 mt-1">Awaiting completion / payout</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Referred Bookings</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-slate-900">{totalReferrals}</div>
                  <p className="text-xs text-slate-500 mt-1">Completed customer checkouts</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Commission Rate</span>
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-rose-500">{commissionRate}%</div>
                  <p className="text-xs text-slate-500 mt-1">Standard rate per booking</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Referral Code & Share Center */}
          <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-rose-500" />
                Your Unique Referral Code & Share Link
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Share this unique code or link with your audience. When they book, you earn {commissionRate}%.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Referral Code Box */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Your Referral Code</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono text-lg font-bold text-slate-900 tracking-wider">
                      {referralCode}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(referralCode, "code")}
                      className="rounded-xl gap-1.5 px-4"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      {copiedCode ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>

                {/* Shareable Link Box */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Your Direct Share Link</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-600 truncate flex items-center">
                      {shareableLink}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(shareableLink, "link")}
                      className="rounded-xl gap-1.5 px-4"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      {copiedLink ? "Copied" : "Copy Link"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Social Quick Share */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-600">Quick share on social media:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSocialShare("whatsapp")}
                    className="h-8 text-xs gap-1.5 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 border-emerald-200"
                  >
                    WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSocialShare("twitter")}
                    className="h-8 text-xs gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  >
                    X (Twitter)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSocialShare("facebook")}
                    className="h-8 text-xs gap-1.5 bg-blue-50/50 hover:bg-blue-50 text-blue-700 border-blue-200"
                  >
                    Facebook
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSocialShare("email")}
                    className="h-8 text-xs gap-1.5 bg-rose-50/50 hover:bg-rose-50 text-rose-700 border-rose-200"
                  >
                    Email
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs: Commissions Log & Payout History */}
          <Tabs defaultValue="commissions" className="space-y-4">
            <TabsList className="bg-white border border-slate-200 p-1 rounded-xl">
              <TabsTrigger value="commissions" className="rounded-lg gap-1.5">
                <TrendingUp className="w-4 h-4" />
                Referral Bookings & Commissions ({commissions.length})
              </TabsTrigger>
              <TabsTrigger value="payouts" className="rounded-lg gap-1.5">
                <DollarSign className="w-4 h-4" />
                Payout History ({payouts.length})
              </TabsTrigger>
            </TabsList>

            {/* Commissions Content */}
            <TabsContent value="commissions">
              <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  {isCommissionsLoading ? (
                    <div className="p-8 text-center text-sm text-slate-500">Loading commission history...</div>
                  ) : commissions.length === 0 ? (
                    <div className="p-12 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Users className="w-6 h-6" />
                      </div>
                      <h3 className="font-semibold text-slate-900 text-base">No referral bookings yet</h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Share your referral code <strong className="font-mono text-slate-800">{referralCode}</strong> to start earning 10% on every booking made with your code.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(shareableLink, "link")}
                        className="gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy Shareable Link
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-slate-50/70">
                        <TableRow>
                          <TableHead className="text-xs font-semibold">Date</TableHead>
                          <TableHead className="text-xs font-semibold">Service Type</TableHead>
                          <TableHead className="text-xs font-semibold">Booking Amount</TableHead>
                          <TableHead className="text-xs font-semibold">Commission ({commissionRate}%)</TableHead>
                          <TableHead className="text-xs font-semibold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissions.map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell className="text-xs text-slate-600">
                              {new Date(c.created_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-slate-900 capitalize">
                              {c.bookings?.booking_type || "Booking"}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-slate-700">
                              {formatNumber(c.booking_value || c.bookings?.total_price || 0)} {c.currency || "RWF"}
                            </TableCell>
                            <TableCell className="text-xs font-mono font-semibold text-emerald-600">
                              +{formatNumber(c.amount || c.affiliate_commission || 0)} {c.currency || "RWF"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  c.status === "paid"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : c.status === "approved"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }
                              >
                                {c.status ? c.status.toUpperCase() : "PENDING"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payouts Content */}
            <TabsContent value="payouts">
              <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  {isPayoutsLoading ? (
                    <div className="p-8 text-center text-sm text-slate-500">Loading payout records...</div>
                  ) : payouts.length === 0 ? (
                    <div className="p-12 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <h3 className="font-semibold text-slate-900 text-base">No payout requests yet</h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Once you accumulate commissions, you can request withdrawals directly to MTN MoMo, Airtel, or Bank.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-slate-50/70">
                        <TableRow>
                          <TableHead className="text-xs font-semibold">Date Requested</TableHead>
                          <TableHead className="text-xs font-semibold">Amount</TableHead>
                          <TableHead className="text-xs font-semibold">Method</TableHead>
                          <TableHead className="text-xs font-semibold">Details</TableHead>
                          <TableHead className="text-xs font-semibold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payouts.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs text-slate-600">
                              {new Date(p.requested_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </TableCell>
                            <TableCell className="text-xs font-mono font-semibold text-slate-900">
                              {formatNumber(p.amount)} {p.currency || "RWF"}
                            </TableCell>
                            <TableCell className="text-xs uppercase text-slate-700">
                              {p.payment_method || "MTN MoMo"}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {p.payment_details?.phone || p.payment_details?.account_number || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  p.status === "completed"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : p.status === "processing"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : p.status === "failed" || p.status === "cancelled"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }
                              >
                                {p.status ? p.status.toUpperCase() : "PENDING"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Partner Terms & Support Banner */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-rose-500" />
                  Merry360x Partner Guarantee
                </h4>
                <p className="text-xs text-slate-500 max-w-xl">
                  You earn 10% commission on the total value of each booking completed with your referral code. Payouts are verified and processed promptly upon customer stay or tour completion.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0">
                <Link to="/help-center">Partner Support</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
