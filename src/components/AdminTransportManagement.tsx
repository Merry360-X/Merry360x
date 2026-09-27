import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/money";
import { CURRENCY_OPTIONS } from "@/lib/currencies";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MapPin, 
  ArrowLeftRight, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Car, 
  Plane, 
  Sparkles, 
  Search, 
  CheckCircle2, 
  DollarSign, 
  RefreshCw,
  Clock,
  ShieldCheck,
  Navigation
} from "lucide-react";
import { Link } from "react-router-dom";
import { calculateRouteDetails } from "@/lib/route-calculator";

export interface TransportRoute {
  id: string;
  from_location: string;
  to_location: string;
  base_price: number;
  currency: string | null;
  is_published: boolean | null;
  created_at: string | null;
  created_by?: string | null;
}

export interface TransportVehicle {
  id: string;
  title: string;
  provider_name: string | null;
  vehicle_type: string | null;
  seats: number | null;
  price_per_day: number | null;
  currency: string | null;
  is_published: boolean | null;
  image_url: string | null;
  media: string[] | null;
  created_by?: string | null;
  created_at?: string | null;
}

export const POPULAR_RWANDA_ROUTES = [
  { from_location: "Kigali", to_location: "Gisenyi (Rubavu)", base_price: 60000, currency: "RWF" },
  { from_location: "Gisenyi (Rubavu)", to_location: "Kigali", base_price: 60000, currency: "RWF" },
  { from_location: "Kigali", to_location: "Musanze (Ruhengeri)", base_price: 50000, currency: "RWF" },
  { from_location: "Musanze (Ruhengeri)", to_location: "Kigali", base_price: 50000, currency: "RWF" },
  { from_location: "Kigali", to_location: "Karongi (Kibuye)", base_price: 55000, currency: "RWF" },
  { from_location: "Karongi (Kibuye)", to_location: "Kigali", base_price: 55000, currency: "RWF" },
  { from_location: "Kigali", to_location: "Huye (Butare)", base_price: 50000, currency: "RWF" },
  { from_location: "Huye (Butare)", to_location: "Kigali", base_price: 50000, currency: "RWF" },
  { from_location: "Kigali", to_location: "Akagera National Park", base_price: 75000, currency: "RWF" },
  { from_location: "Akagera National Park", to_location: "Kigali", base_price: 75000, currency: "RWF" },
  { from_location: "Kigali", to_location: "Rusizi (Nyungwe)", base_price: 110000, currency: "RWF" },
  { from_location: "Musanze (Ruhengeri)", to_location: "Gisenyi (Rubavu)", base_price: 35000, currency: "RWF" },
];

const COMMON_CITIES = [
  "Kigali",
  "Gisenyi (Rubavu)",
  "Musanze (Ruhengeri)",
  "Karongi (Kibuye)",
  "Huye (Butare)",
  "Akagera National Park",
  "Rusizi (Cyangugu)",
  "Nyagatare",
  "Muhanga",
  "Rwamagana",
];

interface AdminTransportManagementProps {
  vehicles: TransportVehicle[];
  onTogglePublished: (table: string, id: string, next: boolean) => Promise<void>;
  onDeleteItem: (table: string, id: string) => Promise<void>;
  refetchVehicles: () => void;
  userId?: string | null;
}

export function AdminTransportManagement({
  vehicles,
  onTogglePublished,
  onDeleteItem,
  refetchVehicles,
  userId,
}: AdminTransportManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<"intercity" | "vehicles" | "airport">("intercity");
  
  // Route filters & search
  const [routeSearch, setRouteSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState<"all" | "published" | "draft">("all");
  
  // Add / Edit route dialog state
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null);
  const [routeForm, setRouteForm] = useState({
    from_location: "",
    to_location: "",
    base_price: 50000,
    currency: "RWF",
    is_published: true,
  });
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Quick inline price edit state
  const [inlinePriceEditId, setInlinePriceEditId] = useState<string | null>(null);
  const [inlinePriceValue, setInlinePriceValue] = useState<number>(0);
  const [isSavingInlinePrice, setIsSavingInlinePrice] = useState(false);

  // Fetch Transport Routes
  const { data: routes = [], isLoading: isRoutesLoading, refetch: refetchRoutes } = useQuery({
    queryKey: ["admin-transport-routes"],
    queryFn: async (): Promise<TransportRoute[]> => {
      const { data, error } = await supabase
        .from("transport_routes")
        .select("id, from_location, to_location, base_price, currency, is_published, created_at, created_by")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error loading transport routes:", error);
        throw error;
      }
      return (data ?? []) as TransportRoute[];
    },
    staleTime: 1000 * 20,
  });

  // Filtered routes
  const filteredRoutes = useMemo(() => {
    return routes.filter((r) => {
      const searchLower = routeSearch.toLowerCase().trim();
      const matchesSearch =
        !searchLower ||
        r.from_location?.toLowerCase().includes(searchLower) ||
        r.to_location?.toLowerCase().includes(searchLower);

      const matchesStatus =
        routeFilter === "all"
          ? true
          : routeFilter === "published"
          ? Boolean(r.is_published)
          : !r.is_published;

      return matchesSearch && matchesStatus;
    });
  }, [routes, routeSearch, routeFilter]);

  // Open create dialog
  const handleOpenCreateRoute = () => {
    setEditingRoute(null);
    setRouteForm({
      from_location: "Kigali",
      to_location: "Gisenyi (Rubavu)",
      base_price: 60000,
      currency: "RWF",
      is_published: true,
    });
    setRouteDialogOpen(true);
  };

  // Open edit dialog
  const handleOpenEditRoute = (route: TransportRoute) => {
    setEditingRoute(route);
    setRouteForm({
      from_location: route.from_location,
      to_location: route.to_location,
      base_price: Number(route.base_price || 0),
      currency: route.currency || "RWF",
      is_published: Boolean(route.is_published),
    });
    setRouteDialogOpen(true);
  };

  // Save Route (Create or Update)
  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeForm.from_location.trim() || !routeForm.to_location.trim()) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please enter both From and To locations." });
      return;
    }
    if (isNaN(Number(routeForm.base_price)) || Number(routeForm.base_price) < 0) {
      toast({ variant: "destructive", title: "Invalid price", description: "Please enter a valid positive base price." });
      return;
    }

    try {
      setIsSavingRoute(true);
      if (editingRoute) {
        // Update
        const { error } = await supabase
          .from("transport_routes")
          .update({
            from_location: routeForm.from_location.trim(),
            to_location: routeForm.to_location.trim(),
            base_price: Number(routeForm.base_price),
            currency: routeForm.currency,
            is_published: routeForm.is_published,
          } as never)
          .eq("id", editingRoute.id);

        if (error) throw error;
        toast({ title: "Route updated", description: `Updated ${routeForm.from_location} → ${routeForm.to_location} successfully.` });
      } else {
        // Create
        const { error } = await supabase
          .from("transport_routes")
          .insert({
            from_location: routeForm.from_location.trim(),
            to_location: routeForm.to_location.trim(),
            base_price: Number(routeForm.base_price),
            currency: routeForm.currency,
            is_published: routeForm.is_published,
            created_by: userId || null,
          } as never);

        if (error) throw error;
        toast({ title: "Route added", description: `Added ${routeForm.from_location} → ${routeForm.to_location} successfully.` });
      }

      setRouteDialogOpen(false);
      await refetchRoutes();
      queryClient.invalidateQueries({ queryKey: ["transport_routes"] });
    } catch (err: any) {
      console.error("Error saving route:", err);
      toast({ variant: "destructive", title: "Save failed", description: err.message || "Failed to save route." });
    } finally {
      setIsSavingRoute(false);
    }
  };

  // Quick inline price save
  const handleSaveInlinePrice = async (routeId: string) => {
    if (isNaN(inlinePriceValue) || inlinePriceValue < 0) {
      toast({ variant: "destructive", title: "Invalid price", description: "Please enter a valid price." });
      return;
    }
    try {
      setIsSavingInlinePrice(true);
      const { error } = await supabase
        .from("transport_routes")
        .update({ base_price: inlinePriceValue } as never)
        .eq("id", routeId);

      if (error) throw error;
      toast({ title: "Price updated" });
      setInlinePriceEditId(null);
      await refetchRoutes();
      queryClient.invalidateQueries({ queryKey: ["transport_routes"] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update failed", description: err.message || "Could not update price." });
    } finally {
      setIsSavingInlinePrice(false);
    }
  };

  // Seed popular Rwanda routes
  const handleSeedPopularRoutes = async () => {
    if (!window.confirm("Do you want to add standard Rwanda intercity routes (e.g. Kigali ⇄ Gisenyi, Kigali ⇄ Musanze, Kigali ⇄ Karongi, etc.)? Existing identical routes will not be duplicated.")) {
      return;
    }
    try {
      setIsSeeding(true);
      const existingKeySet = new Set(
        routes.map((r) => `${r.from_location.toLowerCase().trim()}-${r.to_location.toLowerCase().trim()}`)
      );

      const routesToInsert = POPULAR_RWANDA_ROUTES.filter(
        (p) => !existingKeySet.has(`${p.from_location.toLowerCase().trim()}-${p.to_location.toLowerCase().trim()}`)
      ).map((p) => ({
        from_location: p.from_location,
        to_location: p.to_location,
        base_price: p.base_price,
        currency: p.currency,
        is_published: true,
        created_by: userId || null,
      }));

      if (routesToInsert.length === 0) {
        toast({ title: "All popular routes are already added!" });
        return;
      }

      const { error } = await supabase
        .from("transport_routes")
        .insert(routesToInsert as never);

      if (error) throw error;

      toast({
        title: "Routes added successfully",
        description: `Added ${routesToInsert.length} popular Rwanda routes.`,
      });
      await refetchRoutes();
      queryClient.invalidateQueries({ queryKey: ["transport_routes"] });
    } catch (err: any) {
      console.error("Error seeding routes:", err);
      toast({ variant: "destructive", title: "Seed failed", description: err.message || "Could not add default routes." });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs for Transport Management */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Car className="w-5 h-5 text-primary" />
            Transport & Intercity Rides Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage intercity passenger routes, pricing, and vehicle rental listings
          </p>
        </div>

        <Tabs value={subTab} onValueChange={(val: any) => setSubTab(val)} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-2 w-full sm:w-auto">
            <TabsTrigger value="intercity" className="gap-1.5">
              <ArrowLeftRight className="w-4 h-4" />
              Intercity Routes ({routes.length})
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="gap-1.5">
              <Car className="w-4 h-4" />
              Vehicles ({vehicles.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 1. INTERCITY ROUTES TAB */}
      {subTab === "intercity" && (
        <Card className="border-border">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-primary" />
                  Intercity Routes & Passenger Pricing
                </CardTitle>
                <CardDescription>
                  Configure fixed price routes for travelers (e.g. Kigali to Gisenyi, Musanze, Karongi).
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSeedPopularRoutes}
                  disabled={isSeeding}
                  className="gap-1.5 border-primary/40 hover:bg-primary/5 text-primary"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                  {isSeeding ? "Seeding..." : "Quick-Add Rwanda Routes"}
                </Button>

                <Button
                  size="sm"
                  onClick={handleOpenCreateRoute}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add New Route
                </Button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search route (e.g. Kigali, Gisenyi, Musanze)..."
                  value={routeSearch}
                  onChange={(e) => setRouteSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={routeFilter} onValueChange={(val: any) => setRouteFilter(val)}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="published">Live (Published)</SelectItem>
                  <SelectItem value="draft">Draft (Hidden)</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="ghost" size="icon" onClick={() => refetchRoutes()} title="Refresh routes">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Route (From → To)</TableHead>
                    <TableHead>Base Price</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isRoutesLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Loading intercity routes...
                      </TableCell>
                    </TableRow>
                  ) : filteredRoutes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Navigation className="w-10 h-10 text-muted-foreground/60" />
                          <p className="text-base font-semibold">No intercity routes found</p>
                          <p className="text-sm text-muted-foreground max-w-sm">
                            Add custom routes like <span className="font-semibold text-foreground">Kigali → Gisenyi</span> or click below to populate popular Rwanda routes automatically.
                          </p>
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" onClick={handleSeedPopularRoutes}>
                              <Sparkles className="w-4 h-4 mr-1.5" />
                              Populate Rwanda Routes
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleOpenCreateRoute}>
                              <Plus className="w-4 h-4 mr-1.5" />
                              Add Custom Route
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRoutes.map((r) => {
                      const details = calculateRouteDetails(r.from_location, r.to_location);
                      return (
                        <TableRow key={r.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-2.5 font-medium">
                              <span className="bg-primary/10 text-primary p-1.5 rounded-md">
                                <ArrowLeftRight className="w-4 h-4" />
                              </span>
                              <div>
                                <div className="text-foreground font-semibold flex items-center gap-1.5">
                                  <span>{r.from_location}</span>
                                  <span className="text-muted-foreground font-normal">→</span>
                                  <span className="text-primary">{r.to_location}</span>
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                  <span className="font-semibold text-foreground/80">{details.distanceFormatted}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 text-primary font-medium">
                                    <Clock className="w-3 h-3 text-primary" />
                                    {details.durationFormatted} drive
                                  </span>
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            {isInlineEditing ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="number"
                                  value={inlinePriceValue}
                                  onChange={(e) => setInlinePriceValue(Number(e.target.value))}
                                  className="w-28 h-8 text-sm"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  className="h-8 px-2 text-xs"
                                  onClick={() => handleSaveInlinePrice(r.id)}
                                  disabled={isSavingInlinePrice}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-xs"
                                  onClick={() => setInlinePriceEditId(null)}
                                >
                                  ✕
                                </Button>
                              </div>
                            ) : (
                              <div
                                className="font-semibold text-foreground flex items-center gap-1 cursor-pointer hover:underline group"
                                onClick={() => {
                                  setInlinePriceEditId(r.id);
                                  setInlinePriceValue(Number(r.base_price || 0));
                                }}
                                title="Click to quick-edit price"
                              >
                                {formatMoney(Number(r.base_price || 0), r.currency || "RWF")}
                                <Edit className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            )}
                          </TableCell>

                          <TableCell>
                            <Badge variant="secondary" className="font-mono text-xs">
                              {r.currency || "RWF"}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={Boolean(r.is_published)}
                                onCheckedChange={(nextVal) => onTogglePublished("transport_routes", r.id, nextVal)}
                              />
                              {r.is_published ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 font-normal">
                                  Live
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Draft
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-xs gap-1"
                                onClick={() => handleOpenEditRoute(r)}
                              >
                                <Edit className="w-3.5 h-3.5" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8 w-8 p-0"
                                onClick={() => onDeleteItem("transport_routes", r.id)}
                                title="Delete route"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2. VEHICLES TAB */}
      {subTab === "vehicles" && (
        <Card className="border-border">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Car className="w-5 h-5 text-primary" />
                  Vehicle Listings & Car Rentals
                </CardTitle>
                <CardDescription>
                  Cars and vehicles available for daily, weekly or airport bookings.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm">
                  <Link to="/create-car-rental">
                    <Plus className="w-4 h-4" />
                    Add Vehicle
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-16">Image</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price / Day</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((v) => {
                    const thumbUrl = v.media?.[0] || v.image_url;
                    return (
                      <TableRow key={v.id} className="hover:bg-muted/30">
                        <TableCell>
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={v.title}
                              className="w-12 h-10 object-cover rounded-md border"
                            />
                          ) : (
                            <div className="w-12 h-10 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
                              <Car className="w-5 h-5" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">{v.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{v.provider_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{v.vehicle_type || "Car"}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatMoney(v.price_per_day ?? 0, v.currency ?? "RWF")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={Boolean(v.is_published)}
                              onCheckedChange={(val) => onTogglePublished("transport_vehicles", v.id, val)}
                            />
                            {v.is_published ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 font-normal">
                                Live
                              </Badge>
                            ) : (
                              <Badge variant="outline">Draft</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() => onTogglePublished("transport_vehicles", v.id, !v.is_published)}
                              title={v.is_published ? "Unpublish" : "Publish"}
                            >
                              {v.is_published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 w-8 p-0"
                              onClick={() => onDeleteItem("transport_vehicles", v.id)}
                              title="Delete vehicle"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {vehicles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No vehicles found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DIALOG: ADD / EDIT INTERCITY ROUTE */}
      <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-primary" />
              {editingRoute ? "Edit Intercity Route" : "Add Intercity Route"}
            </DialogTitle>
            <DialogDescription>
              Set up origin, destination, base passenger price, and visibility.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRoute} className="space-y-4 py-2">
            {/* From Location */}
            <div className="space-y-1.5">
              <Label htmlFor="from_location" className="text-sm font-semibold">
                From Location
              </Label>
              <Input
                id="from_location"
                placeholder="e.g. Kigali"
                value={routeForm.from_location}
                onChange={(e) => setRouteForm({ ...routeForm, from_location: e.target.value })}
                required
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {COMMON_CITIES.slice(0, 5).map((city) => (
                  <button
                    key={`from-${city}`}
                    type="button"
                    onClick={() => setRouteForm({ ...routeForm, from_location: city })}
                    className="text-[11px] bg-muted hover:bg-primary/10 hover:text-primary px-2 py-0.5 rounded transition-colors"
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            {/* To Location */}
            <div className="space-y-1.5">
              <Label htmlFor="to_location" className="text-sm font-semibold">
                To Location
              </Label>
              <Input
                id="to_location"
                placeholder="e.g. Gisenyi (Rubavu)"
                value={routeForm.to_location}
                onChange={(e) => setRouteForm({ ...routeForm, to_location: e.target.value })}
                required
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {COMMON_CITIES.slice(0, 6).map((city) => (
                  <button
                    key={`to-${city}`}
                    type="button"
                    onClick={() => setRouteForm({ ...routeForm, to_location: city })}
                    className="text-[11px] bg-muted hover:bg-primary/10 hover:text-primary px-2 py-0.5 rounded transition-colors"
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            {/* Calculated Distance & Driving Time Preview */}
            {(() => {
              const preview = calculateRouteDetails(routeForm.from_location, routeForm.to_location);
              return (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs">
                  <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <span>Calculated Distance:</span>
                      <span className="text-primary font-bold">{preview.distanceFormatted}</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      Estimated travel time: <span className="text-foreground font-medium">{preview.durationFormatted}</span> driving time
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Price & Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="base_price" className="text-sm font-semibold">
                  Base Price
                </Label>
                <div className="relative">
                  <Input
                    id="base_price"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="60000"
                    value={routeForm.base_price}
                    onChange={(e) => setRouteForm({ ...routeForm, base_price: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="currency" className="text-sm font-semibold">
                  Currency
                </Label>
                <Select
                  value={routeForm.currency}
                  onValueChange={(val) => setRouteForm({ ...routeForm, currency: val })}
                >
                  <SelectTrigger id="currency">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Published Switch */}
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="is_published" className="text-sm font-medium">
                  Publish to Website
                </Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, travelers can see and book this route online.
                </p>
              </div>
              <Switch
                id="is_published"
                checked={routeForm.is_published}
                onCheckedChange={(checked) => setRouteForm({ ...routeForm, is_published: checked })}
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setRouteDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingRoute} className="gap-1.5">
                {isSavingRoute ? "Saving..." : editingRoute ? "Update Route" : "Create Route"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
