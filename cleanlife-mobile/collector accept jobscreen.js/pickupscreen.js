import React, { useState, useRef } from "react";
import {
  Leaf, Plus, MapPin, Clock, Wallet, CheckCircle2, X, ArrowLeft,
  Home, Briefcase, CreditCard, Settings, Banknote, Smartphone,
  Recycle, Flame, Truck,
} from "lucide-react";

/* ---------------------------------------------------------------------- *
 * Design tokens — Emerald Green + Charcoal Slate palette
 * ---------------------------------------------------------------------- */
const C = {
  page: "#F7F9F8",
  bannerFrom: "#00543D",
  bannerTo: "#00785A",
  primary: "#029762",
  primaryDark: "#017A4F",
  mint: "#C3FBDD",
  mintSoft: "#EAFBF3",
  slate: "#0B1A16",
  slateMuted: "#5B6B66",
  border: "#E6ECE9",
};

const WASTE_TYPES = [
  { id: "Organic", label: "Organic", icon: Leaf, color: "#029762", bg: "#EAFBF3" },
  { id: "Recyclable", label: "Recyclable", icon: Recycle, color: "#1D4ED8", bg: "#EAF1FE" },
  { id: "Hazardous", label: "Hazardous", icon: Flame, color: "#B91C1C", bg: "#FDECEC" },
  { id: "Heavy Debris", label: "Heavy Debris", icon: Truck, color: "#B45309", bg: "#FEF3E2" },
];

const wasteMeta = (id) => WASTE_TYPES.find((w) => w.id === id) || WASTE_TYPES[0];
const fcfa = (n) => `${(n || 0).toLocaleString("en-US")} FCFA`;

const STAGES = ["broadcast_public", "assigned", "arrived", "paid", "completed"];
const STAGE_LABEL = {
  broadcast_public: "Broadcasting to collectors",
  searching_corporate: "Searching corporate fleet",
  assigned: "Collector assigned",
  arrived: "Collector arrived",
  paid: "Payment confirmed",
  completed: "Completed",
};

/* ---------------------------------------------------------------------- *
 * Small building blocks
 * ---------------------------------------------------------------------- */
function Badge({ children, bg, color, style }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: bg, color, ...style }}
    >
      {children}
    </span>
  );
}

function OutlineButton({ icon: Icon, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition hover:opacity-80"
      style={{ borderColor: C.primary, color: C.primary, backgroundColor: "#fff" }}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

function GhostLink({ icon: Icon, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition hover:opacity-70"
      style={{ color: C.slateMuted }}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

function PrimaryButton({ icon: Icon, children, onClick, disabled, full }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${full ? "w-full" : ""}`}
      style={{ backgroundColor: C.primary }}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="flex-1 rounded-2xl bg-white p-4" style={{ border: `1px solid ${C.border}` }}>
      <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.slateMuted }}>{label}</div>
      <div className="mt-1 text-2xl font-extrabold" style={{ color: C.slate }}>{value}</div>
      <div className="text-xs font-medium" style={{ color: C.primary }}>{sub}</div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
      style={{ backgroundColor: C.slate }}
    >
      {message}
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Request Pickup modal — POST /pickup-requests
 * ---------------------------------------------------------------------- */
function RequestPickupModal({ onClose, onSubmit }) {
  const [wasteType, setWasteType] = useState("Organic");
  const [bags, setBags] = useState(1);
  const [payment, setPayment] = useState("CASH");
  const [address, setAddress] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl" style={{ border: `1px solid ${C.border}` }}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-extrabold" style={{ color: C.slate }}>Request pickup</div>
            <div className="text-xs" style={{ color: C.slateMuted }}>On-demand garbage and recycling collection</div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5" style={{ backgroundColor: C.page }}>
            <X size={16} color={C.slateMuted} />
          </button>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: C.slateMuted }}>Waste type</div>
          <div className="grid grid-cols-2 gap-2">
            {WASTE_TYPES.map((w) => {
              const Icon = w.icon;
              const selected = wasteType === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => setWasteType(w.id)}
                  className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition"
                  style={{
                    borderColor: selected ? w.color : C.border,
                    backgroundColor: selected ? w.bg : "#fff",
                    color: selected ? w.color : C.slate,
                  }}
                >
                  <Icon size={16} />
                  {w.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: C.slateMuted }}>Bag count</div>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ border: `1px solid ${C.border}` }}>
            <button
              onClick={() => setBags((b) => Math.max(1, b - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold"
              style={{ backgroundColor: C.page, color: C.slate }}
            >−</button>
            <div className="flex-1 text-center text-base font-extrabold" style={{ color: C.slate }}>{bags} bag{bags > 1 ? "s" : ""}</div>
            <button
              onClick={() => setBags((b) => Math.min(20, b + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold"
              style={{ backgroundColor: C.mintSoft, color: C.primary }}
            >+</button>
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: C.slateMuted }}>Payment method</div>
          <div className="flex gap-2">
            {[{ id: "CASH", label: "Cash", icon: Banknote }, { id: "MOMO", label: "Mobile money", icon: Smartphone }].map((p) => {
              const selected = payment === p.id;
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => setPayment(p.id)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  style={{
                    borderColor: selected ? C.primary : C.border,
                    backgroundColor: selected ? C.mintSoft : "#fff",
                    color: selected ? C.primary : C.slate,
                  }}
                >
                  <Icon size={15} /> {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: C.slateMuted }}>Pickup location</div>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ border: `1px solid ${C.border}` }}>
            <MapPin size={16} color={C.slateMuted} />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter your address"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: C.slate }}
            />
            <button
              onClick={() => setAddress("Current location (GPS pin)")}
              className="text-xs font-bold whitespace-nowrap"
              style={{ color: C.primary }}
            >
              Use GPS
            </button>
          </div>
        </div>

        <PrimaryButton
          icon={Plus}
          full
          onClick={() => onSubmit({ wasteType, bags, payment, address })}
        >
          Send pickup request
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Active pickup tracker
 * ---------------------------------------------------------------------- */
function ActivePickupTracker({ job }) {
  const meta = wasteMeta(job.wasteType);
  const Icon = meta.icon;
  const idx = Math.max(0, STAGES.indexOf(job.status));

  return (
    <div className="rounded-2xl p-4" style={{ border: `1px solid ${C.border}` }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: meta.bg }}>
            <Icon size={16} color={meta.color} />
          </div>
          <div>
            <div className="text-sm font-extrabold" style={{ color: C.slate }}>{job.bags} bag{job.bags > 1 ? "s" : ""} · {meta.label}</div>
            <div className="text-xs" style={{ color: C.slateMuted }}>{job.address || "—"}</div>
          </div>
        </div>
        <div className="text-sm font-extrabold" style={{ color: C.primary }}>{fcfa(job.price)}</div>
      </div>

      <div className="mb-2 flex items-center gap-1">
        {STAGES.slice(0, 4).map((s, i) => (
          <div
            key={s}
            className="h-1.5 flex-1 rounded-full"
            style={{ backgroundColor: i <= idx ? C.primary : C.border }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.primaryDark }}>
        {job.status === "completed" ? <CheckCircle2 size={13} /> : <Clock size={13} />}
        {STAGE_LABEL[job.status]}
        {job.collectorName && job.status !== "broadcast_public" && (
          <span style={{ color: C.slateMuted }}>· {job.collectorName}</span>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Header + bottom nav
 * ---------------------------------------------------------------------- */
function Header({ onSwitchAccount }) {
  return (
    <div className="sticky top-0 z-40 bg-white" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: C.primary }}>
            <Leaf size={18} color="#fff" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold" style={{ color: C.slate }}>CLEANLIFE</span>
              <Badge bg={C.mint} color={C.primaryDark}>USER ACCOUNT</Badge>
            </div>
            <div className="text-xs" style={{ color: C.slateMuted }}>On-demand waste disposal and eco recycling logistics</div>
          </div>
        </div>
        {onSwitchAccount && <GhostLink icon={ArrowLeft} onClick={onSwitchAccount}>Switch account</GhostLink>}
      </div>
    </div>
  );
}

function BottomNav({ active, setActive }) {
  const items = [
    { id: "home", label: "Home", icon: Home },
    { id: "jobs", label: "Requests", icon: Briefcase },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "settings", label: "Settings", icon: Settings },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white" style={{ borderTop: `1px solid ${C.border}` }}>
      <div className="mx-auto flex max-w-3xl items-center justify-around px-4 py-2.5">
        {items.map((it) => {
          const Icon = it.icon;
          const isActive = active === it.id;
          return (
            <button key={it.id} onClick={() => setActive(it.id)} className="flex flex-col items-center gap-1 px-3 py-1">
              <Icon size={19} color={isActive ? C.primary : C.slateMuted} />
              <span className="text-[11px] font-semibold" style={{ color: isActive ? C.primary : C.slateMuted }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * UserAccountScreen — default export
 * Props:
 *   user           { name, wallet, shareCode }      (optional — defaults to empty)
 *   jobs            array of pickup requests owned by this user
 *   onCreatePickup  (formValues) => void             called on "Send pickup request"
 *   onSwitchAccount () => void                       optional — omit to hide the link
 * ---------------------------------------------------------------------- */
export default function UserAccountScreen({
  user = { name: "", wallet: 0, shareCode: "" },
  jobs = [],
  onCreatePickup,
  onSwitchAccount,
}) {
  const [navTab, setNavTab] = useState("home");
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const [localJobs, setLocalJobs] = useState(jobs);

  const notify = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  const stats = {
    cleanups: localJobs.filter((j) => j.status === "completed").length,
    bags: localJobs.filter((j) => j.status === "completed").reduce((sum, j) => sum + (j.bags || 0), 0),
  };

  const mine = [...localJobs].sort((a, b) => b.createdAt - a.createdAt);
  const active = mine.find((j) => j.status !== "completed");

  const handleCreatePickup = (form) => {
    const job = {
      id: Date.now(),
      ...form,
      price: 0,
      status: "broadcast_public",
      createdAt: new Date(),
      collectorName: null,
    };
    setLocalJobs((js) => [job, ...js]);
    setShowModal(false);
    notify("Pickup request sent");
    onCreatePickup && onCreatePickup(job);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.page, fontFamily: "Inter, ui-sans-serif, system-ui" }}>
      <Header onSwitchAccount={onSwitchAccount} />

      <div className="mx-auto max-w-3xl px-4 pb-28 pt-5">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 px-5 pt-5">
            <span className="text-[15px] font-extrabold" style={{ color: C.slate }}>PICKUP REQUESTS</span>
            <Badge bg={C.mint} color={C.primaryDark}>USER ACCOUNT</Badge>
          </div>
          <div className="px-5 pb-4 text-xs" style={{ color: C.slateMuted }}>On-demand waste pickup and eco recycling logs</div>

          <div className="px-3 pb-3">
            <div
              className="rounded-2xl px-5 py-5 text-white"
              style={{ background: `linear-gradient(135deg, ${C.bannerFrom}, ${C.bannerTo})` }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide opacity-90">
                  <Leaf size={13} /> CLEANLIFE
                </div>
                <div className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">
                  <Wallet size={12} /> {fcfa(user.wallet)}
                </div>
              </div>
              <div className="text-sm opacity-90">Good morning</div>
              <div className="text-xl font-extrabold">{user.name || "—"}</div>
              <div className="mt-1 text-sm opacity-80">Ready to schedule a pickup?</div>
            </div>
          </div>

          <div className="px-3 pb-3">
            <button
              onClick={() => setShowModal(true)}
              className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left text-white transition hover:opacity-95"
              style={{ backgroundColor: C.primary }}
            >
              <div>
                <div className="text-[15px] font-extrabold">Request pickup</div>
                <div className="text-xs opacity-85">On-demand garbage and recycling collection</div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <Plus size={18} />
              </div>
            </button>
          </div>

          <div className="px-3 pb-4">
            {active ? (
              <ActivePickupTracker job={active} />
            ) : (
              <div
                className="rounded-2xl px-4 py-3 text-center text-sm font-medium"
                style={{ backgroundColor: C.mintSoft, color: C.primaryDark, border: `1px dashed ${C.mint}` }}
              >
                No active pickups right now.
              </div>
            )}
          </div>

          <div className="flex gap-3 px-3 pb-3">
            <StatCard label="Cleanups" value={stats.cleanups} sub="Completed pickups" />
            <StatCard label="Bags disposed" value={`${stats.bags} bags`} sub="Recycled successfully" />
          </div>

          <div className="px-3 pb-5">
            <div className="flex items-center justify-between rounded-2xl px-5 py-3.5" style={{ backgroundColor: C.mintSoft }}>
              <div>
                <div className="text-sm font-extrabold" style={{ color: C.slate }}>Refer a friend</div>
                <div className="text-xs" style={{ color: C.slateMuted }}>Share code: <b>{user.shareCode || "—"}</b></div>
              </div>
              <OutlineButton>Share</OutlineButton>
            </div>
          </div>
        </div>
      </div>

      {showModal && <RequestPickupModal onClose={() => setShowModal(false)} onSubmit={handleCreatePickup} />}
      <Toast message={toast} />
      <BottomNav active={navTab} setActive={setNavTab} />
    </div>
  );
}