import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  MapPin,
  Car,
  User,
  Search,
  CheckCircle2,
  Calendar,
  CreditCard,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface AdminAddExternalBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookingCreated?: () => void;
}

type ServiceType = "property" | "tour" | "transport";

interface UserOption {
  user_id: string;
  email: string;
  full_name: string;
  phone?: string;
}

export default function AdminAddExternalBookingDialog({
  open,
  onOpenChange,
  onBookingCreated,
}: AdminAddExternalBookingDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Customer state
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  // Service state
  const [serviceType, setServiceType] = useState<ServiceType>("property");
  const [serviceSearchTerm, setServiceSearchTerm] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  // Schedule state
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const [checkIn, setCheckIn] = useState<string>(todayStr);
  const [checkOut, setCheckOut] = useState<string>(tomorrowStr);
  const [guests, setGuests] = useState<number>(1);

  // Financial & Payment state
  const [totalPrice, setTotalPrice] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "pending">("paid");
  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [externalReference, setExternalReference] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState<string>("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch users for existing customer search
  const { data: usersList = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["admin-users-external-search", userSearchTerm],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users", {
        _search: userSearchTerm.trim(),
      });
      if (error) {
        console.warn("Failed to fetch users via RPC, falling back to profiles:", error.message);
        const { data: profData } = await supabase
          .from("profiles")
          .select("user_id, email, full_name, phone")
          .ilike("full_name", `%${userSearchTerm.trim()}%`)
          .limit(20);
        return (profData || []) as UserOption[];
      }
      return (data || []) as UserOption[];
    },
    enabled: open && customerMode === "existing",
    staleTime: 1000 * 30,
  });

  // Fetch properties
  const { data: properties = [], isLoading: isLoadingProperties } = useQuery({
    queryKey: ["admin-external-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, location, price_per_night, currency, host_id, is_published")
        .order("title", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: open && serviceType === "property",
  });

  // Fetch tour packages
  const { data: tours = [], isLoading: isLoadingTours } = useQuery({
    queryKey: ["admin-external-tours"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_packages")
        .select("id, title, city, country, price_per_adult, currency, host_id, status")
        .order("title", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: open && serviceType === "tour",
  });

  // Fetch transport vehicles
  const { data: vehicles = [], isLoading: isLoadingVehicles } = useQuery({
    queryKey: ["admin-external-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_vehicles")
        .select("id, title, vehicle_type, car_brand, car_model, provider_name, price_per_day, daily_price, currency, created_by, is_published, service_type")
        .order("title", { ascending: true })
        .limit(200);
      if (error) {
        console.error("Failed to load transport vehicles:", error);
        throw error;
      }
      return data || [];
    },
    enabled: open && serviceType === "transport",
  });

  const isLoadingServices =
    (serviceType === "property" && isLoadingProperties) ||
    (serviceType === "tour" && isLoadingTours) ||
    (serviceType === "transport" && isLoadingVehicles);

  // Filtered services
  const filteredServices = useMemo(() => {
    const term = serviceSearchTerm.toLowerCase().trim();
    if (serviceType === "property") {
      return properties.filter(
        (p) =>
          !term ||
          p.title?.toLowerCase().includes(term) ||
          p.location?.toLowerCase().includes(term)
      );
    }
    if (serviceType === "tour") {
      return tours.filter(
        (t) =>
          !term ||
          t.title?.toLowerCase().includes(term) ||
          t.city?.toLowerCase().includes(term) ||
          t.country?.toLowerCase().includes(term)
      );
    }
    return vehicles.filter(
      (v) =>
        !term ||
        v.title?.toLowerCase().includes(term) ||
        v.vehicle_type?.toLowerCase().includes(term) ||
        (v.car_brand && v.car_brand.toLowerCase().includes(term)) ||
        (v.car_model && v.car_model.toLowerCase().includes(term)) ||
        (v.provider_name && v.provider_name.toLowerCase().includes(term))
    );
  }, [serviceType, properties, tours, vehicles, serviceSearchTerm]);

  // Handle service selection auto-fill
  const handleSelectService = (id: string) => {
    setSelectedServiceId(id);
    if (serviceType === "property") {
      const selected = properties.find((p) => p.id === id);
      if (selected) {
        if (selected.currency) setCurrency(selected.currency.toUpperCase());
        if (selected.price_per_night && !totalPrice) {
          setTotalPrice(String(selected.price_per_night));
        }
      }
    } else if (serviceType === "tour") {
      const selected = tours.find((t) => t.id === id);
      if (selected) {
        if (selected.currency) setCurrency(selected.currency.toUpperCase());
        if (selected.price_per_adult && !totalPrice) {
          setTotalPrice(String(selected.price_per_adult));
        }
      }
    } else if (serviceType === "transport") {
      const selected = vehicles.find((v) => v.id === id);
      if (selected) {
        if (selected.currency) setCurrency(selected.currency.toUpperCase());
        const vehiclePrice = selected.price_per_day ?? (selected as any).daily_price;
        if (vehiclePrice && !totalPrice) {
          setTotalPrice(String(vehiclePrice));
        }
      }
    }
  };

  const resetForm = () => {
    setCustomerMode("existing");
    setUserSearchTerm("");
    setSelectedUser(null);
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    setServiceType("property");
    setServiceSearchTerm("");
    setSelectedServiceId("");
    setCheckIn(todayStr);
    setCheckOut(tomorrowStr);
    setGuests(1);
    setTotalPrice("");
    setCurrency("USD");
    setPaymentMethod("bank_transfer");
    setPaymentStatus("paid");
    setPaymentDate(todayStr);
    setExternalReference("");
    setInternalNotes("");
    setFormError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    const effectiveGuestName =
      customerMode === "existing"
        ? selectedUser?.full_name || selectedUser?.email || ""
        : guestName.trim();
    const effectiveGuestEmail =
      customerMode === "existing"
        ? selectedUser?.email || ""
        : guestEmail.trim();
    const effectiveGuestPhone =
      customerMode === "existing"
        ? selectedUser?.phone || ""
        : guestPhone.trim();

    if (!effectiveGuestName && !effectiveGuestEmail) {
      setFormError("Please select an existing customer or provide customer contact information.");
      return;
    }

    if (!selectedServiceId) {
      setFormError("Please select a property, tour package, or transport vehicle.");
      return;
    }

    const parsedPrice = parseFloat(totalPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setFormError("Please enter a valid total amount.");
      return;
    }

    if (!checkIn) {
      setFormError("Please provide a check-in / start date.");
      return;
    }

    // Determine host_id from selected listing
    let hostId: string | null = null;
    if (serviceType === "property") {
      const p = properties.find((item) => item.id === selectedServiceId);
      hostId = p?.host_id || null;
    } else if (serviceType === "tour") {
      const t = tours.find((item) => item.id === selectedServiceId);
      hostId = t?.host_id || null;
    } else if (serviceType === "transport") {
      const v = vehicles.find((item) => item.id === selectedServiceId);
      hostId = (v as any)?.created_by || (v as any)?.host_id || null;
    }

    setIsSubmitting(true);
    try {
      const insertPayload: Record<string, unknown> = {
        booking_source: "external",
        payment_source: "external",
        booking_type: serviceType,
        property_id: serviceType === "property" ? selectedServiceId : null,
        tour_id: serviceType === "tour" ? selectedServiceId : null,
        transport_id: serviceType === "transport" ? selectedServiceId : null,
        host_id: hostId,
        guest_id: customerMode === "existing" && selectedUser ? selectedUser.user_id : null,
        is_guest_booking: customerMode === "new" || !selectedUser,
        guest_name: effectiveGuestName || null,
        guest_email: effectiveGuestEmail || null,
        guest_phone: effectiveGuestPhone || null,
        check_in: checkIn,
        check_out: checkOut || checkIn,
        guests: Math.max(1, guests),
        total_price: parsedPrice,
        currency: currency.toUpperCase(),
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        payment_date: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
        external_reference: externalReference.trim() || null,
        internal_notes: internalNotes.trim() || null,
        special_requests: internalNotes.trim() || null,
        status: paymentStatus === "paid" ? "confirmed" : "pending",
        recorded_by: user?.id || null,
      };

      let { data, error } = await supabase
        .from("bookings")
        .insert(insertPayload as never)
        .select("id")
        .single();

      // Graceful fallback if database migration for external booking columns has not been run yet
      if (
        error &&
        (error.code === "PGRST204" ||
          error.message?.includes("booking_source") ||
          error.message?.includes("payment_source") ||
          error.message?.includes("recorded_by") ||
          error.message?.includes("external_reference") ||
          error.message?.includes("internal_notes"))
      ) {
        console.warn(
          "Database lacks external booking columns. Retrying insert with standard columns:",
          error.message
        );

        const fallbackNotes = [
          "[EXTERNAL BOOKING - OFFLINE PAYMENT]",
          `Payment Method: ${paymentMethod}`,
          `Payment Status: ${paymentStatus}`,
          externalReference ? `Reference: ${externalReference}` : null,
          internalNotes ? `Notes: ${internalNotes}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        const fallbackPayload: Record<string, unknown> = {
          booking_type: serviceType,
          property_id: serviceType === "property" ? selectedServiceId : null,
          tour_id: serviceType === "tour" ? selectedServiceId : null,
          transport_id: serviceType === "transport" ? selectedServiceId : null,
          host_id: hostId,
          guest_id: customerMode === "existing" && selectedUser ? selectedUser.user_id : null,
          is_guest_booking: customerMode === "new" || !selectedUser,
          guest_name: effectiveGuestName || null,
          guest_email: effectiveGuestEmail || null,
          guest_phone: effectiveGuestPhone || null,
          check_in: checkIn,
          check_out: checkOut || checkIn,
          guests: Math.max(1, guests),
          total_price: parsedPrice,
          currency: currency.toUpperCase(),
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          status: paymentStatus === "paid" ? "confirmed" : "pending",
          special_requests: fallbackNotes,
        };

        const retryResult = await supabase
          .from("bookings")
          .insert(fallbackPayload as never)
          .select("id")
          .single();

        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) throw error;

      toast({
        title: "External Booking Recorded",
        description: `Successfully created external booking ${data?.id?.slice(0, 8).toUpperCase()}`,
      });

      handleOpenChange(false);
      if (onBookingCreated) {
        onBookingCreated();
      }
    } catch (err: unknown) {
      console.error("Failed to record external booking:", err);
      const msg = err instanceof Error ? err.message : "Failed to record booking. Please try again.";
      setFormError(msg);
      toast({
        variant: "destructive",
        title: "Error Creating Booking",
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-2 py-0.5">
              EXTERNAL
            </Badge>
            <DialogTitle className="text-xl">Record External Booking</DialogTitle>
          </div>
          <DialogDescription>
            Record a booking made and paid outside Merry360X (e.g. direct call, walk-in, or offline wire).
            This creates an official booking record without triggering online payment gateways.
          </DialogDescription>
        </DialogHeader>

        {formError && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* 1. CUSTOMER SECTION */}
          <div className="border rounded-lg p-4 space-y-4 bg-muted/10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Customer Information
              </h3>
              <Tabs
                value={customerMode}
                onValueChange={(v) => {
                  setCustomerMode(v as "existing" | "new");
                  setFormError(null);
                }}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="existing" className="text-xs px-3">
                    Existing User
                  </TabsTrigger>
                  <TabsTrigger value="new" className="text-xs px-3">
                    Guest / Offline Customer
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {customerMode === "existing" ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="Search user by name or email..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>

                {selectedUser ? (
                  <div className="flex items-center justify-between p-3 border rounded-md bg-primary/5 border-primary/20">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                        {(selectedUser.full_name || selectedUser.email || "U")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {selectedUser.full_name || "Unnamed User"}
                        </p>
                        <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                        {selectedUser.phone && (
                          <p className="text-xs text-muted-foreground">{selectedUser.phone}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedUser(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto border rounded-md divide-y bg-background">
                    {isLoadingUsers ? (
                      <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Searching users...
                      </div>
                    ) : usersList.length > 0 ? (
                      usersList.slice(0, 10).map((u) => (
                        <div
                          key={u.user_id}
                          onClick={() => {
                            setSelectedUser(u);
                            setFormError(null);
                          }}
                          className="p-2.5 hover:bg-muted/50 cursor-pointer flex items-center justify-between text-sm transition-colors"
                        >
                          <div>
                            <span className="font-medium">{u.full_name || "User"}</span>
                            <span className="text-muted-foreground text-xs ml-2">({u.email})</span>
                          </div>
                          <Button type="button" size="sm" variant="outline" className="h-7 text-xs">
                            Select
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        No registered users found. Switch to "Guest / Offline Customer" if they don't have an account.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="guestName" className="text-xs">
                    Customer Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="guestName"
                    placeholder="e.g. Jane Doe"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="text-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guestEmail" className="text-xs">
                    Email Address
                  </Label>
                  <Input
                    id="guestEmail"
                    type="email"
                    placeholder="jane@example.com"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guestPhone" className="text-xs">
                    Phone Number
                  </Label>
                  <Input
                    id="guestPhone"
                    placeholder="+250 788 000 000"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. SERVICE SELECTION */}
          <div className="border rounded-lg p-4 space-y-4 bg-muted/10">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Service & Listing
            </h3>

            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={serviceType === "property" ? "default" : "outline"}
                onClick={() => {
                  setServiceType("property");
                  setSelectedServiceId("");
                  setServiceSearchTerm("");
                }}
                className="gap-2 text-xs h-9 justify-center"
              >
                <Building2 className="w-3.5 h-3.5" />
                Accommodation
              </Button>
              <Button
                type="button"
                variant={serviceType === "tour" ? "default" : "outline"}
                onClick={() => {
                  setServiceType("tour");
                  setSelectedServiceId("");
                  setServiceSearchTerm("");
                }}
                className="gap-2 text-xs h-9 justify-center"
              >
                <MapPin className="w-3.5 h-3.5" />
                Tour Package
              </Button>
              <Button
                type="button"
                variant={serviceType === "transport" ? "default" : "outline"}
                onClick={() => {
                  setServiceType("transport");
                  setSelectedServiceId("");
                  setServiceSearchTerm("");
                }}
                className="gap-2 text-xs h-9 justify-center"
              >
                <Car className="w-3.5 h-3.5" />
                Transport
              </Button>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder={`Search ${serviceType === "property" ? "properties" : serviceType === "tour" ? "tours" : "vehicles"} by title or location...`}
                  value={serviceSearchTerm}
                  onChange={(e) => setServiceSearchTerm(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>

              <div className="max-h-48 overflow-y-auto border rounded-md divide-y bg-background">
                {isLoadingServices ? (
                  <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading available {serviceType === "property" ? "accommodations" : serviceType === "tour" ? "tour packages" : "vehicles"}...</span>
                  </div>
                ) : filteredServices.length > 0 ? (
                  filteredServices.map((item) => {
                    const isSelected = selectedServiceId === item.id;
                    const itemTitle =
                      item.title ||
                      ("car_brand" in item && (item as any).car_brand
                        ? `${(item as any).car_brand} ${(item as any).car_model || ""}`.trim()
                        : "Transport Service");
                    const itemSubtitle =
                      "location" in item
                        ? item.location
                        : "city" in item
                        ? `${item.city}, ${item.country}`
                        : "vehicle_type" in item
                        ? [(item as any).vehicle_type, (item as any).car_brand, (item as any).car_model, (item as any).provider_name]
                            .filter(Boolean)
                            .join(" • ") || "Vehicle"
                        : "";
                    const itemPrice =
                      "price_per_night" in item
                        ? `${item.price_per_night} ${item.currency || "USD"}/night`
                        : "price_per_adult" in item
                        ? `${item.price_per_adult} ${item.currency || "USD"}/person`
                        : "price_per_day" in item || "daily_price" in item
                        ? `${(item as any).price_per_day ?? (item as any).daily_price ?? 0} ${(item as any).currency || "USD"}/day`
                        : "";

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectService(item.id)}
                        className={`p-2.5 hover:bg-muted/50 cursor-pointer flex items-center justify-between text-sm transition-colors ${
                          isSelected ? "bg-primary/10 border-l-4 border-primary" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-medium truncate">{itemTitle}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {itemSubtitle}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold">
                            {itemPrice}
                          </span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No listings found matching your search.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. SCHEDULE & GUESTS */}
          <div className="border rounded-lg p-4 space-y-4 bg-muted/10">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Schedule & Guests
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="checkIn" className="text-xs">
                  {serviceType === "property" ? "Check-in Date" : "Start / Tour Date"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="checkIn"
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checkOut" className="text-xs">
                  {serviceType === "property" ? "Check-out Date" : "End Date (Optional)"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="checkOut"
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guests" className="text-xs">
                  Number of Guests
                </Label>
                <Input
                  id="guests"
                  type="number"
                  min={1}
                  max={100}
                  value={guests}
                  onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          {/* 4. PAYMENT & FINANCIALS */}
          <div className="border rounded-lg p-4 space-y-4 bg-muted/10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                External Payment Details
              </h3>
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300">
                Offline Payment Record
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="totalPrice" className="text-xs">
                  Total Amount <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="totalPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                  className="text-sm font-medium"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency" className="text-xs">
                  Currency
                </Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency" className="text-sm">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="RWF">RWF (FRw)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="KES">KES (KSh)</SelectItem>
                    <SelectItem value="UGX">UGX (USh)</SelectItem>
                    <SelectItem value="TZS">TZS (TSh)</SelectItem>
                    <SelectItem value="AED">AED (د.إ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paymentMethod" className="text-xs">
                  Payment Method
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="paymentMethod" className="text-sm">
                    <SelectValue placeholder="Payment Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer (Wire)</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="pos_card">POS / Card Terminal</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="other">Other Offline Method</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="paymentStatus" className="text-xs">
                  Payment Status
                </Label>
                <Select
                  value={paymentStatus}
                  onValueChange={(v) => setPaymentStatus(v as "paid" | "pending")}
                >
                  <SelectTrigger id="paymentStatus" className="text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid (Fully Received)</SelectItem>
                    <SelectItem value="pending">Pending Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paymentDate" className="text-xs">
                  Payment Date
                </Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="externalReference" className="text-xs">
                  External Ref / Slip #
                </Label>
                <Input
                  id="externalReference"
                  placeholder="e.g. WIRE-9042, REC-102"
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="internalNotes" className="text-xs flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                Internal Admin Notes (Optional)
              </Label>
              <Textarea
                id="internalNotes"
                placeholder="Add any internal details, customer channel, voucher info, or special requests..."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Recording Booking...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Record External Booking
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
