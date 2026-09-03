import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Search, 
  Percent, 
  Smartphone, 
  CreditCard,
  Building2,
  Check,
  Settings,
  Sparkles,
  Sliders,
  Save,
  Loader2,
  HelpCircle,
  Eye
} from "lucide-react";
import { formatNumber } from "@/lib/money";
import { usePartnerProgramSettings } from "@/hooks/usePartnerProgramSettings";

export const AffiliatesManagement = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [mainTab, setMainTab] = useState<string>("partners");

  // Dynamic Partner Program Settings
  const { 
    settings: partnerSettings, 
    commissionRate: defaultCommissionRate, 
    updateSettings: savePartnerSettings, 
    isUpdating: isSavingSettings 
  } = usePartnerProgramSettings();

  const [settingRate, setSettingRate] = useState<number>(10);
  const [settingCtaText, setSettingCtaText] = useState<string>("Become a Partner & Earn 10%");
  const [settingHeadline, setSettingHeadline] = useState<string>("Earn 10% Commission on Every Referral");
  const [settingDescription, setSettingDescription] = useState<string>("");
  const [settingMinPayout, setSettingMinPayout] = useState<number>(5000);
  const [settingIsActive, setSettingIsActive] = useState<boolean>(true);
  const [applyToExistingPartners, setApplyToExistingPartners] = useState<boolean>(false);

  // Sync state when partnerSettings loads
  useEffect(() => {
    if (partnerSettings) {
      setSettingRate(Number(partnerSettings.commission_rate ?? 10));
      setSettingCtaText(partnerSettings.cta_text || `Become a Partner & Earn ${partnerSettings.commission_rate ?? 10}%`);
      setSettingHeadline(partnerSettings.headline || `Earn ${partnerSettings.commission_rate ?? 10}% Commission on Every Referral`);
      setSettingDescription(partnerSettings.description || `Join our partner network. Share your unique referral code with travelers, guests, and audiences to earn ${partnerSettings.commission_rate ?? 10}% cash commissions on every completed booking.`);
      setSettingMinPayout(Number(partnerSettings.minimum_payout_amount ?? 5000));
      setSettingIsActive(partnerSettings.is_active !== false);
    }
  }, [partnerSettings]);

  const handleRatePreset = (preset: number) => {
    setSettingRate(preset);
    // Suggest automatic updating of headline & CTA text if they matched the previous template
    setSettingCtaText(`Become a Partner & Earn ${preset}%`);
    setSettingHeadline(`Earn ${preset}% Commission on Every Referral`);
  };

  const handleSaveGlobalSettings = async () => {
    try {
      await savePartnerSettings({
        newSettings: {
          commission_rate: Number(settingRate),
          cta_text: settingCtaText.trim() || `Become a Partner & Earn ${settingRate}%`,
          headline: settingHeadline.trim() || `Earn ${settingRate}% Commission on Every Referral`,
          description: settingDescription.trim(),
          minimum_payout_amount: Number(settingMinPayout),
          is_active: settingIsActive,
        },
        applyToAllExisting: applyToExistingPartners,
      });
    } catch (err: any) {
      console.error("Save settings error:", err);
    }
  };

  // Fetch all affiliates
  const { data: affiliates = [], isLoading } = useQuery({
    queryKey: ['admin-affiliates', filter],
    queryFn: async () => {
      let query = supabase
        .from('affiliates')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data: affiliatesData, error } = await query;
      if (error) throw error;
      
      // Fetch profiles separately
      if (affiliatesData && affiliatesData.length > 0) {
        const userIds = affiliatesData.map(a => a.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, phone')
          .in('user_id', userIds);
        
        // Merge profiles with affiliates
        const profileMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
        return affiliatesData.map(affiliate => ({
          ...affiliate,
          profiles: profileMap.get(affiliate.user_id) || null
        }));
      }
      
      return affiliatesData || [];
    }
  });

  // Fetch all payout requests
  const { data: payouts = [], isLoading: isPayoutsLoading } = useQuery({
    queryKey: ['admin-affiliate-payouts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliate_payouts')
        .select(`
          *,
          affiliates (
            referral_code,
            full_name,
            company_name,
            phone
          )
        `)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ['admin-affiliate-stats'],
    queryFn: async () => {
      const [affiliatesRes, commissionsRes, referralsRes] = await Promise.all([
        supabase.from('affiliates').select('id, status, total_earnings'),
        supabase.from('affiliate_commissions').select('amount, status'),
        supabase.from('affiliate_referrals').select('converted')
      ]);

      const totalAffiliates = affiliatesRes.data?.length || 0;
      const activeAffiliates = affiliatesRes.data?.filter(a => a.status === 'active').length || 0;
      const pendingAffiliates = affiliatesRes.data?.filter(a => a.status === 'pending').length || 0;
      const totalEarnings = affiliatesRes.data?.reduce((sum, a) => sum + parseFloat(a.total_earnings || 0), 0) || 0;
      const totalCommissions = commissionsRes.data?.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0) || 0;
      const paidCommissions = commissionsRes.data?.filter(c => c.status === 'paid').reduce((sum, c) => sum + parseFloat(c.amount || 0), 0) || 0;
      const totalReferrals = referralsRes.data?.length || 0;
      const conversions = referralsRes.data?.filter(r => r.converted).length || 0;

      return {
        totalAffiliates,
        activeAffiliates,
        pendingAffiliates,
        totalEarnings,
        totalCommissions,
        paidCommissions,
        totalReferrals,
        conversions,
        conversionRate: totalReferrals > 0 ? ((conversions / totalReferrals) * 100).toFixed(1) : '0.0'
      };
    }
  });

  const updateAffiliateStatus = async (affiliateId: string, userId: string, status: string) => {
    const { error } = await supabase
      .from('affiliates')
      .update({ 
        status,
        approved_at: status === 'active' ? new Date().toISOString() : null
      } as any)
      .eq('id', affiliateId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    // Sync referral role
    if (status === 'active') {
      await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'referral' as any } as any)
        .catch(() => {});
    }

    toast({
      title: "Status updated",
      description: `Partner status changed to ${status}`
    });

    qc.invalidateQueries({ queryKey: ['admin-affiliates'] });
    qc.invalidateQueries({ queryKey: ['admin-affiliate-stats'] });
  };

  const updateCommissionRate = async (affiliateId: string, rate: number) => {
    const { error } = await supabase
      .from('affiliates')
      .update({ commission_rate: rate })
      .eq('id', affiliateId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Commission rate updated",
      description: `Rate changed to ${rate}%`
    });

    qc.invalidateQueries({ queryKey: ['admin-affiliates'] });
  };

  const updatePayoutStatus = async (payoutId: string, status: string) => {
    const { error } = await supabase
      .from('affiliate_payouts')
      .update({ 
        status,
        processed_at: status === 'completed' ? new Date().toISOString() : null
      } as any)
      .eq('id', payoutId);

    if (error) {
      toast({ title: "Payout error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Payout status updated", description: `Marked as ${status}` });
    qc.invalidateQueries({ queryKey: ['admin-affiliate-payouts'] });
    qc.invalidateQueries({ queryKey: ['admin-affiliate-stats'] });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive"; icon: any; label: string }> = {
      pending: { variant: "secondary", icon: Clock, label: "Pending" },
      active: { variant: "default", icon: CheckCircle2, label: "Active" },
      suspended: { variant: "destructive", icon: XCircle, label: "Suspended" },
      rejected: { variant: "destructive", icon: XCircle, label: "Rejected" }
    };

    const { variant, icon: Icon, label } = config[status] || config.pending;

    return (
      <Badge variant={variant} className="flex items-center gap-1 w-fit">
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  const filteredAffiliates = affiliates.filter((a: any) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (a.referral_code || "").toLowerCase().includes(term) ||
      (a.full_name || "").toLowerCase().includes(term) ||
      (a.company_name || "").toLowerCase().includes(term) ||
      (a.profiles?.full_name || "").toLowerCase().includes(term) ||
      (a.profiles?.email || "").toLowerCase().includes(term) ||
      (a.phone || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold uppercase">Total Partners</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats?.totalAffiliates || 0}</p>
          <p className="text-xs text-slate-500 mt-1">
            {stats?.activeAffiliates || 0} active • {stats?.pendingAffiliates || 0} pending
          </p>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold uppercase">Total Commissions</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatNumber(stats?.totalCommissions || 0)} RWF</p>
          <p className="text-xs text-slate-500 mt-1">
            {formatNumber(stats?.paidCommissions || 0)} RWF paid out
          </p>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <TrendingUp className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-semibold uppercase">Total Referrals</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats?.totalReferrals || 0}</p>
          <p className="text-xs text-slate-500 mt-1">
            {stats?.conversions || 0} converted bookings
          </p>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Percent className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold uppercase">Conversion Rate</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats?.conversionRate || '0.0'}%</p>
          <p className="text-xs text-slate-500 mt-1">Booking conversion ratio</p>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <TabsList className="bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="partners" className="rounded-lg gap-1.5 text-xs font-medium">
              <Users className="w-3.5 h-3.5" />
              Referral Partners ({affiliates.length})
            </TabsTrigger>
            <TabsTrigger value="payouts" className="rounded-lg gap-1.5 text-xs font-medium">
              <DollarSign className="w-3.5 h-3.5" />
              Payout Requests ({payouts.length})
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg gap-1.5 text-xs font-medium">
              <Settings className="w-3.5 h-3.5 text-rose-500" />
              Program Settings & Rate ({defaultCommissionRate}%)
            </TabsTrigger>
          </TabsList>

          {mainTab === "partners" && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Search code, name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          )}
        </div>

        {/* Partners Tab Content */}
        <TabsContent value="partners" className="space-y-4">
          {/* Quick Platform Settings Summary Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-rose-50/80 via-white to-rose-50/40 border border-rose-200/70 rounded-xl shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-xs">
                {defaultCommissionRate}%
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900">Website Referral Commission:</span>
                  <Badge variant="outline" className="bg-rose-100/50 text-rose-700 border-rose-300 text-[11px] font-bold">
                    {defaultCommissionRate}% Default
                  </Badge>
                  <Badge variant="outline" className={partnerSettings.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]" : "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"}>
                    {partnerSettings.is_active ? "Publicly Active" : "Paused"}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Home Button: <span className="font-medium text-slate-700">"{partnerSettings.cta_text}"</span> • Min Payout: <span className="font-mono font-medium text-slate-700">{formatNumber(partnerSettings.minimum_payout_amount)} RWF</span>
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMainTab("settings")}
              className="h-8 text-xs border-rose-200 text-rose-700 hover:bg-rose-100 hover:text-rose-800 gap-1.5 shrink-0"
            >
              <Sliders className="w-3.5 h-3.5" />
              Configure Settings & Rate
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
              className="h-8 text-xs"
            >
              All ({affiliates.length})
            </Button>
            <Button
              size="sm"
              variant={filter === "active" ? "default" : "outline"}
              onClick={() => setFilter("active")}
              className="h-8 text-xs"
            >
              Active ({affiliates.filter((a: any) => a.status === 'active').length})
            </Button>
            <Button
              size="sm"
              variant={filter === "pending" ? "default" : "outline"}
              onClick={() => setFilter("pending")}
              className="h-8 text-xs"
            >
              Pending ({affiliates.filter((a: any) => a.status === 'pending').length})
            </Button>
            <Button
              size="sm"
              variant={filter === "suspended" ? "default" : "outline"}
              onClick={() => setFilter("suspended")}
              className="h-8 text-xs"
            >
              Suspended ({affiliates.filter((a: any) => a.status === 'suspended').length})
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-sm text-slate-500">Loading referral partners...</div>
          ) : filteredAffiliates.length === 0 ? (
            <div className="text-center py-12 border rounded-xl bg-white text-slate-500 text-sm">
              No referral partners found.
            </div>
          ) : (
            <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50/70">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Partner</TableHead>
                    <TableHead className="text-xs font-semibold">Referral Code</TableHead>
                    <TableHead className="text-xs font-semibold">Commission %</TableHead>
                    <TableHead className="text-xs font-semibold">Payout Destination</TableHead>
                    <TableHead className="text-xs font-semibold">Earnings</TableHead>
                    <TableHead className="text-xs font-semibold">Referrals</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAffiliates.map((affiliate: any) => (
                    <TableRow key={affiliate.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm text-slate-900">
                            {affiliate.full_name || affiliate.profiles?.full_name || 'Unnamed Partner'}
                          </p>
                          <p className="text-xs text-slate-500">{affiliate.profiles?.email || affiliate.phone || 'No contact'}</p>
                          {affiliate.company_name && (
                            <p className="text-[11px] text-slate-400 italic">{affiliate.company_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-mono font-bold bg-slate-100 text-slate-900 px-2 py-1 rounded border border-slate-200">
                          {affiliate.referral_code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            defaultValue={affiliate.commission_rate || 10.0}
                            onBlur={(e) => updateCommissionRate(affiliate.id, parseFloat(e.target.value))}
                            className="w-16 h-8 text-xs font-mono"
                          />
                          <span className="text-xs text-slate-500">%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <span className="font-medium text-slate-800 uppercase block">
                            {affiliate.payout_method === "bank" ? "Bank Transfer" : "Mobile Money"}
                          </span>
                          <span className="text-slate-500 font-mono text-[11px] block">
                            {affiliate.payout_phone || affiliate.payout_account_number || affiliate.phone || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-slate-900">
                        {formatNumber(affiliate.total_earnings || 0)} RWF
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700">
                        {affiliate.total_referrals || 0}
                      </TableCell>
                      <TableCell>{getStatusBadge(affiliate.status)}</TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={affiliate.status}
                          onValueChange={(value) => updateAffiliateStatus(affiliate.id, affiliate.user_id, value)}
                        >
                          <SelectTrigger className="w-28 h-8 text-xs ml-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Payouts Tab Content */}
        <TabsContent value="payouts" className="space-y-4">
          {isPayoutsLoading ? (
            <div className="text-center py-12 text-sm text-slate-500">Loading payout requests...</div>
          ) : payouts.length === 0 ? (
            <div className="text-center py-12 border rounded-xl bg-white text-slate-500 text-sm">
              No payout requests found.
            </div>
          ) : (
            <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50/70">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">Partner</TableHead>
                    <TableHead className="text-xs font-semibold">Amount</TableHead>
                    <TableHead className="text-xs font-semibold">Method</TableHead>
                    <TableHead className="text-xs font-semibold">Payment Target</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout: any) => (
                    <TableRow key={payout.id}>
                      <TableCell className="text-xs text-slate-600">
                        {new Date(payout.requested_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-xs text-slate-900">
                            {payout.affiliates?.full_name || payout.affiliates?.company_name || "Partner"}
                          </p>
                          <code className="text-[11px] font-mono text-slate-500">{payout.affiliates?.referral_code}</code>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-900">
                        {formatNumber(payout.amount)} {payout.currency || "RWF"}
                      </TableCell>
                      <TableCell className="text-xs uppercase text-slate-700 font-medium">
                        {payout.payment_method || "MTN MoMo"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-mono">
                        {payout.payment_details?.phone || payout.payment_details?.account_number || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            payout.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : payout.status === "processing"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : payout.status === "failed" || payout.status === "cancelled"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }
                        >
                          {payout.status ? payout.status.toUpperCase() : "PENDING"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={payout.status}
                          onValueChange={(value) => updatePayoutStatus(payout.id, value)}
                        >
                          <SelectTrigger className="w-28 h-8 text-xs ml-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Program Settings Tab Content */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Form Config */}
            <div className="lg:col-span-2 space-y-6">
              {/* Commission Rate Card */}
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm border border-rose-100">
                        <Percent className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900">
                          Default Partner Commission Rate
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Configure the global percentage partners earn on each completed booking
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono font-bold bg-rose-50 text-rose-700 border-rose-200">
                      Active: {defaultCommissionRate}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                      Commission Percentage (%)
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="relative w-36">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={settingRate}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSettingRate(val);
                          }}
                          className="font-mono text-base font-bold text-slate-900 pr-8"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[5, 8, 10, 12, 15, 20, 25].map((rate) => (
                          <Button
                            key={rate}
                            type="button"
                            size="sm"
                            variant={settingRate === rate ? "default" : "outline"}
                            onClick={() => handleRatePreset(rate)}
                            className={`h-8 px-2.5 text-xs font-semibold ${
                              settingRate === rate ? "bg-rose-600 text-white hover:bg-rose-700" : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            {rate}%
                          </Button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      New referral partners will automatically be assigned this commission percentage upon registration.
                    </p>
                  </div>

                  {/* Sync Existing Partners Option */}
                  <div className="pt-3 border-t border-slate-100 flex items-start gap-2.5 bg-slate-50/70 p-3 rounded-lg">
                    <Checkbox
                      id="applyToExistingPartners"
                      checked={applyToExistingPartners}
                      onCheckedChange={(checked) => setApplyToExistingPartners(Boolean(checked))}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <label htmlFor="applyToExistingPartners" className="text-xs font-semibold text-slate-900 cursor-pointer">
                        Also update all existing active partners ({affiliates.filter((a: any) => a.status === 'active').length} partners)
                      </label>
                      <p className="text-[11px] text-slate-500">
                        When enabled, saving will synchronize the new {settingRate}% rate to all current active referral partners immediately.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Marketing & Content Customization */}
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">
                        Website Marketing & Promo Texts
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Customize how the referral opportunity is promoted across the website
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                      Homepage Hero CTA Button Label
                    </Label>
                    <Input
                      value={settingCtaText}
                      onChange={(e) => setSettingCtaText(e.target.value)}
                      placeholder="e.g. Become a Partner & Earn 10%"
                      className="text-xs"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Displayed on the main home screen CTA below story avatars.
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                      Landing Page Headline
                    </Label>
                    <Input
                      value={settingHeadline}
                      onChange={(e) => setSettingHeadline(e.target.value)}
                      placeholder="e.g. Earn 10% Commission on Every Referral"
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                      Program Description & Terms Summary
                    </Label>
                    <Textarea
                      value={settingDescription}
                      onChange={(e) => setSettingDescription(e.target.value)}
                      rows={3}
                      placeholder="Describe benefits and payout schedule..."
                      className="text-xs"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Payout & Status Controls */}
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">
                        Payout Rules & Status
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Set minimum payout thresholds and toggle program availability
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                        Minimum Payout Request (RWF)
                      </Label>
                      <Input
                        type="number"
                        min="1000"
                        step="500"
                        value={settingMinPayout}
                        onChange={(e) => setSettingMinPayout(parseFloat(e.target.value) || 0)}
                        className="font-mono text-xs font-bold"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Partners must accumulate at least this amount before requesting a payout.
                      </p>
                    </div>

                    <div className="flex flex-col justify-between p-3 border rounded-xl bg-slate-50/50">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-900 block">
                          Program Availability
                        </Label>
                        <p className="text-[11px] text-slate-500">
                          {settingIsActive ? "Program is visible and accepting new partners" : "Program is paused; hides CTA buttons"}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs font-medium text-slate-700">
                          {settingIsActive ? "Active" : "Paused"}
                        </span>
                        <Switch
                          checked={settingIsActive}
                          onCheckedChange={setSettingIsActive}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Save Action */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  onClick={handleSaveGlobalSettings}
                  disabled={isSavingSettings}
                  className="h-10 px-6 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-md gap-2"
                >
                  {isSavingSettings ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Settings...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Partner Program Settings
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Right 1 Col: Live Preview */}
            <div className="space-y-4">
              <Card className="border-slate-200 bg-white shadow-sm sticky top-4">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-slate-500" />
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Live Website Preview
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Homepage Button Preview */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                      Homepage CTA Button Preview
                    </span>
                    <div className="p-6 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800">
                      <Button
                        variant="outline"
                        size="lg"
                        className="bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:text-white transition-all shadow-lg pointer-events-none text-xs font-medium"
                      >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        {settingCtaText || `Become a Partner & Earn ${settingRate}%`}
                      </Button>
                    </div>
                  </div>

                  {/* Landing Hero Preview */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                      Partner Page Hero Preview
                    </span>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-semibold uppercase">
                        <Sparkles className="w-3 h-3" />
                        Merry360x Partner Program
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 leading-tight">
                        Earn <span className="text-rose-500">{settingRate}% Commission</span> on Every Referral
                      </h4>
                      <p className="text-[11px] text-slate-600 line-clamp-3">
                        {settingDescription || `Join our partner network. Share your unique referral code to earn ${settingRate}% commissions.`}
                      </p>
                    </div>
                  </div>

                  {/* Quick Summary Info */}
                  <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-lg space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Configured Rate:</span>
                      <strong className="text-rose-600 font-mono">{settingRate}%</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Min Payout:</span>
                      <strong className="font-mono text-slate-800">{formatNumber(settingMinPayout)} RWF</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Program Status:</span>
                      <strong className={settingIsActive ? "text-emerald-600" : "text-amber-600"}>
                        {settingIsActive ? "Active" : "Paused"}
                      </strong>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
