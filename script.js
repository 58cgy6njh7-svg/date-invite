/* =============================================
   DATE INVITE — script.js
   =============================================

   ── SETTINGS ─────────────────────────────────
   Edit everything here — no need to touch
   the HTML or other JS.
   ============================================= */

const SETTINGS = {
  // Screen 1
  title: "Will you go on a date with me?",

  // Screen 4 — replace this file in /assets/
  finalImage: "assets/final-photo.jpg",

  // ── Google Calendar Integration ───────────────
  // STEP 1: Go to https://console.cloud.google.com
  // STEP 2: Create a project → Enable "Google Calendar API"
  // STEP 3: Create an API Key (restrict to "Google Calendar API")
  // STEP 4: Paste the key below
  googleApiKey: "AIzaSyAvlEIBgrJcj87bLe-OCfRBrbXgXWiGpNo",

  // Your calendar ID (usually your Gmail address, or found in
  // Google Calendar → Settings → your calendar → "Calendar ID")
  calendarId: "dgrobov@yanarchy.com",

  // Your local timezone (IANA format)
  timezone: "Europe/Podgorica",

  // Available time slots shown each day (24h format)
  timeSlots: [
    "10:00", "11:00", "12:00", "13:00",
    "14:00", "16:00", "17:00", "18:00",
    "19:00", "20:00"
  ],

  // How many months ahead the user can book
  maxMonthsAhead: 3,

  // ── EmailJS Notification ──────────────────────
  // Sends you an email when he confirms a date
  emailjsServiceId:  "service_c9r92cg",
  emailjsTemplateId: "tmmmpad",
  emailjsPublicKey:  "X9jvkC3h_DpT8j0ip"
};

/* =============================================
   STATE — everything selected is stored here
   ============================================= */
const STATE = {
  selectedActivity: null,
  selectedDate: null,      // Date object
  selectedTime: null,      // "HH:MM" string
  busySlots: {}            // { "YYYY-MM-DD": ["HH:MM", ...] }
};

/* =============================================
   SCREEN MANAGEMENT
   ============================================= */

let currentScreen = 1;

/** Transition from the current screen to a new one */
function goToScreen(n) {
  const current = document.getElementById(`screen-${currentScreen}`);
  const next    = document.getElementById(`screen-${n}`);

  current.classList.add("exit");
  current.classList.remove("active");

  setTimeout(() => {
    current.classList.remove("exit");
    next.classList.add("active");
    currentScreen = n;
  }, 450);
}

/* =============================================
   SCREEN 1 — YES / NO BUTTON LOGIC
   ============================================= */

const btnNo = document.getElementById("btn-no");
let noButtonFleeing = false;

/**
 * Make the NO button flee when hovered (desktop)
 * or tapped (mobile).
 */
function initNoButton() {
  // Desktop: flee on mousemove proximity
  document.addEventListener("mousemove", (e) => {
    if (currentScreen !== 1) return;
    const rect = btnNo.getBoundingClientRect();
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);

    if (dist < 120) fleeNo();
  });

  // Mobile: flee on touchstart
  btnNo.addEventListener("touchstart", (e) => {
    e.preventDefault();
    fleeNo();
  }, { passive: false });
}

function fleeNo() {
  if (!noButtonFleeing) {
    // First flee: lift the button out of the flow into fixed positioning
    noButtonFleeing = true;
    const rect = btnNo.getBoundingClientRect();
    btnNo.style.left = rect.left + "px";
    btnNo.style.top  = rect.top  + "px";
    btnNo.classList.add("fleeing");
  }
  moveBtnNoRandom();
}

function moveBtnNoRandom() {
  const margin = 80;
  const bw = btnNo.offsetWidth  || 100;
  const bh = btnNo.offsetHeight || 50;

  const maxX = window.innerWidth  - bw - margin;
  const maxY = window.innerHeight - bh - margin;

  const x = Math.random() * (maxX - margin) + margin;
  const y = Math.random() * (maxY - margin) + margin;

  btnNo.style.left = x + "px";
  btnNo.style.top  = y + "px";
}

function handleNo() {
  // Shouldn't be reachable, but just in case
  fleeNo();
}

/* =============================================
   SCREEN 1 — YES BUTTON + CONFETTI
   ============================================= */

async function handleYes() {
  launchConfetti();
  await sleep(600);   // let confetti start
  goToScreen(2);
  await sleep(500);
  stopConfetti();
}

/* =============================================
   SCREEN 2 — ACTIVITY SELECTION
   ============================================= */

function selectActivity(card) {
  // Highlight selected card
  document.querySelectorAll(".card").forEach(c => c.classList.remove("selected"));
  card.classList.add("selected");

  STATE.selectedActivity = card.dataset.option;

  // Animate to screen 3 after a short pause
  setTimeout(() => {
    initCalendar();
    goToScreen(3);
  }, 380);
}

/* =============================================
   SCREEN 3 — CALENDAR
   ============================================= */

let calViewDate = new Date();  // month being displayed
calViewDate.setDate(1);

function initCalendar() {
  renderMonth(calViewDate);
  // Try to fetch Google Calendar busy times if configured
  if (SETTINGS.googleApiKey && SETTINGS.calendarId) {
    fetchBusyTimes();
  } else {
    setGcalStatus("💡 Connect Google Calendar in SETTINGS to auto-block busy slots.");
  }
}

function changeMonth(delta) {
  calViewDate.setMonth(calViewDate.getMonth() + delta);
  renderMonth(calViewDate);
}

function renderMonth(date) {
  const label = date.toLocaleString("default", { month: "long", year: "numeric" });
  document.getElementById("cal-month-label").textContent = label.toUpperCase();

  const grid   = document.getElementById("cal-grid");
  grid.innerHTML = "";

  const year  = date.getFullYear();
  const month = date.getMonth();

  const firstDay   = new Date(year, month, 1).getDay();   // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  today.setHours(0,0,0,0);

  const maxDate = new Date(today);
  maxDate.setMonth(maxDate.getMonth() + SETTINGS.maxMonthsAhead);

  // Empty cells before the 1st
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.classList.add("cal-day", "empty");
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month, d);
    const btn = document.createElement("button");
    btn.classList.add("cal-day");
    btn.textContent = d;

    if (isSameDay(cellDate, today)) btn.classList.add("today");

    const isPast   = cellDate < today;
    const isFuture = cellDate > maxDate;

    if (isPast || isFuture) {
      btn.classList.add("past");
      btn.disabled = true;
    } else {
      if (STATE.selectedDate && isSameDay(cellDate, STATE.selectedDate)) {
        btn.classList.add("selected");
      }
      btn.addEventListener("click", () => selectDay(cellDate, btn));
    }

    grid.appendChild(btn);
  }
}

function selectDay(date, btn) {
  STATE.selectedDate = date;
  STATE.selectedTime = null;

  // Update selected style
  document.querySelectorAll(".cal-day").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");

  renderTimeSlots(date);
}

function renderTimeSlots(date) {
  const dateKey    = formatDateKey(date);
  const busyForDay = STATE.busySlots[dateKey] || [];

  const wrapper = document.getElementById("time-slots-wrapper");
  const slots   = document.getElementById("time-slots");
  slots.innerHTML = "";

  SETTINGS.timeSlots.forEach(time => {
    const btn = document.createElement("button");
    btn.classList.add("time-slot");
    btn.textContent = formatTime12h(time);

    if (busyForDay.includes(time)) {
      btn.classList.add("busy");
      btn.disabled = true;
      btn.title = "Not available";
    } else {
      btn.addEventListener("click", () => selectTime(time, btn));
    }

    slots.appendChild(btn);
  });

  // Animate in
  wrapper.classList.add("visible");
}

function selectTime(time, btn) {
  STATE.selectedTime = time;
  document.querySelectorAll(".time-slot").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");

  // Move to screen 4 after a short pause
  setTimeout(() => {
    populateConfirmation();
    sendNotificationEmail();
    goToScreen(4);
  }, 450);
}

/* =============================================
   GOOGLE CALENDAR INTEGRATION
   ─────────────────────────────────────────────
   This function fetches busy/free data from
   Google Calendar using the FreeBusy API.

   TO ENABLE:
   1. Go to https://console.cloud.google.com
   2. New project → Enable "Google Calendar API"
   3. Credentials → Create API Key
      → Restrict to "Google Calendar API"
   4. Set SETTINGS.googleApiKey and
      SETTINGS.calendarId above.

   IMPORTANT: Make sure your calendar's sharing
   settings allow "public" or "anyone with link"
   to see free/busy information:
   Google Calendar → Settings → your calendar
   → "Share with specific people" section or
   "Access permissions" → "See only free/busy"

   The FreeBusy endpoint does not require OAuth
   when the calendar is publicly shared.
   ============================================= */

async function fetchBusyTimes() {
  setGcalStatus("⏳ Checking availability…");

  const now     = new Date();
  const maxDate = new Date(now);
  maxDate.setMonth(maxDate.getMonth() + SETTINGS.maxMonthsAhead);

  const body = {
    timeMin: now.toISOString(),
    timeMax: maxDate.toISOString(),
    timeZone: SETTINGS.timezone,
    items: [{ id: SETTINGS.calendarId }]
  };

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/freeBusy?key=${SETTINGS.googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const busyRanges = data.calendars?.[SETTINGS.calendarId]?.busy || [];

    // Convert busy UTC ranges to blocked local time slots
    busyRanges.forEach(({ start, end }) => {
      const startDt = new Date(start);
      const endDt   = new Date(end);

      SETTINGS.timeSlots.forEach(slotTime => {
        const [h, m] = slotTime.split(":").map(Number);

        // Build a Date for this slot in the user's timezone
        // We iterate over all days in the range (usually 1 day)
        const slotDate = new Date(startDt);
        slotDate.setHours(h, m, 0, 0);

        // Check if this slot falls within the busy range
        if (slotDate >= startDt && slotDate < endDt) {
          const dayKey = formatDateKey(slotDate);
          if (!STATE.busySlots[dayKey]) STATE.busySlots[dayKey] = [];
          if (!STATE.busySlots[dayKey].includes(slotTime)) {
            STATE.busySlots[dayKey].push(slotTime);
          }
        }
      });
    });

    setGcalStatus("✅ Calendar synced — busy slots are blocked.");
    // Re-render time slots if a day is already selected
    if (STATE.selectedDate) renderTimeSlots(STATE.selectedDate);

  } catch (err) {
    console.warn("Google Calendar fetch failed:", err);
    setGcalStatus("⚠️ Could not load calendar. All slots shown as available.");
  }
}

function setGcalStatus(msg) {
  document.getElementById("gcal-status").textContent = msg;
}

/* =============================================
   SCREEN 4 — CONFIRMATION SUMMARY
   ============================================= */

function populateConfirmation() {
  // Photo (path set in SETTINGS)
  document.getElementById("final-photo").src = SETTINGS.finalImage;

  // Date
  const dateStr = STATE.selectedDate
    ? STATE.selectedDate.toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      })
    : "—";
  document.getElementById("summary-date").textContent = dateStr;

  // Time
  document.getElementById("summary-time").textContent =
    STATE.selectedTime ? formatTime12h(STATE.selectedTime) : "—";

  // Activity
  document.getElementById("summary-activity").textContent =
    STATE.selectedActivity || "—";
}

/* =============================================
   CONFETTI ENGINE (canvas-based, no library)
   ============================================= */

let confettiParticles = [];
let confettiAnimFrame  = null;
const confettiCanvas   = document.getElementById("confetti-canvas");
const ctx              = confettiCanvas.getContext("2d");
const CONFETTI_COLORS  = [
  "#FF3B5C", "#FF8FA3", "#FFD6DC",
  "#FF6B6B", "#FFC0CB", "#FFFFFF",
  "#FF4D6D", "#C9184A"
];

function resizeConfetti() {
  confettiCanvas.width  = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeConfetti);
resizeConfetti();

function launchConfetti() {
  confettiCanvas.classList.add("active");
  confettiParticles = [];

  for (let i = 0; i < 140; i++) {
    confettiParticles.push({
      x:      Math.random() * confettiCanvas.width,
      y:      Math.random() * confettiCanvas.height - confettiCanvas.height,
      size:   Math.random() * 9 + 4,
      color:  CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      speedY: Math.random() * 3 + 1.5,
      speedX: (Math.random() - 0.5) * 2.5,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 6,
      shape:  Math.random() > 0.4 ? "rect" : "circle"
    });
  }

  animateConfetti();
}

function animateConfetti() {
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  let alive = false;
  confettiParticles.forEach(p => {
    p.y += p.speedY;
    p.x += p.speedX;
    p.rotation += p.rotSpeed;

    if (p.y < confettiCanvas.height + 20) alive = true;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.fillStyle = p.color;

    if (p.shape === "circle") {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    }

    ctx.restore();
  });

  if (alive) {
    confettiAnimFrame = requestAnimationFrame(animateConfetti);
  } else {
    stopConfetti();
  }
}

function stopConfetti() {
  if (confettiAnimFrame) {
    cancelAnimationFrame(confettiAnimFrame);
    confettiAnimFrame = null;
  }
  confettiCanvas.classList.remove("active");
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

/* =============================================
   EMAILJS — Send notification to you
   ============================================= */

function initEmailJS() {
  if (SETTINGS.emailjsPublicKey) {
    emailjs.init(SETTINGS.emailjsPublicKey);
  }
}

function sendNotificationEmail() {
  if (!SETTINGS.emailjsServiceId || !SETTINGS.emailjsTemplateId) return;

  const dateStr = STATE.selectedDate
    ? STATE.selectedDate.toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      })
    : "—";

  emailjs.send(SETTINGS.emailjsServiceId, SETTINGS.emailjsTemplateId, {
    activity: STATE.selectedActivity || "—",
    date:     dateStr,
    time:     STATE.selectedTime ? formatTime12h(STATE.selectedTime) : "—"
  }).then(() => {
    console.log("✅ Notification email sent!");
  }).catch((err) => {
    console.warn("EmailJS error:", err);
  });
}

/* =============================================
   ============================================= */

/** Format a Date as "YYYY-MM-DD" */
function formatDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

/** "14:30" → "2:30 PM" */
function formatTime12h(time) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2,"0")} ${suffix}`;
}

/** Simple same-day check */
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

/** Promise-based sleep */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* =============================================
   INIT
   ============================================= */

document.addEventListener("DOMContentLoaded", () => {
  // Init EmailJS
  initEmailJS();

  // Apply editable title
  document.querySelector("#main-question").innerHTML =
    SETTINGS.title.replace(/\n/g, "<br>");

  document.title = SETTINGS.title;

  // Start NO button flee logic
  initNoButton();
});
