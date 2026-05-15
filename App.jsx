import { useState } from "react";

// ─── ALLURES ───────────────────────────────────────────────────────────────
function fmtPace(minPerKm) {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function calcPaces(totalMin) {
  const base = totalMin / 42.195;
  return {
    marathon: fmtPace(base),
    semi:     fmtPace(base * 0.92),
    "10km":   fmtPace(base * 0.82),
    "5km":    fmtPace(base * 0.74),
    EF:       fmtPace(base * 1.18),
  };
}

// ─── GÉNÉRATEUR DE PLAN ────────────────────────────────────────────────────
function generatePlan(hours, minutes, weeks, runsPerWeek, level) {
  const totalMin = hours * 60 + minutes;
  const paces = calcPaces(totalMin);
  const base = totalMin / 42.195;
  const pm = fmtPace(base);
  const p21 = fmtPace(base * 0.92);
  const p10 = fmtPace(base * 0.82);
  const p5  = fmtPace(base * 0.74);
  const pEF = fmtPace(base * 1.18);

  // Structure des phases
  const affutagWeeks = 2;
  const buildWeeks = weeks - affutagWeeks;

  // Jours selon fréquence
  const days3 = ["Mercredi", "Vendredi", "Dimanche"];
  const days4 = ["Mardi", "Mercredi", "Jeudi", "Dimanche"];
  const days5 = ["Lundi", "Mardi", "Jeudi", "Samedi", "Dimanche"];
  const sessionDays = runsPerWeek === 3 ? days3 : runsPerWeek === 4 ? days4 : days5;

  // Volume SL progressif (en minutes)
  function getSLDuration(weekNum) {
    const pct = weekNum / buildWeeks;
    if (pct < 0.25) return 80 + Math.round(pct * 4 * 20);
    if (pct < 0.6)  return 100 + Math.round((pct - 0.25) / 0.35 * 50);
    if (pct < 0.85) return 150;
    return 100; // pic puis descend avant affûtage
  }

  function fmtDur(min) {
    if (min < 60) return `${min}'`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
  }

  function getPhase(weekNum) {
    const pct = weekNum / buildWeeks;
    if (pct <= 0.25) return "Amorce";
    if (pct <= 0.65) return "Progression";
    return "Intensive";
  }

  function isRecoveryWeek(weekNum) {
    return weekNum % 4 === 0 && weekNum < buildWeeks;
  }

  function getSessionsForWeek(weekNum) {
    const phase = getPhase(weekNum);
    const isRecov = isRecoveryWeek(weekNum);
    const slMin = isRecov
      ? Math.round(getSLDuration(weekNum) * 0.65)
      : getSLDuration(weekNum);

    if (runsPerWeek === 3) {
      // Mercredi: fractionné
      // Vendredi: EF
      // Dimanche: SL
      let fracDesc, fracDur, fracIntens;
      if (isRecov) {
        fracDesc = `Fractionné léger : écho + 6×1' allure 10km (récup 1' EF) + retour calme. Allure 10km : ${p10}/km`;
        fracDur = "40'"; fracIntens = 5;
      } else if (phase === "Amorce") {
        fracDesc = `Écho 15' + 8×1'30 allure 5km (récup 1'30 EF) + retour calme 5'. Allure 5km : ${p5}/km`;
        fracDur = "50'"; fracIntens = 7;
      } else if (phase === "Progression") {
        const reps = weekNum <= buildWeeks * 0.45 ? "6×3'" : "4×5'";
        fracDesc = `Écho 20' + ${reps} allure 10km (récup 2' EF) + retour calme 5'. Allure 10km : ${p10}/km`;
        fracDur = "55'"; fracIntens = 7;
      } else {
        const reps = weekNum <= buildWeeks * 0.75 ? "3×8' allure 21km" : "2×15' allure marathon";
        const allure = weekNum <= buildWeeks * 0.75 ? `${p21}/km` : `${pm}/km`;
        fracDesc = `Écho 20' + ${reps} (récup 2' EF) + retour calme 5'. Allure : ${allure}`;
        fracDur = "1h"; fracIntens = 8;
      }

      const efMin = isRecov ? 35 : phase === "Amorce" ? 40 : phase === "Progression" ? 50 + weekNum * 2 : 55;
      const efDurClamped = Math.min(Math.max(efMin, 35), 70);

      let slDesc;
      if (isRecov) {
        slDesc = `Sortie longue de récupération en EF. Allure : ${pEF}/km`;
      } else if (phase === "Amorce") {
        slDesc = `Sortie longue facile + 5×5' allure marathon intercalés. EF : ${pEF}/km · Marathon : ${pm}/km`;
      } else if (phase === "Progression") {
        const fracs = weekNum <= buildWeeks * 0.5 ? "4×10'" : "5×10'";
        slDesc = `${fmtDur(Math.round(slMin * 0.55))} EF + ${fracs} allure marathon (récup 2' EF) + retour calme. Marathon : ${pm}/km`;
      } else {
        slDesc = `${fmtDur(Math.round(slMin * 0.5))} EF + 2×20' allure marathon (récup 3' EF) + retour calme. Marathon : ${pm}/km`;
      }

      return [
        { day: "Mercredi", type: "fractionné", duration: fracDur, description: fracDesc, intensity: fracIntens },
        { day: "Vendredi", type: "EF", duration: fmtDur(efDurClamped), description: `Footing en endurance fondamentale, allure conversationnelle. Allure : ${pEF}/km`, intensity: 3 },
        { day: "Dimanche", type: "sortie longue", duration: fmtDur(slMin), description: slDesc, intensity: isRecov ? 3 : phase === "Amorce" ? 4 : 6 },
      ];
    }

    if (runsPerWeek === 4) {
      let mardDesc, mardDur, mardIntens;
      if (phase === "Amorce" || isRecov) {
        mardDesc = `Côtes courtes : écho 15' + ${isRecov ? "6" : "8"}×10'' sprint en côte (récup descente) + retour calme 10'. Travail musculaire explosif.`;
        mardDur = isRecov ? "30'" : "35'"; mardIntens = isRecov ? 4 : 6;
      } else if (phase === "Progression") {
        mardDesc = `Côtes : écho 15' + ${weekNum % 2 === 0 ? "10×30''" : "12×30''"} en côte (récup descente) + retour calme 10'.`;
        mardDur = "45'"; mardIntens = 6;
      } else {
        mardDesc = `Côtes longues : écho 20' + 8×45'' en côte (récup descente) + retour calme 10'.`;
        mardDur = "50'"; mardIntens = 7;
      }

      let fracDesc, fracDur, fracIntens;
      if (isRecov) {
        fracDesc = `Fractionné léger : écho + 5×2' allure 10km (récup 1' EF) + retour calme. Allure 10km : ${p10}/km`;
        fracDur = "40'"; fracIntens = 5;
      } else if (phase === "Amorce") {
        fracDesc = `Écho 20' + 10×1'30 allure 5km (récup 1'30 EF) + retour calme. Allure 5km : ${p5}/km`;
        fracDur = "55'"; fracIntens = 7;
      } else if (phase === "Progression") {
        fracDesc = `Écho 20' + 4×5' allure 10km (récup 2' EF) + retour calme. Allure 10km : ${p10}/km`;
        fracDur = "1h"; fracIntens = 8;
      } else {
        fracDesc = `Écho 20' + 3×10' allure semi-marathon (récup 2' EF) + retour calme. Allure 21km : ${p21}/km`;
        fracDur = "1h05"; fracIntens = 8;
      }

      const jeudiMin = isRecov ? 35 : 45 + Math.min(weekNum * 2, 25);

      let slDesc;
      if (isRecov) {
        slDesc = `Sortie longue récup, tout en EF. Allure : ${pEF}/km`;
      } else if (phase === "Amorce") {
        slDesc = `EF + 4×7' allure marathon (récup 2' EF). Marathon : ${pm}/km`;
      } else if (phase === "Progression") {
        slDesc = `${fmtDur(Math.round(slMin * 0.5))} EF + 4×10' allure marathon (récup 2' EF) + retour calme. Marathon : ${pm}/km`;
      } else {
        slDesc = `${fmtDur(Math.round(slMin * 0.45))} EF + 4×15' allure marathon (récup 2' EF) + retour calme. Marathon : ${pm}/km`;
      }

      return [
        { day: "Mardi", type: "côtes", duration: mardDur, description: mardDesc, intensity: mardIntens },
        { day: "Mercredi", type: "fractionné", duration: fracDur, description: fracDesc, intensity: fracIntens },
        { day: "Jeudi", type: "EF", duration: fmtDur(Math.min(jeudiMin, 70)), description: `Footing EF de récupération active. Allure : ${pEF}/km`, intensity: 3 },
        { day: "Dimanche", type: "sortie longue", duration: fmtDur(slMin), description: slDesc, intensity: isRecov ? 3 : phase === "Amorce" ? 4 : 6 },
      ];
    }

    // 5x/semaine
    const lunMin = isRecov ? 30 : 35 + Math.min(weekNum * 2, 20);
    let fracDesc, fracDur, fracIntens;
    if (isRecov) {
      fracDesc = `Fractionné léger : écho + 5×2' allure 10km (récup 1') + retour calme. Allure 10km : ${p10}/km`;
      fracDur = "40'"; fracIntens = 5;
    } else if (phase === "Amorce") {
      fracDesc = `Écho 20' + 10×1'30 allure 5km (récup 1'30 EF) + retour calme. Allure 5km : ${p5}/km`;
      fracDur = "55'"; fracIntens = 7;
    } else if (phase === "Progression") {
      fracDesc = `Écho 20' + 6×3' allure 10km (récup 2') + retour calme. Allure 10km : ${p10}/km`;
      fracDur = "1h"; fracIntens = 8;
    } else {
      fracDesc = `Écho 20' + 3×10' allure semi (récup 2') + retour calme. Allure 21km : ${p21}/km`;
      fracDur = "1h05"; fracIntens = 8;
    }
    const jeudiMin5 = isRecov ? 35 : 50 + Math.min(weekNum * 2, 25);
    const samMin = isRecov ? 30 : 40;

    let slDesc;
    if (isRecov) slDesc = `Sortie récup en EF. Allure : ${pEF}/km`;
    else if (phase === "Amorce") slDesc = `EF + 5×5' allure marathon. Marathon : ${pm}/km`;
    else if (phase === "Progression") slDesc = `${fmtDur(Math.round(slMin*0.45))} EF + 5×10' allure marathon + retour calme. Marathon : ${pm}/km`;
    else slDesc = `${fmtDur(Math.round(slMin*0.4))} EF + 2×20' allure marathon + retour calme. Marathon : ${pm}/km`;

    return [
      { day: "Lundi", type: "EF", duration: fmtDur(Math.min(lunMin,55)), description: `Footing léger de récupération. Allure : ${pEF}/km`, intensity: 2 },
      { day: "Mardi", type: "fractionné", duration: fracDur, description: fracDesc, intensity: fracIntens },
      { day: "Jeudi", type: "EF", duration: fmtDur(Math.min(jeudiMin5,75)), description: `Footing EF, technique de course. Allure : ${pEF}/km`, intensity: 3 },
      { day: "Samedi", type: "côtes", duration: fmtDur(samMin), description: `Écho 15' + ${isRecov ? "6×10''" : "10×30''"} en côte + retour calme.`, intensity: isRecov ? 4 : 6 },
      { day: "Dimanche", type: "sortie longue", duration: fmtDur(slMin), description: slDesc, intensity: isRecov ? 3 : phase === "Amorce" ? 4 : 6 },
    ];
  }

  function getAffutageSessions(affWeek) {
    // affWeek = 1 ou 2
    if (affWeek === 1) {
      if (runsPerWeek === 3) return [
        { day: "Mercredi", type: "EF", duration: "45'", description: `Footing EF léger. Allure : ${pEF}/km`, intensity: 2 },
        { day: "Vendredi", type: "fractionné", duration: "40'", description: `Écho 15' + 10×2' allure 10km (récup 1') + retour calme. Stocke l'énergie, ne force pas. ${p10}/km`, intensity: 5 },
        { day: "Dimanche", type: "sortie longue", duration: "1h", description: `Sortie courte : 40' EF + 3×5' allure marathon + retour calme. Rappel d'allure. ${pm}/km`, intensity: 4 },
      ];
      if (runsPerWeek === 4) return [
        { day: "Mardi", type: "EF", duration: "35'", description: `Footing léger. Allure : ${pEF}/km`, intensity: 2 },
        { day: "Mercredi", type: "fractionné", duration: "45'", description: `Écho 15' + 10×2' allure 10km (récup 1' EF) + retour calme. ${p10}/km`, intensity: 5 },
        { day: "Jeudi", type: "EF", duration: "25'", description: `Mini footing, jambes légères. Allure : ${pEF}/km`, intensity: 2 },
        { day: "Dimanche", type: "sortie longue", duration: "1h", description: `40' EF + 3×5' allure marathon + retour calme. ${pm}/km`, intensity: 4 },
      ];
      return [
        { day: "Lundi", type: "EF", duration: "30'", description: `Footing très léger. Allure : ${pEF}/km`, intensity: 2 },
        { day: "Mardi", type: "fractionné", duration: "45'", description: `Écho 15' + 10×2' allure 10km (récup 1') + retour calme. ${p10}/km`, intensity: 5 },
        { day: "Jeudi", type: "EF", duration: "25'", description: `Mini footing. Allure : ${pEF}/km`, intensity: 2 },
        { day: "Samedi", type: "EF", duration: "20'", description: `10' EF + 6×100m accélération progressive. Réveille les jambes.`, intensity: 3 },
        { day: "Dimanche", type: "sortie longue", duration: "1h", description: `40' EF + 3×5' allure marathon. ${pm}/km`, intensity: 4 },
      ];
    } else {
      // Semaine du marathon
      if (runsPerWeek === 3) return [
        { day: "Mercredi", type: "EF", duration: "30'", description: `25' EF + 6×100m accélérations progressives. Garde les jambes légères.`, intensity: 2 },
        { day: "Vendredi", type: "fractionné", duration: "25'", description: `10' EF + 3×2' allure marathon (récup 2') + 5' EF. Rappel d'allure. ${pm}/km`, intensity: 4 },
        { day: "Dimanche", type: "MARATHON", duration: "JOUR J", description: `🏁 MARATHON — Respect ton allure cible dès le départ : ${pm}/km. La course commence vraiment après le 30ème km !`, intensity: 10 },
      ];
      return [
        { day: "Mardi", type: "EF", duration: "25'", description: `Footing léger, jambes qui tournent. Allure : ${pEF}/km`, intensity: 2 },
        { day: "Mercredi", type: "EF", duration: "30'", description: `25' EF + 6×100m accélérations progressives.`, intensity: 2 },
        { day: "Vendredi", type: "fractionné", duration: "25'", description: `10' EF + 3×2' allure marathon (récup 2') + 5' EF. ${pm}/km`, intensity: 4 },
        { day: "Dimanche", type: "MARATHON", duration: "JOUR J", description: `🏁 MARATHON — Allure cible : ${pm}/km. La vraie course commence après 30km !`, intensity: 10 },
      ];
    }
  }

  function getTheme(weekNum, phase, isRecov) {
    if (isRecov) return "Semaine de récupération — batteries en charge";
    const themes = {
      Amorce: ["Mise en route progressive", "Construction des bases", "Trouver ses sensations"],
      Progression: ["Montée en puissance", "Travail de vitesse", "Allure marathon en ligne de mire", "Endurance qui s'installe", "Cap sur la distance"],
      Intensive: ["Séances clés du programme", "Charge maximale", "Test d'allure marathon"],
    };
    const arr = themes[phase] || ["En route vers le marathon"];
    return arr[weekNum % arr.length];
  }

  function calcVolume(sessions) {
    // Estimation grossière en minutes
    let total = 0;
    sessions.forEach(s => {
      const d = s.duration;
      if (d === "JOUR J") { total += 240; return; }
      const hMatch = d.match(/(\d+)h(\d+)?/);
      const mMatch = d.match(/^(\d+)'$/);
      if (hMatch) total += parseInt(hMatch[1]) * 60 + parseInt(hMatch[2] || 0);
      else if (mMatch) total += parseInt(mMatch[1]);
    });
    if (total < 60) return `~${total}'`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m === 0 ? `~${h}h` : `~${h}h${m.toString().padStart(2, "0")}`;
  }

  const tips = [
    "Ne néglige pas les séances EF — courir trop vite en récup est l'erreur la plus fréquente.",
    "La sortie longue se court à allure conversationnelle. Si tu peux pas parler, tu vas trop vite.",
    "Hydrate-toi pendant les sorties > 1h et teste dès maintenant ce que tu prendras le jour J.",
    "Le sommeil est ta première récupération. Vise 8h les nuits après séance intense.",
    "Les côtes renforcent les muscles sans fatigue cardiovasculaire excessive — ne les saute pas.",
    "En fractionné, la récupération est aussi importante que l'effort. Marche ou trottine vraiment lentement.",
    "Si tu ressens une douleur pendant plus de 3 jours, consulte avant de continuer.",
    "Pendant la semaine de récup, l'adaptation se fait. C'est là que tu progresses vraiment.",
    "Teste tes chaussures de course dès maintenant — jamais de nouveaux équipements le jour J.",
    "Le pic de forme arrive 10-14 jours après le dernier gros effort. L'affûtage est crucial.",
    "En sortie longue, emporte toujours de l'eau et un gel à partir de 1h30 de course.",
    "La régularité bat l'intensité. Mieux vaut 3 sorties faciles qu'1 séance héroïque.",
  ];

  const planWeeks = [];

  for (let i = 1; i <= buildWeeks; i++) {
    const isRecov = isRecoveryWeek(i);
    const phase = isRecov ? "Récupération" : getPhase(i);
    const sessions = getSessionsForWeek(i);
    planWeeks.push({
      number: i,
      phase,
      theme: getTheme(i, phase, isRecov),
      sessions,
      weekly_volume: calcVolume(sessions),
      coach_tip: tips[(i - 1) % tips.length],
    });
  }

  // Semaines affûtage
  for (let a = 1; a <= affutagWeeks; a++) {
    const sessions = getAffutageSessions(a);
    planWeeks.push({
      number: buildWeeks + a,
      phase: "Affûtage",
      theme: a === 1 ? "Réduire le volume, garder l'intensité" : "Dernière ligne droite avant le grand jour",
      sessions,
      weekly_volume: calcVolume(sessions),
      coach_tip: a === 1
        ? "Le but de ces 2 semaines : arriver frais le jour J. Résiste à l'envie d'en faire plus."
        : "Reste confiant — l'entraînement est fait. Hydrate-toi bien, dors bien, prépare ton dossard.",
    });
  }

  const label = `${hours}h${minutes.toString().padStart(2, "0")}`;
  return {
    plan_summary: `Programme ${label} sur ${weeks} semaines à ${runsPerWeek} sorties/semaine, niveau ${level}. Allure marathon cible : ${paces.marathon}/km.`,
    paces,
    weeks: planWeeks,
  };
}

// ─── COULEURS ──────────────────────────────────────────────────────────────
const C = {
  bg: "#050f0a", card: "#0a1a10", border: "#0f2a18",
  accent: "#22c55e", accentDark: "#16a34a", accentLight: "#4ade80",
  muted: "#6b7280", text: "#e2ead6", soft: "#9ab89a",
};

function getColor(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("marathon") && t.includes("jour")) return "#ef4444";
  if (t.includes("repos")) return "#374151";
  if (t.includes("affût")) return "#fbbf24";
  if (t.includes("côte")) return "#a3e635";
  if (t.includes("fractionné") || t.includes("allure 5") || t.includes("allure 10") || t.includes("allure 21")) return "#86efac";
  if (t.includes("sortie longue")) return "#34d399";
  return C.accent;
}

function phaseColor(p) {
  if (!p) return C.muted;
  const l = p.toLowerCase();
  if (l.includes("amorce")) return "#38bdf8";
  if (l.includes("progression")) return C.accent;
  if (l.includes("intensive")) return "#f97316";
  if (l.includes("récup")) return "#a78bfa";
  if (l.includes("affût")) return "#fbbf24";
  return C.muted;
}

function fmtDurDisplay(d) { return d; }

const sel = {
  width: "100%", padding: "10px 12px", background: "#050f0a",
  border: "1.5px solid #0f2a18", borderRadius: 8, color: "#e2ead6",
  fontSize: 14, fontWeight: 600, cursor: "pointer", outline: "none",
};

// ─── APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const [hours, setHours] = useState(4);
  const [minutes, setMinutes] = useState(0);
  const [weeks, setWeeks] = useState(12);
  const [rpw, setRpw] = useState(3);
  const [level, setLevel] = useState("intermédiaire");
  const [plan, setPlan] = useState(null);
  const [activeWeek, setActiveWeek] = useState(null);
  const [warning, setWarning] = useState("");

  const generate = () => {
    const tot = hours * 60 + minutes;
    let w = "";
    if (weeks < 8) w = "⚠️ Moins de 8 semaines est risqué.";
    else if (tot < 150 && level === "débutant") w = "⚠️ Sub-2h30 est très ambitieux pour un débutant.";
    setWarning(w);
    const p = generatePlan(hours, minutes, weeks, rpw, level);
    setPlan(p);
    setActiveWeek(0);
  };

  const pacePreview = calcPaces(hours * 60 + minutes).marathon;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif", paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#050f0a,#0a1f12,#050f0a)", borderBottom: `1px solid ${C.border}`, padding: "32px 24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 250, height: 250, background: `radial-gradient(circle,${C.accent}18 0%,transparent 65%)`, borderRadius: "50%" }} />
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <span style={{ fontSize: 30 }}>🏃</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, background: `linear-gradient(90deg,${C.accentLight},${C.accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Générateur de Plan Marathon
            </h1>
          </div>
          <p style={{ margin: 0, color: C.soft, fontSize: 13 }}>Programme personnalisé · Instantané · Sans connexion requise</p>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px 0" }}>

        {/* Formulaire */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 24px", marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 12, fontWeight: 700, color: C.soft, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tes paramètres</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 18 }}>

            <div>
              <label style={{ display: "block", fontSize: 11, color: C.muted, marginBottom: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Objectif</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select value={hours} onChange={e => setHours(+e.target.value)} style={{ ...sel, flex: 1 }}>
                  {[2,3,4,5,6].map(h => <option key={h} value={h}>{h}h</option>)}
                </select>
                <select value={minutes} onChange={e => setMinutes(+e.target.value)} style={{ ...sel, flex: 1 }}>
                  {[0,15,30,45].map(m => <option key={m} value={m}>{m.toString().padStart(2,"0")}</option>)}
                </select>
              </div>
              <p style={{ margin: "5px 0 0", fontSize: 12, color: C.accent }}>→ {pacePreview}/km</p>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, color: C.muted, marginBottom: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Semaines</label>
              <select value={weeks} onChange={e => setWeeks(+e.target.value)} style={sel}>
                {[8,10,12,14,16,18,20,24].map(w => <option key={w} value={w}>{w} semaines</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, color: C.muted, marginBottom: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Sorties / semaine</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[3,4,5].map(r => (
                  <button key={r} onClick={() => setRpw(r)} style={{ flex: 1, padding: "10px 4px", border: `2px solid ${rpw===r ? C.accent : C.border}`, background: rpw===r ? `${C.accent}20` : C.bg, color: rpw===r ? C.accent : C.muted, borderRadius: 8, cursor: "pointer", fontWeight: 800, fontSize: 16 }}>
                    {r}×
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, color: C.muted, marginBottom: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Niveau</label>
              <select value={level} onChange={e => setLevel(e.target.value)} style={sel}>
                <option value="débutant">Débutant</option>
                <option value="intermédiaire">Intermédiaire</option>
                <option value="confirmé">Confirmé</option>
              </select>
            </div>
          </div>

          {warning && <div style={{ marginTop: 14, padding: "10px 14px", background: "#fbbf2415", border: "1px solid #fbbf2440", borderRadius: 8, fontSize: 13, color: "#fbbf24" }}>{warning}</div>}

          <button onClick={generate} style={{ marginTop: 22, width: "100%", padding: "14px", background: `linear-gradient(135deg,${C.accent},${C.accentDark})`, border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", letterSpacing: "0.03em" }}>
            🎯 Générer mon programme
          </button>
        </div>

        {plan && (
          <div>
            {/* Résumé allures */}
            <div style={{ background: "linear-gradient(135deg,#0a1f12,#0f2a18)", border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, marginBottom: 22 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800, color: C.text }}>{hours}h{minutes.toString().padStart(2,"0")} · {weeks} sem · {rpw}×/sem · {level}</h2>
                  <p style={{ margin: 0, color: C.soft, fontSize: 13, lineHeight: 1.6 }}>{plan.plan_summary}</p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(plan.paces).map(([k, v]) => (
                    <div key={k} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", textAlign: "center", minWidth: 66 }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Navigation semaines */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {plan.weeks.map((w, i) => (
                  <button key={i} onClick={() => setActiveWeek(i)} style={{ padding: "5px 9px", background: activeWeek===i ? `${C.accent}20` : C.card, border: `1.5px solid ${activeWeek===i ? C.accent : C.border}`, borderRadius: 7, color: activeWeek===i ? C.accent : C.muted, cursor: "pointer", fontSize: 11, fontWeight: 700, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <span>S{w.number}</span>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: phaseColor(w.phase) }} />
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                {[["Amorce","#38bdf8"],["Progression",C.accent],["Intensive","#f97316"],["Récupération","#a78bfa"],["Affûtage","#fbbf24"]].map(([l,c]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.muted }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />{l}
                  </div>
                ))}
              </div>
            </div>

            {/* Détail semaine active */}
            {activeWeek !== null && plan.weeks[activeWeek] && (
              <WeekCard week={plan.weeks[activeWeek]} />
            )}

            {/* Vue d'ensemble */}
            <div style={{ marginTop: 22 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Vue d'ensemble</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {plan.weeks.map((w, i) => (
                  <button key={i} onClick={() => { setActiveWeek(i); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: activeWeek===i ? `${C.accent}10` : C.card, border: `1px solid ${activeWeek===i ? C.accent : C.border}`, borderRadius: 9, cursor: "pointer", textAlign: "left", width: "100%" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: `${C.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: C.accent, flexShrink: 0 }}>{w.number}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{w.theme}</span>
                        <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: `${phaseColor(w.phase)}20`, color: phaseColor(w.phase), fontWeight: 700 }}>{w.phase}</span>
                      </div>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {w.sessions.filter(s => s.type !== "repos").map((s, j) => (
                          <span key={j} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: `${getColor(s.type)}20`, color: getColor(s.type), border: `1px solid ${getColor(s.type)}40` }}>
                            {s.day?.slice(0,3)} · {s.duration}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{w.weekly_volume}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 22, padding: "11px 15px", background: `${C.accent}08`, border: `1px solid ${C.accent}20`, borderRadius: 9, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
              ⚕️ Programme indicatif. Adapte les séances à tes sensations. En cas de douleur persistante, consulte un professionnel de santé.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WeekCard({ week }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text }}>Semaine {week.number}</h3>
            <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: `${phaseColor(week.phase)}20`, color: phaseColor(week.phase), fontWeight: 700, border: `1px solid ${phaseColor(week.phase)}40` }}>{week.phase}</span>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: C.soft }}>{week.theme}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", marginBottom: 1 }}>Volume</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{week.weekly_volume}</div>
        </div>
      </div>

      <div style={{ padding: "14px 22px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {week.sessions.map((s, i) => {
            const color = getColor(s.type);
            const isRest = s.type === "repos";
            const isRace = s.type === "MARATHON";
            return (
              <div key={i} style={{ display: "flex", gap: 10, padding: "12px 14px", background: isRace ? "#1a0505" : isRest ? C.bg : "#0a1a10", borderRadius: 9, border: `1px solid ${isRace ? "#ef444440" : isRest ? C.bg : C.border}`, alignItems: "flex-start" }}>
                <div style={{ width: 40, flexShrink: 0, paddingTop: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>{s.day?.slice(0,3)}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 700, color }}>
                      <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, marginRight: 6 }} />
                      {isRest ? "Repos" : s.type === "MARATHON" ? "🏁 MARATHON" : s.type?.charAt(0).toUpperCase() + s.type?.slice(1)}
                    </span>
                    {s.duration && s.duration !== "JOUR J" && (
                      <span style={{ fontSize: 11, color: C.muted, background: C.border, padding: "1px 7px", borderRadius: 4 }}>{s.duration}</span>
                    )}
                  </div>
                  {s.description && <p style={{ margin: "0 0 5px", fontSize: 12, color: C.soft, lineHeight: 1.5 }}>{s.description}</p>}
                  {s.intensity > 0 && !isRest && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 10, color: C.muted }}>Intensité</span>
                      <div style={{ width: 70, height: 3, background: "#0f2a18", borderRadius: 2 }}>
                        <div style={{ width: `${(s.intensity/10)*100}%`, height: "100%", background: s.intensity<=3 ? C.accent : s.intensity<=6 ? "#fbbf24" : "#ef4444", borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: C.muted }}>{s.intensity}/10</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {week.coach_tip && (
          <div style={{ marginTop: 14, padding: "11px 14px", background: `${C.accent}08`, border: `1px solid ${C.accent}25`, borderRadius: 9, display: "flex", gap: 9 }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>💬</span>
            <p style={{ margin: 0, fontSize: 12, color: C.soft, lineHeight: 1.6 }}>
              <strong style={{ color: C.accent }}>Coach : </strong>{week.coach_tip}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
