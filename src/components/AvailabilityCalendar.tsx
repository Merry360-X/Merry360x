import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type BlockedDate = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  created_at: string;
  source?: "blocked" | "booking"; // To differentiate between manual blocks and bookings
};

type CustomPrice = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  custom_price_per_night: number;
  reason?: string;
  created_at: string;
};

type AvailabilityCalendarProps = {
  propertyId: string;
  targetPropertyIds?: string[];
  currency?: string;
  refreshToken?: number;
  onBlockedDatesChanged?: () => void;
};

export default function AvailabilityCalendar({
  propertyId,
  targetPropertyIds,
  currency = "RWF",
  refreshToken = 0,
  onBlockedDatesChanged,
}: AvailabilityCalendarProps) {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [customPrices, setCustomPrices] = useState<CustomPrice[]>([]);
  const [selectedRange, setSelectedRange] = useState<{ from: Date; to?: Date } | undefined>();
  const [reason, setReason] = useState("");
  const [customPriceAmount, setCustomPriceAmount] = useState("");
  const [activeTab, setActiveTab] = useState("availability");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBlockedDates();
    fetchCustomPrices();
  }, [propertyId, refreshToken]);

  const fetchCustomPrices = async () => {
    const { data, error } = await supabase
      .from("property_custom_prices")
      .select("*")
      .eq("property_id", propertyId)
      .order("start_date", { ascending: true });
    
    if (error) {
      console.error("Error fetching custom prices:", error);
    } else {
      setCustomPrices(data || []);
    }
  };

  const addCustomPrice = async () => {
    if (!selectedRange?.from || !customPriceAmount) {
      toast({ title: "Please select dates and enter a price", variant: "destructive" });
      return;
    }

    const price = parseFloat(customPriceAmount);
    if (isNaN(price) || price <= 0) {
      toast({ title: "Please enter a valid price", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const targetIds = (targetPropertyIds && targetPropertyIds.length > 0)
      ? Array.from(new Set([propertyId, ...targetPropertyIds]))
      : [propertyId];

    const startDateStr = format(selectedRange.from, "yyyy-MM-dd");
    const endDateStr = format(selectedRange.to || selectedRange.from, "yyyy-MM-dd");

    setLoading(true);
    const rows = targetIds.map((id) => ({
      property_id: id,
      start_date: startDateStr,
      end_date: endDateStr,
      custom_price_per_night: price,
      reason: reason || null,
      created_by: user?.id,
    }));

    const { error } = await supabase.from("property_custom_prices").insert(rows);

    if (error) {
      toast({ title: "Error setting custom price", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Custom price set successfully",
        description: targetIds.length > 1 ? `Applied to ${targetIds.length} accommodations.` : undefined,
      });
      setSelectedRange(undefined);
      setReason("");
      setCustomPriceAmount("");
      fetchCustomPrices();
    }
    setLoading(false);
  };

  const removeCustomPrice = async (id: string) => {
    const targetIds = (targetPropertyIds && targetPropertyIds.length > 0)
      ? Array.from(new Set([propertyId, ...targetPropertyIds]))
      : [propertyId];

    const targetPrice = customPrices.find((cp) => cp.id === id);

    let error: any = null;
    if (targetPrice && targetIds.length > 1) {
      const res = await supabase
        .from("property_custom_prices")
        .delete()
        .in("property_id", targetIds)
        .eq("start_date", targetPrice.start_date)
        .eq("end_date", targetPrice.end_date);
      error = res.error;
    } else {
      const res = await supabase.from("property_custom_prices").delete().eq("id", id);
      error = res.error;
    }

    if (error) {
      toast({ title: "Error removing custom price", variant: "destructive" });
    } else {
      toast({ title: "Custom price removed" });
      fetchCustomPrices();
    }
  };

  const fetchBlockedDates = async () => {
    const toLastNightDate = (checkIn: string, checkOut: string) => {
      const start = new Date(`${checkIn}T00:00:00`);
      const end = new Date(`${checkOut}T00:00:00`);
      end.setDate(end.getDate() - 1);
      if (end < start) return checkIn;
      return end.toISOString().slice(0, 10);
    };

    // Fetch both manual blocked dates and bookings
    const [blockedResult, bookingsResult] = await Promise.all([
      supabase
        .from("property_blocked_dates")
        .select("*")
        .eq("property_id", propertyId)
        .order("start_date", { ascending: true }),
      supabase
        .from("bookings")
        .select("id, property_id, check_in, check_out, status, payment_status, created_at")
        .eq("property_id", propertyId)
        .in("status", ["pending", "confirmed", "completed"])
        .in("payment_status", ["pending", "paid"])
        .order("check_in", { ascending: true })
    ]);

    if (blockedResult.error) {
      console.error("Error fetching blocked dates:", blockedResult.error);
    }
    if (bookingsResult.error) {
      console.error("Error fetching bookings:", bookingsResult.error);
    }

    const manualBlocks: BlockedDate[] = (blockedResult.data || []).map(d => ({
      ...d,
      source: "blocked" as const
    }));

    const bookingBlocks: BlockedDate[] = (bookingsResult.data || []).map(b => ({
      id: b.id,
      property_id: b.property_id,
      start_date: b.check_in,
      end_date: toLastNightDate(b.check_in, b.check_out),
      reason: "Booked",
      created_at: b.created_at,
      source: "booking" as const
    }));

    const dedupeByRange = (items: BlockedDate[]) => {
      const seen = new Set<string>();
      return items.filter((item) => {
        const key = `${item.start_date}_${item.end_date}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const dedupedManualBlocks = dedupeByRange(manualBlocks);
    const dedupedBookingBlocks = dedupeByRange(bookingBlocks);

    // Combine and sort by start date
    const allBlocked = [...dedupedManualBlocks, ...dedupedBookingBlocks].sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
    
    setBlockedDates(allBlocked);
  };

  const addBlockedDate = async () => {
    if (!selectedRange?.from) {
      toast({ title: "Please select a date range", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const targetIds = (targetPropertyIds && targetPropertyIds.length > 0)
      ? Array.from(new Set([propertyId, ...targetPropertyIds]))
      : [propertyId];

    const startDateStr = format(selectedRange.from, "yyyy-MM-dd");
    const endDateStr = format(selectedRange.to || selectedRange.from, "yyyy-MM-dd");
    const blockReason = reason || "Blocked by host";

    setLoading(true);
    const rows = targetIds.map((id) => ({
      property_id: id,
      start_date: startDateStr,
      end_date: endDateStr,
      reason: blockReason,
      created_by: user?.id,
    }));

    const { error } = await supabase.from("property_blocked_dates").insert(rows);

    if (error) {
      toast({ title: "Error blocking dates", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Dates blocked successfully",
        description: targetIds.length > 1 ? `Applied to ${targetIds.length} accommodations.` : undefined,
      });
      setSelectedRange(undefined);
      setReason("");
      fetchBlockedDates();
      onBlockedDatesChanged?.();
    }
    setLoading(false);
  };

  const removeBlockedDate = async (id: string) => {
    const targetIds = (targetPropertyIds && targetPropertyIds.length > 0)
      ? Array.from(new Set([propertyId, ...targetPropertyIds]))
      : [propertyId];

    const targetBlock = blockedDates.find((b) => b.id === id);

    let error: any = null;
    if (targetBlock && targetIds.length > 1) {
      const res = await supabase
        .from("property_blocked_dates")
        .delete()
        .in("property_id", targetIds)
        .eq("start_date", targetBlock.start_date)
        .eq("end_date", targetBlock.end_date);
      error = res.error;
    } else {
      const res = await supabase.from("property_blocked_dates").delete().eq("id", id);
      error = res.error;
    }

    if (error) {
      toast({ title: "Error removing blocked date", variant: "destructive" });
    } else {
      toast({ title: "Date unblocked successfully" });
      fetchBlockedDates();
      onBlockedDatesChanged?.();
    }
  };

  const disabledDates = blockedDates.map((bd) => ({
    from: new Date(bd.start_date),
    to: new Date(bd.end_date),
  }));

  // Format custom price dates for calendar highlighting
  const customPriceDates = customPrices.map((cp) => ({
    from: new Date(cp.start_date),
    to: new Date(cp.end_date),
  }));

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="availability">Availability</TabsTrigger>
        <TabsTrigger value="pricing">Custom Pricing</TabsTrigger>
      </TabsList>
      
      <TabsContent value="availability" className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Block Dates</Label>
          <p className="text-xs text-muted-foreground mb-3">
            Select dates to make unavailable for booking
          </p>
          
          <div className="flex justify-center mb-3">
            <Calendar
              mode="range"
              selected={selectedRange}
              onSelect={setSelectedRange}
              numberOfMonths={2}
              disabled={[
                { before: new Date() },
                ...disabledDates,
              ]}
              className="rounded-md border"
            />
          </div>

          {selectedRange?.from && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CalendarIcon className="w-4 h-4" />
                <span>
                  {format(selectedRange.from, "MMM d, yyyy")}
                  {selectedRange.to && ` - ${format(selectedRange.to, "MMM d, yyyy")}`}
                </span>
              </div>
              <Textarea
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <div className="flex gap-2">
                <Button onClick={addBlockedDate} disabled={loading} size="sm">
                  Block Dates
                </Button>
                <Button
                  onClick={() => {
                    setSelectedRange(undefined);
                    setReason("");
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {blockedDates.length > 0 && (
          <div>
            <Label className="text-sm font-medium">Unavailable Dates</Label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {blockedDates.map((bd) => (
                <div
                  key={bd.id}
                  className={`flex items-center justify-between p-2 rounded-md text-sm ${
                    bd.source === "booking" ? "bg-primary/10 border border-primary/20" : "bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {bd.source === "booking" && (
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                        Booked
                      </Badge>
                    )}
                    <div>
                      <div className="font-medium">
                        {format(new Date(bd.start_date), "MMM d, yyyy")}
                        {bd.start_date !== bd.end_date &&
                          ` - ${format(new Date(bd.end_date), "MMM d, yyyy")}`}
                      </div>
                      {bd.reason && bd.source !== "booking" && (
                        <div className="text-xs text-muted-foreground">{bd.reason}</div>
                      )}
                    </div>
                  </div>
                  {bd.source !== "booking" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => removeBlockedDate(bd.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </TabsContent>
      
      <TabsContent value="pricing" className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Set Custom Price</Label>
          <p className="text-xs text-muted-foreground mb-3">
            Override the default nightly rate for specific dates
          </p>
          
          <div className="flex justify-center mb-3">
            <Calendar
              mode="range"
              selected={selectedRange}
              onSelect={setSelectedRange}
              numberOfMonths={2}
              disabled={[{ before: new Date() }]}
              className="rounded-md border"
            />
          </div>

          {selectedRange?.from && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CalendarIcon className="w-4 h-4" />
                <span>
                  {format(selectedRange.from, "MMM d, yyyy")}
                  {selectedRange.to && ` - ${format(selectedRange.to, "MMM d, yyyy")}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder={`Custom price per night (${currency})`}
                  value={customPriceAmount}
                  onChange={(e) => setCustomPriceAmount(e.target.value)}
                  min={1}
                />
              </div>
              <Textarea
                placeholder="Reason (e.g., Holiday season, Special event)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <div className="flex gap-2">
                <Button onClick={addCustomPrice} disabled={loading || !customPriceAmount} size="sm">
                  Set Custom Price
                </Button>
                <Button
                  onClick={() => {
                    setSelectedRange(undefined);
                    setReason("");
                    setCustomPriceAmount("");
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {customPrices.length > 0 && (
          <div>
            <Label className="text-sm font-medium">Custom Pricing Rules</Label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {customPrices.map((cp) => (
                <div
                  key={cp.id}
                  className="flex items-center justify-between p-2 rounded-md text-sm bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                      {currency} {cp.custom_price_per_night.toLocaleString()}
                    </Badge>
                    <div>
                      <div className="font-medium">
                        {format(new Date(cp.start_date), "MMM d, yyyy")}
                        {cp.start_date !== cp.end_date &&
                          ` - ${format(new Date(cp.end_date), "MMM d, yyyy")}`}
                      </div>
                      {cp.reason && (
                        <div className="text-xs text-muted-foreground">{cp.reason}</div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive"
                    onClick={() => removeCustomPrice(cp.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
