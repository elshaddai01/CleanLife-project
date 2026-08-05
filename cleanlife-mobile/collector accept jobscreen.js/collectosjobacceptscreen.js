import React, { useState, useRef } from "react";
import {
  Leaf, MapPin, Clock, Wallet, CheckCircle2, Camera, Navigation,
  Banknote, Smartphone, PackageCheck, Bike, Truck, Recycle, Flame,
  Power, ArrowLeft, ShieldQuestion, Home, Briefcase, CreditCard, Settings,
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
  amber: "#B45309",
  blue: "#1D4ED8",
  blueBg: "#EAF1FE",
  gray: "#6B7280",
  grayBg: "#F1F2F4",
};

const WASTE_TYPES = [
  { id: "Organic", label: "Organic", icon: Leaf, color: "#029762", bg: "#EAFBF3" },
  { id: "Recyclable", label: "Recyclable", icon: Recycle, color: "#1D4ED8", bg: "#EAF1FE" },
  { id: "Hazardous", label: "Hazardous", icon: Flame, color: "#B91C1C", bg: "#FDECEC" },
  { id: "Heavy Debris", label: "Heavy Debris", icon: Truck, color: "#B45309", bg: "#FEF3E2" },
];

const MOBILITY_BY_BAGS = (bags) => {
  if (bags <= 2) return { label: "Handcart", icon: PackageCheck };
  if (bags <= 6) return { label: "Motorbike", icon: Bike };
  return { label: "Truck", icon: Truck };
};

const wasteMeta = (id) => WASTE_TYPES.find((w) => w.id === id) || WASTE_TYPES[0];
const fcfa = (n) => `${(n || 0).toLocaleString("en-US")} FCFA`;

function timeAgo(date) {
  const s = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

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
 * Job card — one available pickup request. POST /pickup-requests/:id/claim
 * ---------------------------------------------------------------------- */
function JobCard({ job, onAccept, disabled }) {
  const meta = wasteMeta(job.wasteType);
  const Icon = meta.icon;
  const mobility = MOBILITY_BY_BAGS(job.bags);
  const MobIcon = mobility.icon;

  return (
    <div className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: meta.bg }}>
            <Icon size={19} color={meta.color} />
          </div>
          <div>
            <div className="text-sm font-extrabold" style={{ color: C.slate }}>
              {job.bags} bag{job.bags > 1 ? "s" : ""} · {meta.label}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: C.slateMuted }}>
              <span className="flex items-center gap-1"><MapPin size={11} /> {(job.distanceKm || 0).toFixed(1)} km</span>
              <span className="flex items-center gap-1"><MobIcon size={11} /> {mobility.label}</span>
              <span className="flex items-center gap-1"><Clock size={11} /> {timeAgo(job.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-extrabold" style={{ color: C.slate }}>{fcfa(job.price)}</div>
          <Badge
            bg={job.payment === "CASH" ? C.mintSoft : C.blueBg}
            color={job.payment === "CASH" ? C.primaryDark : C.blue}
            style={{ marginTop: 4 }}
          >
            {job.payment === "CASH" ? <Banknote size={11} /> : <Smartphone size={11} />}
            {job.payment === "CASH" ? "Cash" : "MoMo"}
          </Badge>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs" style={{ color: C.slateMuted }}>{job.address || "—"}</div>
        <PrimaryButton icon={CheckCircle2} onClick={() => onAccept(job.id)} disabled={disabled}>
          Accept job
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Active job panel — arrive / collect-cash / momo / proof-of-work
 * ---------------------------------------------------------------------- */
function ActiveJobPanel({ job, onArrive, onConfirmCash, onConfirmMomo, onSubmitProof }) {
  const meta = wasteMeta(job.wasteType);
  const Icon = meta.icon;
  const paid = job.status === "paid" || job.status === "completed";
  const arrived = job.status !== "assigned";

  return (
    <div className="rounded-2xl p-4" style={{ border: `2px solid ${C.primary}`, backgroundColor: C.mintSoft }}>
      <div className="mb-3 flex items-center justify-between">
        <Badge bg="#fff" color={C.primaryDark}>Your active job</Badge>
        <div className="text-sm font-extrabold" style={{ color: C.primaryDark }}>{fcfa(job.price)}</div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
          <Icon size={19} color={meta.color} />
        </div>
        <div>
          <div className="text-sm font-extrabold" style={{ color: C.slate }}>{job.bags} bag{job.bags > 1 ? "s" : ""} · {meta.label}</div>
          <div className="text-xs" style={{ color: C.slateMuted }}>{job.address || "—"}</div>
        </div>
      </div>

      {!arrived && (
        <PrimaryButton icon={Navigation} full onClick={() => onArrive(job.id)}>
          Mark arrived at pickup location
        </PrimaryButton>
      )}

      {arrived && !paid && job.payment === "CASH" && (
        <PrimaryButton icon={Banknote} full onClick={() => onConfirmCash(job.id)}>
          Confirm cash collected
        </PrimaryButton>
      )}

      {arrived && !paid && job.payment === "MOMO" && (
        <div className="rounded-xl bg-white p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.amber }}>
            <Smartphone size={13} /> Request-to-pay push sent — waiting for confirmation
          </div>
          <PrimaryButton icon={CheckCircle2} full onClick={() => onConfirmMomo(job.id)}>
            Confirm MoMo payment received
          </PrimaryButton>
        </div>
      )}

      {paid && job.status !== "completed" && (
        <PrimaryButton icon={Camera} full onClick={() => onSubmitProof(job.id)}>
          Capture and submit proof of work
        </PrimaryButton>
      )}
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
              <Badge bg={C.mint} color={C.primaryDark}>COLLECTOR ACCOUNT</Badge>
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
    { id: "jobs", label: "Jobs", icon: Briefcase },
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
 * CollectorAccountScreen — default export
 * Props:
 *   collector        { name, tier, wallet, online }   (optional — defaults to empty)
 *   setCollector      updater for the collector object (optional local fallback used if omitted)
 *   jobs              array of available broadcast pickup requests (status: "broadcast_public")
 *   onAccept          (jobId) => void   POST /pickup-requests/:id/claim
 *   onArrive          (jobId) => void   POST /pickup-requests/:id/arrive
 *   onConfirmCash     (jobId) => void   POST /pickup-requests/:id/collect-cash
 *   onConfirmMomo     (jobId) => void   webhook confirmation received
 *   onSubmitProof     (jobId) => void   POST /pickup-requests/:id/proof-of-work
 * ---------------------------------------------------------------------- */
export default function CollectorAccountScreen({
  collector: collectorProp = { name: "", tier: "", wallet: 0, online: false },
  setCollector: setCollectorProp,
  jobs = [],
  onAccept,
  onArrive,
  onConfirmCash,
  onConfirmMomo,
  onSubmitProof,
  onSwitchAccount,
}) {
  const [navTab, setNavTab] = useState("home");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const [localCollector, setLocalCollector] = useState(collectorProp);
  const [localJobs, setLocalJobs] = useState(jobs);

  const collector = localCollector;
  const setCollector = setCollectorProp || setLocalCollector;

  const notify = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  const myActiveJob = localJobs.find((j) => j.collectorId === "me" && j.status !== "completed");
  const available = localJobs.filter((j) => j.status === "broadcast_public");
  const stats = {
    jobsToday: localJobs.filter((j) => j.status === "completed").length,
    earningsToday: localJobs.filter((j) => j.status === "completed").reduce((sum, j) => sum + (j.price || 0), 0),
  };

  const acceptJob = (id) => {
    if (myActiveJob) return;
    setLocalJobs((js) => js.map((j) => (j.id === id ? { ...j, status: "assigned", collectorId: "me", collectorName: collector.name } : j)));
    notify("Job accepted");
    onAccept && onAccept(id);
  };
  const arriveJob = (id) => {
    setLocalJobs((js) => js.map((j) => (j.id === id ? { ...j, status: "arrived" } : j)));
    notify("Marked as arrived");
    onArrive && onArrive(id);
  };
  const confirmCash = (id) => {
    setLocalJobs((js) => js.map((j) => (j.id === id ? { ...j, status: "paid" } : j)));
    notify("Cash collection confirmed");
    onConfirmCash && onConfirmCash(id);
  };
  const confirmMomo = (id) => {
    setLocalJobs((js) => js.map((j) => (j.id === id ? { ...j, status: "paid" } : j)));
    notify("MoMo payment confirmed");
    onConfirmMomo && onConfirmMomo(id);
  };
  const submitProof = (id) => {
    setLocalJobs((js) => js.map((j) => (j.id === id ? { ...j, status: "completed" } : j)));
    notify("Job completed");
    onSubmitProof && onSubmitProof(id);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.page, fontFamily: "Inter, ui-sans-serif, system-ui" }}>
      <Header onSwitchAccount={onSwitchAccount} />

      <div className="mx-auto max-w-3xl px-4 pb-28 pt-5">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <div className="flex flex-wrap items-center gap-2 px-5 pt-5">
            <span className="text-[15px] font-extrabold" style={{ color: C.slate }}>JOB DISPATCH</span>
            <Badge bg={C.mint} color={C.primaryDark}>COLLECTOR ACCOUNT</Badge>
            <Badge bg={C.grayBg} color={C.gray}>{collector.tier ? collector.tier.toUpperCase() : "TIER —"}</Badge>
            <span className="ml-auto flex items-center gap-1 text-xs font-semibold" style={{ color: C.gray }}>
              <ShieldQuestion size={13} /> KYC not submitted
            </span>
          </div>
          <div className="px-5 pb-4 text-xs" style={{ color: C.slateMuted }}>Pickup and job dispatch</div>

          <div className="px-3 pb-3">
            <div className="rounded-2xl px-5 py-5 text-white" style={{ background: `linear-gradient(135deg, ${C.bannerFrom}, ${C.bannerTo})` }}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide opacity-90">
                  <Leaf size={13} /> CLEANLIFE
                </div>
                <div className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">
                  <Wallet size={12} /> {fcfa(collector.wallet)}
                </div>
              </div>
              <div className="text-sm opacity-90">Good morning</div>
              <div className="text-xl font-extrabold">{collector.name || "—"}</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm opacity-80">
                  {collector.online ? "You're online and receiving jobs" : "You're offline"}
                </div>
                <button
                  onClick={() => setCollector((c) => ({ ...c, online: !c.online }))}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                  style={{ backgroundColor: collector.online ? "#fff" : "rgba(255,255,255,0.15)", color: collector.online ? C.primaryDark : "#fff" }}
                >
                  <Power size={12} /> {collector.online ? "Online" : "Offline"}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-3 pb-4">
            {myActiveJob && (
              <ActiveJobPanel
                job={myActiveJob}
                onArrive={arriveJob}
                onConfirmCash={confirmCash}
                onConfirmMomo={confirmMomo}
                onSubmitProof={submitProof}
              />
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="text-sm font-extrabold" style={{ color: C.slate }}>Available pickup requests</div>
              <div className="text-xs font-medium" style={{ color: C.slateMuted }}>{available.length} nearby</div>
            </div>

            {!collector.online ? (
              <div className="rounded-2xl px-4 py-3 text-center text-sm font-medium" style={{ backgroundColor: C.page, color: C.slateMuted, border: `1px dashed ${C.border}` }}>
                Go online to start receiving pickup requests.
              </div>
            ) : available.length === 0 ? (
              <div className="rounded-2xl px-4 py-3 text-center text-sm font-medium" style={{ backgroundColor: C.mintSoft, color: C.primaryDark, border: `1px dashed ${C.mint}` }}>
                No jobs available right now.
              </div>
            ) : (
              available.map((j) => (
                <JobCard key={j.id} job={j} onAccept={acceptJob} disabled={!!myActiveJob} />
              ))
            )}
          </div>

          <div className="flex gap-3 px-3 pb-5">
            <StatCard label="Jobs today" value={stats.jobsToday} sub="Completed" />
            <StatCard label="Earnings today" value={fcfa(stats.earningsToday)} sub="Credited to wallet" />
          </div>
        </div>
      </div>

      <Toast message={toast} />
      <BottomNav active={navTab} setActive={setNavTab} />
    </div>
  );
}