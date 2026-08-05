import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { api, API_URL } from "./src/api";

const colors = {
  bg: "#f5f7f8",
  card: "#ffffff",
  ink: "#111827",
  muted: "#718093",
  faint: "#9ba8b6",
  line: "#e7edf1",
  green: "#0aa06e",
  deepGreen: "#076b4d",
  mint: "#d7f8e9",
  navy: "#101827",
  red: "#ef0048",
  blue: "#1f73dc"
};

const areas = ["Bastos", "Melen", "Bonamoussadi", "Akwa", "Odza"];
const wasteCategories = ["Mixed", "Plastic", "Paper", "Metal", "Organic"];

export default function App() {
  const [screen, setScreen] = useState("splash");
  const [client, setClient] = useState(null);
  const [pickup, setPickup] = useState(null);

  return (
    <SafeAreaView style={styles.safe}>
      <ExpoStatusBar style="dark" />
      <StatusBar barStyle="dark-content" />
      {screen === "splash" && <SplashScreen onStart={() => setScreen("roles")} />}
      {screen === "roles" && <RoleScreen onClient={() => setScreen("register")} />}
      {screen === "register" && (
        <RegisterScreen
          onBack={() => setScreen("roles")}
          onRegistered={(nextClient) => {
            setClient(nextClient);
            setScreen("home");
          }}
        />
      )}
      {screen === "home" && (
        <HomeScreen client={client} onPickup={() => setScreen("pickup")} />
      )}
      {screen === "pickup" && (
        <PickupScreen
          client={client}
          onBack={() => setScreen("home")}
          onPosted={(nextPickup) => {
            setPickup(nextPickup);
            setScreen("waiting");
          }}
        />
      )}
      {screen === "waiting" && (
        <WaitingScreen
          pickup={pickup}
          onBack={() => setScreen("home")}
          onCancel={() => setScreen("home")}
        />
      )}
    </SafeAreaView>
  );
}

function SplashScreen({ onStart }) {
  return (
    <View style={styles.centerPage}>
      <View style={styles.splashCard}>
        <View style={styles.logoBox}>
          <Ionicons name="leaf-outline" size={76} color="#39b493" />
        </View>
        <Text style={styles.brand}>CLEANLIFE</Text>
        <Text style={styles.tagline}>FAIR - TRACEABLE - CLEAN</Text>
        <Text style={styles.splashCopy}>
          Cameroon's leading on-demand waste collection and sustainable
          recycling logistics portal. Keeping our environment pristine,
          together.
        </Text>
        <PrimaryButton label="GET STARTED" icon="chevron-forward" onPress={onStart} />
        <Text style={styles.availability}>Available in Yaounde, Douala, and surrounding areas</Text>
      </View>
    </View>
  );
}

function RoleScreen({ onClient }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.roleContent}>
      <Text style={styles.roleTitle}>Choose your CleanLife portal</Text>
      <Text style={styles.roleSubtitle}>
        Please choose your primary operational mode to launch the application.
      </Text>
      <RoleCard
        color={colors.green}
        bg="#d3fae7"
        icon="person-outline"
        title="Resident & Business"
        label="CLIENT PORTAL"
        body="Request trash and recyclable plastic pickups on-demand, track collector GPS live, and manage payments."
        action="Access Client Dashboard"
        onPress={onClient}
      />
      <RoleCard
        color={colors.blue}
        bg="#dceafe"
        icon="briefcase-outline"
        title="Logistics Transporter"
        label="COLLECTOR PORTAL"
        body="Accept nearby cleanup requests, record verified weight on the balance scale, and earn cash-out rewards."
        action="Access Collector Dashboard"
        onPress={() => Alert.alert("Collector portal", "Collector screens can be added next.")}
      />
    </ScrollView>
  );
}

function RegisterScreen({ onBack, onRegistered }) {
  const [form, setForm] = useState({
    fullName: "",
    phone: "+237",
    email: "",
    area: "Bastos",
    pin: "",
    companyCode: ""
  });
  const [loading, setLoading] = useState(false);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    if (!form.fullName.trim() || form.phone.trim().length < 8 || form.pin.length !== 4) {
      Alert.alert("Check details", "Enter your name, phone number, and a 4-digit PIN.");
      return;
    }

    setLoading(true);
    try {
      const saved = await api.registerClient({
        name: form.fullName,
        phone_number: form.phone,
        password: `cleanlife-${form.pin}`,
        company_code: form.companyCode
      });
      const login = await api.loginClient({
        phone_number: form.phone,
        password: `cleanlife-${form.pin}`
      });
      onRegistered({
        ...(login?.client || saved),
        token: login?.token,
        area: form.area
      });
    } catch (error) {
      Alert.alert("Backend not reached", `${error.message}\n\nAPI: ${API_URL}`);
      onRegistered({ id: "local-client", name: form.fullName, area: form.area });
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <ScrollView style={styles.page} contentContainerStyle={styles.formContent}>
        <PortalHeader />
        <View style={styles.formBody}>
          <View style={styles.rowStart}>
            <IconButton icon="chevron-back" onPress={onBack} />
            <Text style={styles.formTitle}>CREATE RESIDENT ACCOUNT</Text>
          </View>
          <Field label="FULL NAME" value={form.fullName} placeholder="e.g. Jean Marc" onChangeText={(v) => update("fullName", v)} />
          <View style={styles.twoCol}>
            <Field label="PHONE NUMBER" value={form.phone} onChangeText={(v) => update("phone", v)} keyboardType="phone-pad" />
            <Field label="EMAIL ADDRESS" value={form.email} placeholder="name@example.com" onChangeText={(v) => update("email", v)} keyboardType="email-address" />
          </View>
          <View style={styles.twoCol}>
            <SelectField label="NEIGHBORHOOD / AREA" value={form.area} onSelect={(v) => update("area", v)} />
            <Field label="4-DIGIT PIN CODE" value={form.pin} placeholder="...." onChangeText={(v) => update("pin", v.replace(/\D/g, "").slice(0, 4))} secureTextEntry keyboardType="number-pad" />
          </View>
          <Field label="COMPANY CODE (OPTIONAL)" value={form.companyCode} placeholder="E.G. HYS-2026, SANI-2026, GREEN-2026" onChangeText={(v) => update("companyCode", v)} />
          <Text style={styles.helpText}>
            Optional: Enter the code given by your waste management company to link your account strictly to that company's tenant account.
          </Text>
          <Text style={styles.centerHelp}>
            By proceeding, you agree that CleanLife may send simulated SMS verification codes to this number.
          </Text>
          <PrimaryButton label={loading ? "SENDING..." : "SEND VERIFICATION CODE"} onPress={submit} disabled={loading} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HomeScreen({ client, onPickup }) {
  const name = client?.name || "El Shaddai";
  return (
    <View style={styles.flex}>
      <ScrollView style={styles.page} contentContainerStyle={styles.homeContent}>
        <View style={styles.homeHero}>
          <View style={styles.homeTop}>
            <Text style={styles.homeLogo}>CLEANLIFE</Text>
            <Text style={styles.wallet}>15,000F</Text>
          </View>
          <Text style={styles.morning}>Good morning,</Text>
          <Text style={styles.homeName}>{name}</Text>
          <Text style={styles.heroSub}>Ready to get rid of some dirt?</Text>
        </View>
        <Pressable style={styles.pickupCard} onPress={onPickup}>
          <View style={styles.pickupTextWrap}>
            <Text style={styles.pickupTitle}>Request Pickup</Text>
            <Text style={styles.pickupSub}>Easy on-demand garbage and recycling collection</Text>
          </View>
          <View style={styles.plusCircle}>
            <Ionicons name="add" size={36} color="#d9fff0" />
          </View>
        </Pressable>
        <View style={styles.notice}>
          <Ionicons name="leaf-outline" size={20} color="#167257" />
          <Text style={styles.noticeText}>No active cleanups right now. Help keep Cameroonian cities clean by recycling!</Text>
        </View>
        <View style={styles.statsRow}>
          <StatCard label="CLEANUPS" value="18" caption="Completed pickups" />
          <StatCard label="BAGS DISPOSED" value="58 bags" caption="Recycled successfully" />
        </View>
        <View style={styles.referCard}>
          <View style={styles.pickupTextWrap}>
            <Text style={styles.referTitle}>Refer a friend, earn 500 FCFA</Text>
            <Text style={styles.referSub}>Share code: <Text style={styles.bold}>CLEANSHADDAI</Text></Text>
          </View>
          <Pressable style={styles.shareButton}>
            <Text style={styles.shareText}>Share</Text>
          </Pressable>
        </View>
      </ScrollView>
      <BottomTabs />
    </View>
  );
}

function PickupScreen({ client, onBack, onPosted }) {
  const [category, setCategory] = useState("Mixed");
  const [bags, setBags] = useState(10);
  const [location, setLocation] = useState(client?.area ? `${client.area}, Yaounde (near Pharmacy)` : "Bastos, Yaounde (near Pharmacy)");
  const [coords, setCoords] = useState({ lat: 3.8955, lng: 11.5122 });
  const [loading, setLoading] = useState(false);

  const distance = coords.lat > 3.9 ? 11.8 : 6.15;
  const vehicle = bags > 7 || distance > 6 ? "Van" : "Bike";
  const total = bags * 600;

  async function publish() {
    setLoading(true);
    const payload = {
      client_id: client?.id,
      latitude: coords.lat,
      longitude: coords.lng,
      bag_count: bags,
      waste_type: category === "Organic" ? "Organic" : category === "Mixed" ? "Heavy Debris" : "Recyclable",
      payment_method: "CASH"
    };

    try {
      const saved = await api.createPickup(payload, client?.token);
      onPosted(saved?.pickup || { ...payload, id: saved?.id || "CL-7742", status: "pending" });
    } catch (error) {
      Alert.alert("Saved locally", `Could not post to backend yet: ${error.message}`);
      onPosted({ ...payload, id: "CL-7742", status: "pending" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pickupContent}>
      <View style={styles.rowStart}>
        <IconButton icon="chevron-back" onPress={onBack} />
        <Text style={styles.pickupHeader}>Confirm Pickup Details</Text>
      </View>
      <View style={styles.locationPreview}>
        <Image
          style={styles.thumb}
          source={{ uri: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=200&q=80" }}
        />
        <View style={styles.pickupTextWrap}>
          <Text style={styles.vehiclePill}>{vehicle}</Text>
          <Text style={styles.locationText}>{location}</Text>
        </View>
      </View>
      <Field label="PICKUP LOCATION DETAILS:" value={location} onChangeText={setLocation} />
      <View style={styles.gpsBox}>
        <View style={styles.rowBetween}>
          <Text style={styles.gpsTitle}>Request GPS coordinates</Text>
          <Text style={styles.coords}>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</Text>
        </View>
        <View style={styles.segmentRow}>
          <Pressable style={[styles.segment, coords.lat < 3.9 && styles.segmentActive]} onPress={() => setCoords({ lat: 3.8955, lng: 11.5122 })}>
            <Text style={[styles.segmentText, coords.lat < 3.9 && styles.segmentTextActive]}>Simulate Bastos</Text>
          </Pressable>
          <Pressable style={[styles.segment, coords.lat > 3.9 && styles.segmentActive]} onPress={() => setCoords({ lat: 3.9761, lng: 11.5852 })}>
            <Text style={[styles.segmentText, coords.lat > 3.9 && styles.segmentTextActive]}>Simulate Suburb</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.sectionLabel}>Waste Category:</Text>
      <View style={styles.chipGrid}>
        {wasteCategories.map((item) => (
          <Pressable key={item} style={[styles.chip, category === item && styles.chipActive]} onPress={() => setCategory(item)}>
            <Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionLabel}>Number of Black Plastic Bags:</Text>
        <Text style={styles.bagCount}>{bags} bag(s)</Text>
      </View>
      <View style={styles.stepperRow}>
        <Pressable style={styles.stepper} onPress={() => setBags(Math.max(1, bags - 1))}><Text style={styles.stepperText}>-</Text></Pressable>
        <View style={styles.bagBar}><View style={[styles.bagFill, { width: `${bags}%` }]} /></View>
        <Pressable style={styles.stepper} onPress={() => setBags(Math.min(100, bags + 1))}><Text style={styles.stepperText}>+</Text></Pressable>
      </View>
      <Text style={styles.rangeHint}>1 bag to 100 bags</Text>
      <View style={styles.engine}>
        <View style={styles.rowBetween}>
          <Text style={styles.engineTitle}>MOBILITY ROUTING ENGINE</Text>
          <Text style={styles.engineVersion}>v1.1-2026</Text>
        </View>
        <View style={styles.engineStats}>
          <EngineTile label="DISTANCE TO LANDFILL" value={`${distance.toFixed(2)} km`} />
          <EngineTile label="ASSIGNED VEHICLE" value={vehicle} green />
        </View>
        <View style={styles.explainBox}>
          <Text style={styles.explainLabel}>ALGORITHMIC ASSIGNMENT EXPLANATION:</Text>
          <Text style={styles.explainText}>
            Medium-high volume ({bags} bags) over a {distance.toFixed(1)} km route requires a Motorized {vehicle} to ensure prompt transit.
          </Text>
        </View>
      </View>
      <View style={styles.totalBox}>
        <LineItem label="Bag Charge:" value={`${bags} bag(s) x 600F`} />
        <LineItem label="Eco Recycling Discount:" value="-10% Applied" green />
        <LineItem label="Estimated Total:" value={`${total.toLocaleString()} FCFA`} green strong />
      </View>
      <PrimaryButton label={loading ? "POSTING..." : "PUBLISH & POST PICKUP OFFER"} onPress={publish} disabled={loading} />
    </ScrollView>
  );
}

function WaitingScreen({ pickup, onBack, onCancel }) {
  const pickupId = pickup?.id || "CL-7742";

  function cancel() {
    onCancel();
  }

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.page} contentContainerStyle={styles.waitContent}>
        <PortalHeader />
        <View style={styles.waitHeader}>
          <IconButton icon="chevron-back" onPress={onBack} />
          <View>
            <Text style={styles.waitLabel}>ACTIVE PICKUP</Text>
            <Text style={styles.waitId}>{pickupId}</Text>
          </View>
          <Text style={styles.pendingPill}>pending</Text>
        </View>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>STATUS MONITOR</Text>
          <Text style={styles.statusTitle}>Waiting for a Collector near you...</Text>
        </View>
        <View style={styles.timelineCard}>
          {[
            ["Job Posted", "Awaiting collector acceptance"],
            ["Collector Accepted", "Collector assigned"],
            ["Collector on the way", "Arriving in approximately 12 mins"],
            ["Pickup Complete", "Weight verified and waste loaded"],
            ["Disposal Confirmed", "Disposed at certified eco dump site"]
          ].map((item, index) => (
            <TimelineItem key={item[0]} number={index + 1} title={item[0]} body={item[1]} active={index === 0} last={index === 4} />
          ))}
        </View>
      </ScrollView>
      <View style={styles.waitActions}>
        <DangerButton label="X CANCEL & DECLINE PICKUP REQUEST" onPress={cancel} />
        <Pressable style={styles.backHomeButton} onPress={onBack}>
          <Text style={styles.backHomeText}>Back to Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PortalHeader() {
  return (
    <View style={styles.portalHeader}>
      <View style={styles.rowStart}>
        <Text style={styles.portalTitle}>RESIDENT & BUSINESS PORTAL</Text>
        <Text style={styles.portalPill}>CLIENT PORTAL</Text>
      </View>
      <Text style={styles.portalSub}>On-demand waste pickup and eco recycling logs</Text>
    </View>
  );
}

function RoleCard({ color, bg, icon, title, label, body, action, onPress }) {
  return (
    <Pressable style={styles.roleCard} onPress={onPress}>
      <View style={[styles.decor, { backgroundColor: bg }]} />
      <View style={[styles.roleIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={42} color={color} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardBody}>{body}</Text>
      <View style={styles.actionRow}>
        <Text style={[styles.actionText, { color }]}>{action}</Text>
        <Ionicons name="chevron-forward" size={26} color={color} />
      </View>
    </Pressable>
  );
}

function Field({ label, style, ...props }) {
  return (
    <View style={[styles.fieldWrap, style]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput placeholderTextColor="#a8b2bf" style={styles.input} {...props} />
    </View>
  );
}

function SelectField({ label, value, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Pressable style={styles.inputButton} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.inputButtonText}>{value}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={22} color={colors.muted} />
      </Pressable>
      {open && (
        <View style={styles.menu}>
          {areas.map((area) => (
            <Pressable key={area} style={styles.menuItem} onPress={() => { onSelect(area); setOpen(false); }}>
              <Text style={styles.menuText}>{area}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function PrimaryButton({ label, icon, onPress, disabled }) {
  return (
    <Pressable style={[styles.primary, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.primaryText}>{label}</Text>
      {icon ? <Ionicons name={icon} size={26} color="#ffffff" /> : null}
    </Pressable>
  );
}

function DangerButton({ label, onPress }) {
  return (
    <Pressable style={styles.danger} onPress={onPress}>
      <Text style={styles.dangerText}>{label}</Text>
    </Pressable>
  );
}

function IconButton({ icon, onPress }) {
  return (
    <Pressable style={styles.iconButton} onPress={onPress}>
      <Ionicons name={icon} size={28} color={colors.muted} />
    </Pressable>
  );
}

function StatCard({ label, value, caption }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statCaption}>{caption}</Text>
    </View>
  );
}

function BottomTabs() {
  const tabs = useMemo(() => [
    ["home-outline", "Home", true],
    ["briefcase-outline", "Jobs", false],
    ["phone-portrait-outline", "Payments", false],
    ["settings-outline", "Settings", false]
  ], []);

  return (
    <View style={styles.tabs}>
      {tabs.map(([icon, label, active]) => (
        <View key={label} style={styles.tabItem}>
          <Ionicons name={icon} size={28} color={active ? colors.green : "#97a6b4"} />
          <Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function EngineTile({ label, value, green }) {
  return (
    <View style={styles.engineTile}>
      <Text style={styles.engineLabel}>{label}</Text>
      <Text style={[styles.engineValue, green && styles.engineGreen]}>{value}</Text>
    </View>
  );
}

function LineItem({ label, value, green, strong }) {
  return (
    <View style={styles.lineItem}>
      <Text style={[styles.totalLabel, strong && styles.totalStrong]}>{label}</Text>
      <Text style={[styles.totalValue, green && styles.totalGreen, strong && styles.totalStrong]}>{value}</Text>
    </View>
  );
}

function TimelineItem({ number, title, body, active, last }) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, active && styles.timelineDotActive]}>
          <Text style={[styles.timelineNumber, active && styles.timelineNumberActive]}>{number}</Text>
        </View>
        {!last && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.timelineText}>
        <Text style={[styles.timelineTitle, active && styles.timelineTitleActive]}>{title}</Text>
        <Text style={[styles.timelineBody, active && styles.timelineBodyActive]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: colors.bg },
  centerPage: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.bg },
  splashCard: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: colors.card,
    paddingVertical: 44,
    paddingHorizontal: 26,
    alignItems: "center",
    shadowColor: "#1f2937",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8
  },
  logoBox: { width: 116, height: 116, borderRadius: 28, backgroundColor: "#cff8e4", alignItems: "center", justifyContent: "center", marginBottom: 22 },
  brand: { fontSize: 42, lineHeight: 48, color: colors.navy, fontWeight: "900" },
  tagline: { marginTop: 18, color: colors.green, fontSize: 18, fontWeight: "900", letterSpacing: 0 },
  splashCopy: { marginTop: 32, marginBottom: 42, color: colors.muted, fontSize: 21, lineHeight: 34, textAlign: "center" },
  primary: {
    minHeight: 62,
    width: "100%",
    borderRadius: 18,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 20,
    shadowColor: colors.green,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  disabled: { opacity: 0.65 },
  primaryText: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
  availability: { marginTop: 26, color: "#9ba8b6", fontSize: 15, fontWeight: "700", textAlign: "center" },
  roleContent: { padding: 28, paddingBottom: 52 },
  roleTitle: { color: colors.navy, fontSize: 36, lineHeight: 42, fontWeight: "900", textAlign: "center" },
  roleSubtitle: { marginTop: 22, marginBottom: 34, color: colors.muted, fontSize: 22, lineHeight: 32, textAlign: "center" },
  roleCard: {
    minHeight: 285,
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: 30,
    marginBottom: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: "#1f2937",
    shadowOpacity: 0.11,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  decor: { position: "absolute", top: -20, right: -18, width: 116, height: 116, borderRadius: 58 },
  roleIcon: { width: 84, height: 84, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 34 },
  cardTitle: { color: colors.navy, fontSize: 28, lineHeight: 34, fontWeight: "900" },
  cardLabel: { marginTop: 10, color: "#98a5b3", fontSize: 18, fontWeight: "900" },
  cardBody: { marginTop: 28, color: colors.muted, fontSize: 20, lineHeight: 32 },
  actionRow: { marginTop: 26, flexDirection: "row", alignItems: "center" },
  actionText: { fontSize: 18, fontWeight: "900" },
  formContent: { paddingBottom: 42 },
  formBody: { padding: 24 },
  portalHeader: { padding: 24, backgroundColor: colors.card, borderTopWidth: 4, borderTopColor: colors.green },
  rowStart: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  portalTitle: { color: colors.navy, fontSize: 16, fontWeight: "900" },
  portalPill: { backgroundColor: "#c8f5df", color: "#08724f", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, fontSize: 11, fontWeight: "900" },
  portalSub: { color: "#97a6b4", fontSize: 13, fontWeight: "800", marginTop: 8 },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  formTitle: { color: colors.navy, fontSize: 15, fontWeight: "900" },
  fieldWrap: { marginTop: 20, flex: 1 },
  inputLabel: { color: "#99a6b4", fontSize: 12, fontWeight: "900", marginBottom: 10 },
  input: { minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fafbfd", paddingHorizontal: 18, color: colors.ink, fontSize: 15, fontWeight: "700" },
  inputButton: { minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fafbfd", paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  inputButtonText: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  menu: { marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: "hidden" },
  menuItem: { padding: 14 },
  menuText: { color: colors.ink, fontWeight: "700" },
  twoCol: { flexDirection: "column", gap: 0 },
  helpText: { marginTop: 8, color: "#98a5b3", fontSize: 12, lineHeight: 18 },
  centerHelp: { marginVertical: 26, color: "#98a5b3", textAlign: "center", fontSize: 12, lineHeight: 18 },
  homeContent: { paddingBottom: 120 },
  homeHero: { backgroundColor: colors.deepGreen, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, padding: 24, paddingBottom: 36 },
  homeTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 26 },
  homeLogo: { color: "#baf2db", fontSize: 16, fontWeight: "900" },
  wallet: { color: "#e6fff5", backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, fontWeight: "900" },
  morning: { color: "#c5eddc", fontSize: 16, fontWeight: "700" },
  homeName: { marginTop: 8, color: "#ffffff", fontSize: 26, fontWeight: "900" },
  heroSub: { marginTop: 10, color: "#c5eddc", fontSize: 16 },
  pickupCard: { margin: 24, marginBottom: 18, backgroundColor: colors.green, borderRadius: 18, padding: 24, minHeight: 106, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  pickupTextWrap: { flex: 1 },
  pickupTitle: { color: "#ffffff", fontSize: 21, fontWeight: "900" },
  pickupSub: { color: "#d5f6e9", marginTop: 10, fontSize: 15 },
  plusCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  notice: { marginHorizontal: 24, borderRadius: 18, borderWidth: 1, borderColor: "#c8f0df", backgroundColor: "#f3fffa", padding: 18, flexDirection: "row", alignItems: "center", gap: 8 },
  noticeText: { flex: 1, color: "#167257", fontSize: 15, textAlign: "center" },
  statsRow: { flexDirection: "row", gap: 18, paddingHorizontal: 24, marginTop: 24 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.line, shadowColor: "#1f2937", shadowOpacity: 0.09, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  statLabel: { color: "#9aa7b5", fontWeight: "900" },
  statValue: { color: colors.navy, fontSize: 26, fontWeight: "900", marginTop: 8 },
  statCaption: { color: "#118a67", marginTop: 8, fontSize: 12, fontWeight: "800" },
  referCard: { margin: 24, borderRadius: 18, padding: 20, backgroundColor: "#e8fff5", borderWidth: 1, borderColor: "#c8f0df", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  referTitle: { color: "#064f3d", fontSize: 16, fontWeight: "900" },
  referSub: { color: "#228269", marginTop: 8 },
  bold: { fontWeight: "900" },
  shareButton: { backgroundColor: colors.green, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12 },
  shareText: { color: "#ffffff", fontWeight: "900" },
  tabs: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, paddingBottom: 20, flexDirection: "row", justifyContent: "space-around" },
  tabItem: { alignItems: "center", gap: 4 },
  tabLabel: { color: "#97a6b4", fontSize: 12, fontWeight: "800" },
  tabActive: { color: colors.green },
  pickupContent: { padding: 22, paddingBottom: 48, backgroundColor: colors.card },
  pickupHeader: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  locationPreview: { marginTop: 22, padding: 14, backgroundColor: "#f7f9fb", borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 14 },
  thumb: { width: 76, height: 76, borderRadius: 10 },
  vehiclePill: { alignSelf: "flex-start", overflow: "hidden", color: "#08724f", backgroundColor: "#c8f5df", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, fontWeight: "900", marginBottom: 8 },
  locationText: { color: colors.muted, fontWeight: "900" },
  gpsBox: { marginTop: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fbfcfd", padding: 16 },
  gpsTitle: { color: colors.ink, fontWeight: "900" },
  coords: { color: colors.muted, backgroundColor: "#edf1f5", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, fontWeight: "900" },
  segmentRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  segment: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  segmentActive: { backgroundColor: "#dcfff0", borderColor: "#95e8c7" },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: "900", textAlign: "center" },
  segmentTextActive: { color: "#08724f" },
  sectionLabel: { color: colors.muted, marginTop: 20, marginBottom: 10, fontSize: 14, fontWeight: "900" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { width: "31.5%", minHeight: 44, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fbfcfd", alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: colors.muted, fontWeight: "900" },
  chipTextActive: { color: "#ffffff" },
  bagCount: { color: colors.green, fontSize: 18, fontWeight: "900" },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepper: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  stepperText: { color: "#ffffff", fontSize: 24, fontWeight: "900" },
  bagBar: { flex: 1, height: 10, borderRadius: 999, backgroundColor: "#e5e8ec", overflow: "hidden" },
  bagFill: { height: "100%", minWidth: 10, borderRadius: 999, backgroundColor: colors.green },
  rangeHint: { marginTop: 8, color: "#a1adba", fontSize: 12 },
  engine: { marginTop: 22, borderRadius: 16, backgroundColor: "#070b1d", padding: 18 },
  engineTitle: { color: "#28c695", fontSize: 13, fontWeight: "900" },
  engineVersion: { color: "#6e7890", fontSize: 12, fontWeight: "800" },
  engineStats: { flexDirection: "row", gap: 12, marginTop: 18 },
  engineTile: { flex: 1, backgroundColor: "#11182d", borderRadius: 12, padding: 14 },
  engineLabel: { color: "#7e8aa3", fontSize: 11, fontWeight: "900" },
  engineValue: { marginTop: 8, color: "#ffffff", fontSize: 18, fontWeight: "900" },
  engineGreen: { color: "#27d195" },
  explainBox: { marginTop: 14, backgroundColor: "#11182d", borderRadius: 12, padding: 14 },
  explainLabel: { color: "#7e8aa3", fontSize: 11, fontWeight: "900" },
  explainText: { marginTop: 8, color: "#d8deea", lineHeight: 20, fontWeight: "700" },
  totalBox: { marginTop: 22, padding: 16, backgroundColor: "#f1fff9", borderRadius: 14, borderWidth: 1, borderColor: "#cef2e2" },
  lineItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 },
  totalLabel: { color: colors.muted, fontSize: 15 },
  totalValue: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  totalGreen: { color: "#0c8462" },
  totalStrong: { fontSize: 17, fontWeight: "900" },
  waitContent: { paddingBottom: 160 },
  waitHeader: { backgroundColor: colors.card, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, padding: 22, flexDirection: "row", alignItems: "center", gap: 12 },
  waitLabel: { color: "#9aa7b5", fontSize: 15, fontWeight: "900" },
  waitId: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 4 },
  pendingPill: { marginLeft: "auto", overflow: "hidden", backgroundColor: "#fff4d6", color: "#9d6927", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, fontWeight: "900" },
  statusCard: { margin: 22, backgroundColor: colors.card, borderRadius: 18, alignItems: "center", padding: 24, borderWidth: 1, borderColor: colors.line, shadowColor: "#1f2937", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  statusLabel: { color: "#9aa7b5", fontWeight: "900", marginBottom: 14 },
  statusTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", textAlign: "center" },
  timelineCard: { marginHorizontal: 22, backgroundColor: colors.card, borderRadius: 18, padding: 24, borderWidth: 1, borderColor: colors.line, shadowColor: "#1f2937", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  timelineItem: { flexDirection: "row" },
  timelineRail: { width: 38, alignItems: "center" },
  timelineDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#dfe6ec", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },
  timelineDotActive: { borderColor: colors.green },
  timelineNumber: { color: "#c6d0d9", fontWeight: "900" },
  timelineNumberActive: { color: colors.green },
  timelineLine: { width: 2, height: 54, backgroundColor: "#e7edf1" },
  timelineText: { paddingLeft: 4, paddingBottom: 22, flex: 1 },
  timelineTitle: { color: "#98a5b3", fontSize: 16, fontWeight: "900" },
  timelineTitleActive: { color: colors.ink },
  timelineBody: { marginTop: 4, color: "#a4afbb", fontSize: 13, fontWeight: "700" },
  timelineBodyActive: { color: colors.muted },
  waitActions: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, padding: 22, gap: 12 },
  danger: { minHeight: 58, borderRadius: 13, backgroundColor: colors.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  dangerText: { color: "#ffffff", fontSize: 15, fontWeight: "900", textAlign: "center" },
  backHomeButton: { minHeight: 58, borderRadius: 13, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  backHomeText: { color: "#ffffff", fontSize: 15, fontWeight: "900" }
});
