/* ================= Carnet du Conseil Saint Mommolin =================
   Tout vit dans ce téléphone : rien n'est envoyé nulle part.
   ==================================================================== */
"use strict";

const CLE = "csm.carnet.v1";
const $ = s => document.querySelector(s);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const uid = () => Math.random().toString(36).slice(2, 9);

const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const JOURS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const POSTES = ["","Grand Chevalier","Député Grand Chevalier","Aumônier","Secrétaire-archiviste",
  "Secrétaire financier","Trésorier","Avocat","Cérémoniaire","Syndic","Intendant"];
const ST = { v:"À venir", c:"En cours", t:"Terminé" };
const ROM = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI"];

const SECTIONS = [
  { t:"Effectif", k:"effectif", ph:"Une remarque sur l'ouverture…" },
  { t:"Enseignement du Padre", k:"topo", ph:"Ce qu'a dit le Padre…" },
  { t:"Comptes", k:"comptes", ph:"Une précision sur les comptes…" },
  { t:"Services", k:"services", ph:"Ce qui s'est dit sur les services…" },
  { t:"Prochaines dates", k:"dates", ph:"Une précision sur le calendrier…" },
  { t:"Propositions spirituelles", k:"spirituel", ph:"Ce qui a été proposé…" },
  { t:"Présentation d'un frère", k:"presentation", ph:"Ce qu'il a partagé…" },
  { t:"Prochains topos", k:"topos", ph:"Une remarque sur les topos…" },
  { t:"Autres propositions", k:"note", ph:"Une proposition libre…" },
  { t:"À retenir toute l'année", k:"retenir", ph:"Un rappel permanent…" },
  { t:"Prochain conseil", k:"prochain", ph:"Une précision sur la prochaine fois…" }
];

/* ------------------------- état de départ ------------------------- */
function frere(p, n, po, asp, pere) {
  return { id: uid(), p: p, n: n || "", po: po || "", asp: !!asp, pere: !!pere };
}
/* L'application est publiée sur une adresse publique : elle ne contient
   AUCUN nom de frère. Le conseil charge son effectif une fois, depuis le
   fichier d'amorçage, par « Restaurer une sauvegarde » dans les réglages. */
function etatNeuf() {
  return {
    v: 1,
    conseil: {
      nom: "Conseil",
      secteur: "",
      ville: "",
      lieu: "",
      secretaire: "",
      annee: anneeFraternelle()
    },
    effectif: [],
    trinomes: [],
    topos: [],
    services: [],
    evenements: [],
    retenir: [],
    seance: null,
    archives: []
  };
}
function anneeFraternelle() {
  const d = new Date(), a = d.getFullYear();
  return d.getMonth() >= 6 ? a + "-" + (a + 1) : (a - 1) + "-" + a;
}

/* --------------------------- persistance --------------------------- */
let S = null;
let vueCourante = "seance", secCourante = 1, mode = "note";
let svOuvert = null, frOuvert = null, filtreSv = "actifs";
let sauveTimer = null;

function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) {
      const o = JSON.parse(brut);
      if (o && o.v === 1 && Array.isArray(o.effectif)) return o;
    }
  } catch (e) { /* stockage indisponible : on repart d'un état neuf */ }
  return etatNeuf();
}
function sauver() {
  clearTimeout(sauveTimer);
  sauveTimer = setTimeout(() => {
    try { localStorage.setItem(CLE, JSON.stringify(S)); }
    catch (e) { toast("Sauvegarde impossible sur cet appareil."); }
  }, 200);
}
function maj() { sauver(); rendre(); }

/* ----------------------------- helpers ----------------------------- */
const parId = id => S.effectif.find(f => f.id === id) || null;
function nomc(f) { return f ? ((f.pere ? "Père " : "") + f.p + (f.n ? " " + f.n : "")).trim() : ""; }
const nomDeId = id => nomc(parId(id));
function hhmm(ms) { const d = new Date(ms); return String(d.getHours()).padStart(2,"0") + " h " + String(d.getMinutes()).padStart(2,"0"); }
function mmss(ms) { const s = Math.max(0, Math.floor(ms/1000));
  return String(Math.floor(s/60)).padStart(2,"0") + ":" + String(s%60).padStart(2,"0"); }
function dateLongue(ms) { const d = new Date(ms);
  return JOURS[d.getDay()] + " " + d.getDate() + " " + MOIS[d.getMonth()] + " " + d.getFullYear(); }
function toast(txt) {
  const t = $("#toast"); t.textContent = txt; t.hidden = false;
  clearTimeout(toast._h); toast._h = setTimeout(() => { t.hidden = true; }, 2600);
}
const SE = () => S.seance;
const SEC = () => SECTIONS[secCourante - 1];
const duSec = k => SE() ? SE().notes.filter(n => n.sec === k) : [];
function presents() { const s = SE(); if (!s) return 0;
  return S.effectif.filter(f => s.presence[f.id] === "P").length; }
function etatPres(f) { const s = SE(); return (s && s.presence[f.id]) || "A"; }

function jourCourt(d) {
  const m = /^(\d{1,2})[\/\-.](\d{1,2})/.exec(d || "");
  return m ? m[1].padStart(2,"0") + "/" + m[2].padStart(2,"0") : (d || "");
}
function clefDate(d) {
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(d || "");
  if (!m) return "9999";
  const an = m[3].length === 2 ? "20" + m[3] : m[3];
  return an + m[2].padStart(2,"0") + m[1].padStart(2,"0");
}
function dateLisible(d) {
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(d || "");
  if (!m) return d || "";
  const an = m[3].length === 2 ? "20" + m[3] : m[3];
  return parseInt(m[1],10) + " " + MOIS[parseInt(m[2],10) - 1] + " " + an;
}
function prochainesDates() {
  const s = SE(); const out = [];
  S.services.filter(x => x.st === "v" && /\d/.test(x.date))
    .forEach(x => out.push({ j: jourCourt(x.date), q: x.pj, src: "service", k: clefDate(x.date) }));
  S.evenements.forEach(e => out.push({ j: jourCourt(e.date), q: e.q, src: "", k: clefDate(e.date), id: e.id }));
  if (s && /\d/.test(s.prochain.date))
    out.push({ j: jourCourt(s.prochain.date), q: "Conseil du mois", src: "conseil", k: clefDate(s.prochain.date) });
  return out.sort((a, b) => a.k.localeCompare(b.k));
}
function topoDuProchain() {
  const s = SE(); if (!s) return "";
  if (s.prochain.topo) return s.prochain.topo;
  const m = /^\d{1,2}[\/\-.](\d{1,2})/.exec(s.prochain.date || "");
  if (!m) return "";
  const mois = MOIS[parseInt(m[1],10) - 1];
  const t = S.topos.find(x => (x[0] || "").toLowerCase() === mois);
  return t ? (t[1] || "").trim() : "";
}

/* ------------------------- cycle de séance ------------------------- */
function debuterSeance(avecAudio) {
  const pres = {};
  S.effectif.forEach(f => { pres[f.id] = "A"; });
  S.seance = {
    id: uid(), debut: Date.now(), fin: null, dicta: !!avecAudio,
    padre: { titre: "", audio: true },
    comptes: "",
    presentation: { qui: "", sujet: "", audio: true },
    prochain: { date: "", heure: "20h30", lieu: S.conseil.lieu, topo: "" },
    presence: pres,
    notes: []
  };
  secCourante = 1;
  maj();
}
function cloreSeance() {
  SE().fin = Date.now();
  SE().dicta = false;
  vueCourante = "cr";
  maj();
  toast("Séance close. Le compte rendu est prêt.");
}
function archiverSeance() {
  const s = SE();
  S.archives.unshift({
    id: s.id, debut: s.debut, fin: s.fin,
    conseil: JSON.parse(JSON.stringify(S.conseil)),
    effectif: JSON.parse(JSON.stringify(S.effectif)),
    trinomes: JSON.parse(JSON.stringify(S.trinomes)),
    topos: JSON.parse(JSON.stringify(S.topos)),
    services: JSON.parse(JSON.stringify(S.services)),
    evenements: JSON.parse(JSON.stringify(S.evenements)),
    retenir: JSON.parse(JSON.stringify(S.retenir)),
    seance: JSON.parse(JSON.stringify(s))
  });
  if (S.archives.length > 24) S.archives.length = 24;
  S.seance = null;
  vueCourante = "seance";
  maj();
  toast("Séance archivée.");
}
function ajouterNote(sec, type, txt) {
  const s = SE(); if (!s) return;
  s.notes.push({ id: uid(), sec: sec, type: type, txt: txt,
    t: Date.now() - s.debut, qui: "", quand: "" });
}

/* --------------------------- petits champs -------------------------- */
function champ(parent, lib, val, set, ph, multi) {
  const c = el("label", "ch");
  c.appendChild(el("span", null, lib));
  const i = multi ? el("textarea") : el("input");
  if (!multi) i.type = "text";
  i.value = val || "";
  if (ph) i.placeholder = ph;
  i.addEventListener("input", () => { set(i.value); sauver(); });
  c.appendChild(i);
  parent.appendChild(c);
  return i;
}
function selFrere(valId, onchange, cls) {
  const sel = el("select", cls || null);
  const vide = el("option", null, "— personne —"); vide.value = ""; sel.appendChild(vide);
  S.effectif.forEach(f => {
    const o = el("option", null, nomc(f)); o.value = f.id;
    if (f.id === valId) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener("change", () => { onchange(sel.value); });
  return sel;
}

/* =============================== VUES =============================== */

function outilEffectif(v) {
  const o = el("div", "outil");
  const th = el("div", "th");
  th.appendChild(el("h3", null, "Qui est là ce soir"));
  th.appendChild(el("span", "cpt", presents() + " / " + S.effectif.length));
  o.appendChild(th);

  const r = el("div", "raccourcis");
  [["Tous présents","P"],["Tous absents","A"]].forEach(([lib, code]) => {
    const b = el("button", null, lib); b.type = "button";
    b.addEventListener("click", () => { S.effectif.forEach(f => { SE().presence[f.id] = code; }); maj(); });
    r.appendChild(b);
  });
  o.appendChild(r);

  const tb = el("div", "tb plat");
  let der = null;
  S.effectif.forEach(f => {
    const g = f.asp ? "Aspirants" : "Chevaliers";
    if (g !== der) {
      tb.appendChild(el("div", "grptitre", g + " · " + S.effectif.filter(x => x.asp === f.asp).length));
      der = g;
    }
    const e = etatPres(f);
    const li = el("button", "li" + (e === "A" ? " abs" : "")); li.type = "button";
    const w = el("div", "who");
    w.appendChild(el("div", "nm", nomc(f)));
    if (f.po) w.appendChild(el("div", "po", f.po));
    li.appendChild(w);
    li.appendChild(el("span", "st " + e, { P:"Présent", E:"Excusé", A:"Absent" }[e]));
    li.addEventListener("click", () => { SE().presence[f.id] = { A:"P", P:"E", E:"A" }[e]; maj(); });
    tb.appendChild(li);
  });
  o.appendChild(tb);
  v.appendChild(o);
}

function outilTopo(v) {
  const o = el("div", "outil");
  const th = el("div", "th"); th.appendChild(el("h3", null, "Enseignement du Padre")); o.appendChild(th);
  const tb = el("div", "tb");
  champ(tb, "Sujet du topo", SE().padre.titre, x => { SE().padre.titre = x; }, "Dieu qui nous parle");
  const c = el("div", "chipline");
  const b = el("button", "chip" + (SE().padre.audio ? " on" : ""), "Renvoi au topo audio"); b.type = "button";
  b.addEventListener("click", () => { SE().padre.audio = !SE().padre.audio; maj(); });
  c.appendChild(b); tb.appendChild(c);
  o.appendChild(tb); v.appendChild(o);
}

function outilComptes(v) {
  const o = el("div", "outil");
  const th = el("div", "th"); th.appendChild(el("h3", null, "Trésorerie")); o.appendChild(th);
  const tb = el("div", "tb");
  champ(tb, "Solde du conseil", SE().comptes, x => { SE().comptes = x; }, "256,80 €");
  o.appendChild(tb); v.appendChild(o);
}

/* Le rangement se fait en entrant dans la section : une ligne ne doit pas
   sauter sous le doigt au moment où l'on change son statut. */
function trierServices() {
  const ordre = { v:0, c:1, t:2 };
  S.services.sort((a, b) => ordre[a.st] - ordre[b.st] || clefDate(b.date).localeCompare(clefDate(a.date)));
}

function outilServices(v) {
  const o = el("div", "outil");
  const th = el("div", "th");
  th.appendChild(el("h3", null, "Services de l'année"));
  th.appendChild(el("span", "cpt", S.services.filter(x => x.st !== "t").length + " à traiter"));
  o.appendChild(th);

  const fl = el("div", "filtres");
  [["actifs","À traiter"],["v","À venir"],["c","En cours"],["t","Terminés"]].forEach(([k, lib]) => {
    const n = k === "actifs" ? S.services.filter(x => x.st !== "t").length : S.services.filter(x => x.st === k).length;
    const b = el("button", null, lib + " " + n); b.type = "button";
    b.setAttribute("aria-pressed", String(filtreSv === k));
    b.addEventListener("click", () => { filtreSv = k; trierServices(); sauver(); rendre(); });
    fl.appendChild(b);
  });
  o.appendChild(fl);

  const liste = S.services.filter(x => filtreSv === "actifs" ? x.st !== "t" : x.st === filtreSv);

  const tb = el("div", "tb plat");
  liste.forEach(sv => {
    const w = el("div", "sv"); w.dataset.open = String(svOuvert === sv.id);
    const hd = el("div", "hd");
    const bg = el("button", "badge " + sv.st, ST[sv.st]); bg.type = "button";
    bg.setAttribute("aria-label", "Changer le statut de " + sv.pj);
    bg.addEventListener("click", e => { e.stopPropagation(); sv.st = { v:"c", c:"t", t:"v" }[sv.st]; maj(); });
    hd.appendChild(bg);
    const co = el("button"); co.type = "button"; co.style.cssText = "flex:1;min-width:0;";
    co.appendChild(el("div", "pj", sv.pj || "Nouveau service"));
    const sub = [sv.resp, sv.date].filter(Boolean).join(" · ");
    co.appendChild(el("div", "sub", sub || "responsable et date à préciser"));
    co.addEventListener("click", () => { svOuvert = (svOuvert === sv.id ? null : sv.id); rendre(); });
    hd.appendChild(co);
    w.appendChild(hd);

    const ed = el("div", "ed");
    champ(ed, "Projet", sv.pj, x => { sv.pj = x; });
    champ(ed, "Responsable", sv.resp, x => { sv.resp = x; }, "un ou plusieurs frères");
    champ(ed, "Date", sv.date, x => { sv.date = x; }, "13/06/2026 ou « chaque samedi »");
    champ(ed, "Précision", sv.pr, x => { sv.pr = x; }, "", true);
    if (sv.st === "v" && /\d/.test(sv.date))
      ed.appendChild(el("div", "derive", "Cette date remonte d'elle-même dans « Prochaines dates »."));
    const sup = el("button", "addl danger", "Retirer ce service"); sup.type = "button";
    sup.addEventListener("click", () => {
      if (!confirm("Retirer « " + (sv.pj || "ce service") + " » ?")) return;
      S.services = S.services.filter(x => x.id !== sv.id); svOuvert = null; maj();
    });
    ed.appendChild(sup);
    w.appendChild(ed);
    tb.appendChild(w);
  });
  if (!liste.length) tb.appendChild(el("div", "vide-fil", "Aucun service dans ce filtre."));
  o.appendChild(tb);

  const a = el("button", "addl", "＋ un service"); a.type = "button";
  a.style.cssText = "border:0;border-top:1px solid var(--rule-soft);border-radius:0;";
  a.addEventListener("click", () => {
    const s2 = { id: uid(), st:"v", pj:"", resp:"", date:"", pr:"" };
    S.services.unshift(s2); svOuvert = s2.id; filtreSv = "actifs"; maj();
  });
  o.appendChild(a);
  v.appendChild(o);
}

function outilDates(v) {
  const o = el("div", "outil");
  const th = el("div", "th");
  th.appendChild(el("h3", null, "Prochaines dates"));
  const pd = prochainesDates();
  th.appendChild(el("span", "cpt", String(pd.length)));
  o.appendChild(th);

  const tb = el("div", "tb plat");
  pd.forEach(d => {
    const l = el("div", "dt");
    l.appendChild(el("span", "j", d.j));
    l.appendChild(el("span", "q", d.q));
    if (d.src) l.appendChild(el("span", "src", d.src));
    else {
      const b = el("button", "mini", "×"); b.type = "button"; b.style.height = "32px";
      b.setAttribute("aria-label", "Retirer " + d.q);
      b.addEventListener("click", () => { S.evenements = S.evenements.filter(x => x.id !== d.id); maj(); });
      l.appendChild(b);
    }
    tb.appendChild(l);
  });
  if (!pd.length) tb.appendChild(el("div", "vide-fil", "Aucune date à venir."));
  o.appendChild(tb);

  const f = el("div", "tb");
  f.appendChild(el("div", "derive", "Les lignes marquées « service » ou « conseil » viennent d'ailleurs et se corrigent à leur source. N'ajoutez ici que ce qui n'est pas un service."));
  const r = el("div", "ligne");
  const i1 = el("input"); i1.type = "text"; i1.placeholder = "jj/mm/aaaa"; i1.inputMode = "numeric";
  i1.style.cssText = "flex:0 0 120px;";
  const i2 = el("input"); i2.type = "text"; i2.placeholder = "Quel événement ?";
  r.appendChild(i1); r.appendChild(i2); f.appendChild(r);
  const b = el("button", "addl", "＋ un événement"); b.type = "button";
  b.addEventListener("click", () => {
    if (!i2.value.trim()) { toast("Il manque le nom de l'événement."); return; }
    S.evenements.push({ id: uid(), q: i2.value.trim(), date: i1.value.trim() });
    maj();
  });
  f.appendChild(b);
  o.appendChild(f);
  v.appendChild(o);
}

function outilSpirituel(v) {
  const o = el("div", "outil");
  const th = el("div", "th");
  th.appendChild(el("h3", null, "Trinômes de fraternité"));
  th.appendChild(el("span", "cpt", S.trinomes.length + " trinômes"));
  o.appendChild(th);

  const tb = el("div", "tb plat");
  S.trinomes.forEach((t, i) => {
    const l = el("div", "tri-l");
    l.appendChild(el("span", "tri-n", String(i + 1)));
    const box = el("div", "tri-s");
    [0,1,2].forEach(j => box.appendChild(selFrere(t[j] || "", x => { S.trinomes[i][j] = x; maj(); })));
    l.appendChild(box);
    const b = el("button", "mini", "×"); b.type = "button";
    b.setAttribute("aria-label", "Retirer le trinôme " + (i + 1));
    b.addEventListener("click", () => { S.trinomes.splice(i, 1); maj(); });
    l.appendChild(b);
    tb.appendChild(l);
  });
  o.appendChild(tb);

  const f = el("div", "tb");
  const a = el("button", "addl", "＋ un trinôme"); a.type = "button";
  a.addEventListener("click", () => { S.trinomes.push(["","",""]); maj(); });
  f.appendChild(a);

  const places = S.trinomes.flat().filter(Boolean);
  const doublons = [...new Set(places.filter((x, i) => places.indexOf(x) !== i))].map(nomDeId).filter(Boolean);
  const absents = S.effectif.filter(x => !places.includes(x.id)).map(nomc);
  if (doublons.length || absents.length) {
    const al = el("div", "alerte");
    al.appendChild(el("b", null, "À vérifier"));
    if (doublons.length) al.appendChild(el("div", null, "Dans deux trinômes : " + doublons.join(", ") + "."));
    if (absents.length) al.appendChild(el("div", null, "Dans aucun trinôme : " + absents.join(", ") + "."));
    f.appendChild(al);
  }
  f.appendChild(el("div", "derive", "Donnée d'année : elle se reporte seule dans chaque compte rendu, et ne se retape pas d'un mois sur l'autre."));
  o.appendChild(f);
  v.appendChild(o);
}

function outilPresentation(v) {
  const o = el("div", "outil");
  const th = el("div", "th"); th.appendChild(el("h3", null, "Le frère qui s'est présenté")); o.appendChild(th);
  const tb = el("div", "tb");
  const c = el("label", "ch");
  c.appendChild(el("span", null, "Qui"));
  c.appendChild(selFrere(SE().presentation.qui, x => { SE().presentation.qui = x; maj(); }));
  tb.appendChild(c);
  champ(tb, "Sujet", SE().presentation.sujet, x => { SE().presentation.sujet = x; });
  const cl = el("div", "chipline");
  const b = el("button", "chip" + (SE().presentation.audio ? " on" : ""), "Renvoi au topo audio"); b.type = "button";
  b.addEventListener("click", () => { SE().presentation.audio = !SE().presentation.audio; maj(); });
  cl.appendChild(b); tb.appendChild(cl);
  o.appendChild(tb); v.appendChild(o);
}

function outilTopos(v) {
  const o = el("div", "outil");
  const th = el("div", "th"); th.appendChild(el("h3", null, "Calendrier des topos")); o.appendChild(th);
  const tb = el("div", "tb plat");
  S.topos.forEach((t, i) => {
    const l = el("div", "dt");
    l.appendChild(el("span", "j", t[0]));
    const inp = el("input"); inp.type = "text"; inp.value = t[1] || "";
    inp.style.cssText = "flex:1;min-width:0;border:1px solid var(--rule);border-radius:7px;padding:8px 10px;background:#fbfcfd;min-height:40px;";
    inp.addEventListener("input", () => { S.topos[i][1] = inp.value; sauver(); });
    l.appendChild(inp);
    const b = el("button", "mini", "×"); b.type = "button";
    b.addEventListener("click", () => { S.topos.splice(i, 1); maj(); });
    l.appendChild(b);
    tb.appendChild(l);
  });
  o.appendChild(tb);
  const f = el("div", "tb");
  const r = el("div", "ligne");
  const im = el("input"); im.type = "text"; im.placeholder = "Mois"; im.style.cssText = "flex:0 0 120px;";
  const iq = el("input"); iq.type = "text"; iq.placeholder = "Quel frère ?";
  r.appendChild(im); r.appendChild(iq); f.appendChild(r);
  const a = el("button", "addl", "＋ un topo"); a.type = "button";
  a.addEventListener("click", () => {
    if (!im.value.trim()) { toast("Il manque le mois."); return; }
    S.topos.push([im.value.trim(), iq.value.trim()]); maj();
  });
  f.appendChild(a);
  f.appendChild(el("div", "derive", "Le topo du prochain conseil se lit ici, d'après le mois de sa date."));
  o.appendChild(f);
  v.appendChild(o);
}

function outilRetenir(v) {
  const o = el("div", "outil");
  const th = el("div", "th");
  th.appendChild(el("h3", null, "À retenir toute l'année"));
  th.appendChild(el("span", "cpt", S.retenir.length + " / 3"));
  o.appendChild(th);
  const tb = el("div", "tb");
  S.retenir.forEach((r, i) => {
    const l = el("div", "ligne");
    const inp = el("input"); inp.type = "text"; inp.value = r;
    inp.addEventListener("input", () => { S.retenir[i] = inp.value; sauver(); });
    l.appendChild(inp);
    const b = el("button", "mini", "×"); b.type = "button";
    b.addEventListener("click", () => { S.retenir.splice(i, 1); maj(); });
    l.appendChild(b);
    tb.appendChild(l);
  });
  if (S.retenir.length < 3) {
    const a = el("button", "addl", "＋ une ligne"); a.type = "button";
    a.addEventListener("click", () => { S.retenir.push(""); maj(); });
    tb.appendChild(a);
  }
  tb.appendChild(el("div", "derive", "Ce qui revient toute l'année, jamais ce qui a une date : une date vit dans les prochaines dates, et nulle part ailleurs."));
  o.appendChild(tb); v.appendChild(o);
}

function outilProchain(v) {
  const o = el("div", "outil");
  const th = el("div", "th"); th.appendChild(el("h3", null, "Prochain conseil")); o.appendChild(th);
  const tb = el("div", "tb");
  const i = champ(tb, "Date", SE().prochain.date, x => { SE().prochain.date = x; }, "jj/mm/aaaa");
  i.inputMode = "numeric";
  i.addEventListener("blur", () => rendre());
  champ(tb, "Heure", SE().prochain.heure, x => { SE().prochain.heure = x; }, "20h30");
  champ(tb, "Lieu", SE().prochain.lieu, x => { SE().prochain.lieu = x; });
  const ct = el("label", "ch");
  ct.appendChild(el("span", null, "Topo du mois"));
  const cur = topoDuProchain();
  const sel = el("select");
  const vide = el("option", null, "— à désigner —"); vide.value = ""; sel.appendChild(vide);
  const noms = S.effectif.map(nomc);
  if (cur && !noms.includes(cur)) noms.unshift(cur);
  noms.forEach(n => { const op = el("option", null, n); op.value = n; if (n === cur) op.selected = true; sel.appendChild(op); });
  sel.addEventListener("change", () => { SE().prochain.topo = sel.value; maj(); });
  ct.appendChild(sel); tb.appendChild(ct);
  if (!SE().prochain.topo && cur)
    tb.appendChild(el("div", "derive", "Repris du calendrier des topos. Changez-le ici si le tour a été échangé."));
  o.appendChild(tb); v.appendChild(o);

  const b = el("button", "gros fin", "Clore la séance"); b.type = "button";
  b.addEventListener("click", () => {
    if (!confirm("Clore la séance ? Le compte rendu devient consultable et modifiable.")) return;
    cloreSeance();
  });
  v.appendChild(b);
}

const OUTILS = { effectif:outilEffectif, topo:outilTopo, comptes:outilComptes, services:outilServices,
  dates:outilDates, spirituel:outilSpirituel, presentation:outilPresentation, topos:outilTopos,
  retenir:outilRetenir, prochain:outilProchain, note:function(){} };

/* --------------------------- vue Séance --------------------------- */
function vueSeance(v) {
  if (!SE()) {
    const d = el("div", "start");
    d.appendChild(el("h2", null, S.conseil.nom));
    d.appendChild(el("p", null, dateLongue(Date.now())));
    const a = el("div", "aide");
    a.appendChild(el("b", null, "Avant d'appuyer"));
    a.appendChild(document.createTextNode("Lancez l'enregistreur du téléphone : les deux démarrent au même instant, et chaque note portera sa position dans l'enregistrement."));
    d.appendChild(a);
    if (!S.effectif.length) {
      const p = el("div", "alerte");
      p.appendChild(el("b", null, "Premier démarrage"));
      p.appendChild(document.createTextNode("Le carnet est vide : chargez le fichier d'amorçage du conseil par « Restaurer une sauvegarde » dans les réglages, ou ajoutez les frères un à un dans l'onglet Frères."));
      d.appendChild(p);
      const r = el("button", "gros", "Ouvrir les réglages"); r.type = "button";
      r.addEventListener("click", ouvrirReglages);
      d.appendChild(r);
    }
    const b = el("button", "gros" + (S.effectif.length ? "" : " sec"), "Débuter la séance"); b.type = "button";
    b.addEventListener("click", () => debuterSeance(true));
    d.appendChild(b);
    const s = el("button", "gros sec", "Débuter sans enregistrement"); s.type = "button";
    s.addEventListener("click", () => debuterSeance(false));
    d.appendChild(s);
    if (S.archives.length) {
      const arc = el("button", "gros sec", S.archives.length + " séance" + (S.archives.length > 1 ? "s" : "") + " en archive");
      arc.type = "button";
      arc.addEventListener("click", ouvrirReglages);
      d.appendChild(arc);
    }
    v.appendChild(d);
    return;
  }

  if (SE().fin) {
    const d = el("div", "start");
    d.appendChild(el("h2", null, "Séance close"));
    d.appendChild(el("p", null, dateLongue(SE().debut) + ", de " + hhmm(SE().debut) + " à " + hhmm(SE().fin) + "."));
    const b = el("button", "gros", "Voir le compte rendu"); b.type = "button";
    b.addEventListener("click", () => { vueCourante = "cr"; rendre(); });
    d.appendChild(b);
    const r = el("button", "gros sec", "Rouvrir la séance"); r.type = "button";
    r.addEventListener("click", () => { SE().fin = null; maj(); });
    d.appendChild(r);
    const a = el("button", "gros sec", "Archiver et repartir à zéro"); a.type = "button";
    a.addEventListener("click", () => {
      if (!confirm("Archiver cette séance ? Le compte rendu restera consultable dans les réglages.")) return;
      archiverSeance();
    });
    d.appendChild(a);
    v.appendChild(d);
    return;
  }

  OUTILS[SEC().k](v);

  const mes = duSec(secCourante);
  if (mes.length) {
    v.appendChild(el("div", "filtitre", "Noté sur cette section"));
    mes.forEach(n => v.appendChild(carte(n)));
  } else if (SEC().k === "note") {
    v.appendChild(el("div", "vide-fil", "Rien de noté ici."));
  }
}

function carte(n) {
  const c = el("div", "n8");
  const tx = el("div", "tx", n.txt);
  tx.contentEditable = "true";
  tx.addEventListener("blur", () => { n.txt = tx.textContent.trim(); sauver(); });
  c.appendChild(tx);

  if (n.type === "action") {
    const l = el("div", "chipline");
    l.appendChild(selFrere(n.qui, x => { n.qui = x; maj(); }, "chip sel"));
    ["Avant le prochain conseil","Sous 8 jours","Ce mois-ci"].forEach(q => {
      const b = el("button", "chip" + (n.quand === q ? " att" : ""), q); b.type = "button";
      b.addEventListener("click", () => { n.quand = (n.quand === q ? "" : q); maj(); });
      l.appendChild(b);
    });
    c.appendChild(l);
  }

  const pied = el("div", "pied");
  if (n.type === "action") pied.appendChild(el("span", "tag ac", "Action"));
  pied.appendChild(el("span", "h", mmss(n.t)));
  const sup = el("button", "sup", "×"); sup.type = "button"; sup.setAttribute("aria-label", "Supprimer la note");
  sup.addEventListener("click", () => { SE().notes = SE().notes.filter(x => x.id !== n.id); maj(); });
  pied.appendChild(sup);
  c.appendChild(pied);
  return c;
}

/* --------------------------- vue Frères --------------------------- */
function vueFreres(v) {
  const o = el("div", "outil");
  const th = el("div", "th");
  th.appendChild(el("h3", null, "Effectif du conseil"));
  th.appendChild(el("span", "cpt", S.effectif.filter(f => !f.asp).length + " chevaliers · "
    + S.effectif.filter(f => f.asp).length + " aspirants"));
  o.appendChild(th);

  const tb = el("div", "tb plat");
  let der = null;
  S.effectif.forEach((f, i) => {
    const g = f.asp ? "Aspirants" : "Chevaliers";
    if (g !== der) { tb.appendChild(el("div", "grptitre", g)); der = g; }
    const w = el("div", "sv"); w.dataset.open = String(frOuvert === f.id);
    const hd = el("div", "hd");
    const co = el("button"); co.type = "button"; co.style.cssText = "flex:1;min-width:0;";
    co.appendChild(el("div", "pj", nomc(f)));
    co.appendChild(el("div", "sub", f.po || "modifier le nom, le poste"));
    co.addEventListener("click", () => { frOuvert = (frOuvert === f.id ? null : f.id); rendre(); });
    hd.appendChild(co);
    hd.appendChild(el("span", "badge " + (f.asp ? "v" : "t"), f.asp ? "Aspirant" : "Chevalier"));
    w.appendChild(hd);

    const ed = el("div", "ed");
    champ(ed, "Prénom", f.p, x => { f.p = x; });
    champ(ed, "Nom", f.n, x => { f.n = x; }, "laisser vide si le conseil n'en note pas");
    const cp = el("label", "ch");
    cp.appendChild(el("span", null, "Poste"));
    const sp = el("select");
    POSTES.forEach(x => { const op = el("option", null, x || "— aucun —"); op.value = x; if (x === (f.po || "")) op.selected = true; sp.appendChild(op); });
    sp.addEventListener("change", () => { f.po = sp.value; maj(); });
    cp.appendChild(sp); ed.appendChild(cp);
    const cpe = el("div", "chipline");
    const bp = el("button", "chip" + (f.pere ? " on" : ""), "Prêtre (« Père »)"); bp.type = "button";
    bp.addEventListener("click", () => { f.pere = !f.pere; maj(); });
    cpe.appendChild(bp); ed.appendChild(cpe);
    const bt = el("button", "addl", f.asp ? "Le recevoir chevalier" : "Le repasser aspirant"); bt.type = "button";
    bt.addEventListener("click", () => { f.asp = !f.asp; frOuvert = null; maj(); });
    ed.appendChild(bt);
    const sup = el("button", "addl danger", "Retirer du conseil"); sup.type = "button";
    sup.addEventListener("click", () => {
      if (!confirm("Retirer " + nomc(f) + " du conseil ?")) return;
      S.effectif.splice(i, 1);
      S.trinomes = S.trinomes.map(t => t.map(x => x === f.id ? "" : x));
      frOuvert = null; maj();
    });
    ed.appendChild(sup);
    w.appendChild(ed);
    tb.appendChild(w);
  });
  o.appendChild(tb);

  const f2 = el("div", "tb");
  f2.appendChild(el("div", "derive", "Un frère s'ajoute ici une fois pour toutes : il apparaît ensuite dans l'appel de chaque séance et dans les listes de responsables."));
  const r = el("div", "ligne");
  const ip = el("input"); ip.type = "text"; ip.placeholder = "Prénom";
  const inn = el("input"); inn.type = "text"; inn.placeholder = "Nom";
  r.appendChild(ip); r.appendChild(inn); f2.appendChild(r);
  const cs = el("label", "ch");
  cs.appendChild(el("span", null, "Poste"));
  const sel = el("select");
  POSTES.forEach(x => { const op = el("option", null, x || "— aucun —"); op.value = x; sel.appendChild(op); });
  cs.appendChild(sel); f2.appendChild(cs);
  const rr = el("div", "ligne");
  ["Chevalier","Aspirant"].forEach(lib => {
    const b = el("button", "addl", "＋ " + lib); b.type = "button";
    b.addEventListener("click", () => {
      if (!ip.value.trim()) { toast("Il manque le prénom."); return; }
      const nf = frere(ip.value.trim(), inn.value.trim(), sel.value, lib === "Aspirant");
      S.effectif.push(nf);
      if (SE()) SE().presence[nf.id] = "A";
      maj();
    });
    rr.appendChild(b);
  });
  f2.appendChild(rr);
  o.appendChild(f2);
  v.appendChild(o);
}

/* ====================== le document, en HTML ====================== */
function esc(x) {
  return String(x == null ? "" : x)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const CROIX = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 2h5v7.5H22v5h-7.5V22h-5v-7.5H2v-5h7.5z" fill="currentColor"/></svg>';

function documentHTML(src) {
  const C = src.conseil, s = src.seance, eff = src.effectif;
  const nomDe = id => { const f = eff.find(x => x.id === id); return f ? ((f.pere ? "Père " : "") + f.p + (f.n ? " " + f.n : "")).trim() : ""; };
  const d = new Date(s.debut);
  const pres = eff.filter(f => s.presence[f.id] === "P");
  const exc = eff.filter(f => s.presence[f.id] === "E");
  const ch = eff.filter(f => !f.asp).length, asp = eff.filter(f => f.asp).length;
  const notesDe = k => s.notes.filter(n => n.sec === k && n.txt.trim() && n.type !== "action");
  const actions = s.notes.filter(n => n.type === "action" && n.txt.trim());

  /* prochaines dates, dérivées */
  const dates = [];
  src.services.filter(x => x.st === "v" && /\d/.test(x.date))
    .forEach(x => dates.push({ j: jourCourt(x.date), q: x.pj, k: clefDate(x.date) }));
  src.evenements.forEach(e => dates.push({ j: jourCourt(e.date), q: e.q, k: clefDate(e.date) }));
  dates.sort((a, b) => a.k.localeCompare(b.k));
  const moitie = Math.ceil(dates.length / 2);
  const colDates = c => c.map(x => "<dt>" + esc(x.j) + "</dt><dd>" + esc(x.q) + "</dd>").join("");

  /* topo du prochain conseil */
  let topo = s.prochain.topo;
  if (!topo) {
    const m = /^\d{1,2}[\/\-.](\d{1,2})/.exec(s.prochain.date || "");
    if (m) { const t = src.topos.find(x => (x[0] || "").toLowerCase() === MOIS[parseInt(m[1],10) - 1]); topo = t ? t[1] : ""; }
  }

  const ordre = { v:0, c:1, t:2 };
  const svcs = src.services.slice().sort((a, b) => ordre[a.st] - ordre[b.st] || clefDate(b.date).localeCompare(clefDate(a.date)));

  let n = 0;
  const sec = (titre, corps) => corps.trim()
    ? '<section><h3 class="sec"><span class="n">' + ROM[n++] + "</span>" + esc(titre) + "</h3>" + corps + "</section>"
    : "";

  const H = [];
  H.push('<div class="cr">');
  H.push('<img class="filigrane" alt="" aria-hidden="true" src="assets/saint-mommolin.jpg">');
  H.push('<div class="contenu">');

  /* ---------- page d'honneur ---------- */
  H.push('<div class="premiere">');
  H.push('<i class="coin2 tg"></i><i class="coin2 td"></i><i class="coin2 bg"></i><i class="coin2 bd"></i>');
  H.push('<img class="blason" alt="Emblème des Chevaliers de Colomb" src="assets/emblem.png">');
  H.push("<h1>Chevaliers de Colomb</h1>");
  H.push('<p class="ordre">Ordre des Chevaliers de Colomb</p>');
  H.push('<div class="filet"><i></i>' + CROIX + "<i></i></div>");
  H.push('<p class="conseil">' + esc(C.nom) + "</p>");
  H.push('<p class="ville">' + esc(C.ville) + "</p>");
  H.push('<p class="adresse">Aux Frères Chevaliers du Conseil</p>');
  H.push('<h2 class="titre">Compte rendu de la réunion du conseil</h2>');
  H.push('<p class="millesime">' + esc(dateLongue(s.debut).replace(/^\w/, c => c.toUpperCase()))
    + " &mdash; Année fraternelle " + esc(C.annee) + "</p>");
  H.push('<div class="filet"><i></i>' + CROIX + "<i></i></div>");
  H.push('<p class="chapeau">Chers Frères, voici le relevé de notre réunion du '
    + esc(d.getDate() + " " + MOIS[d.getMonth()]) + ", l’état des services de l’année et les dates à retenir d’ici notre prochaine rencontre.</p>");

  if (s.prochain.date || topo) {
    H.push('<div class="encadre conclave-seul"><h3>Prochain conseil</h3><div class="conclave">');
    H.push('<span class="quand">' + esc(dateLisible(s.prochain.date) || "date à fixer")
      + (s.prochain.heure ? ", " + esc(s.prochain.heure) : "") + "</span>");
    if (s.prochain.lieu) H.push('<span class="ou">' + esc(s.prochain.lieu) + "</span>");
    if (topo) H.push('<span class="topo">Topo du mois : <b>' + esc(topo) + "</b></span>");
    H.push("</div></div>");
  }

  if (dates.length) {
    H.push('<div class="encadre"><h3>Prochaines dates</h3><div class="deux-col">');
    H.push('<dl class="cal">' + colDates(dates.slice(0, moitie)) + "</dl>");
    H.push('<div class="sep"></div>');
    H.push('<dl class="cal">' + colDates(dates.slice(moitie)) + "</dl>");
    H.push("</div></div>");
  }

  if (actions.length) {
    H.push('<div class="encadre actions"><h3>Qui fait quoi, pour quand</h3>');
    H.push('<p class="amorce">Cherchez votre nom : chaque ligne engage quelqu’un du conseil.</p>');
    actions.forEach(a => {
      H.push('<div class="act"><span class="qui">' + esc(nomDe(a.qui) || "À préciser") + "</span>"
        + '<span class="qd">' + esc(a.quand || "") + "</span>"
        + '<span class="quoi">' + esc(a.txt) + "</span></div>");
    });
    H.push("</div>");
  }
  H.push("</div>"); /* fin page d'honneur */

  /* ---------- le registre ---------- */
  let corps = "<p>Le conseil compte <b>" + ch + " chevalier" + (ch > 1 ? "s" : "")
    + "</b> et <b>" + asp + " aspirant" + (asp > 1 ? "s" : "") + "</b>.</p>";
  if (pres.length) corps += "<p><b>Présents :</b> " + pres.map(f => esc(nomc(f))).join(", ") + ".</p>";
  if (exc.length) corps += "<p><b>Excusé" + (exc.length > 1 ? "s" : "") + " :</b> " + exc.map(f => esc(nomc(f))).join(", ") + ".</p>";
  notesDe(1).forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Effectif", corps));

  corps = "";
  if (s.padre.titre.trim()) {
    corps += "<p>« " + esc(s.padre.titre.trim()) + " ».</p>";
    if (s.padre.audio) corps += '<p class="disc">Le topo est joint au présent envoi sous forme d’enregistrement audio.</p>';
  }
  notesDe(2).forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Enseignement du Padre", corps));

  corps = "";
  if (s.comptes.trim()) corps += "<p>Le solde du conseil s’établit à <b>" + esc(s.comptes.trim()) + "</b>.</p>";
  notesDe(3).forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Comptes", corps));

  corps = "";
  if (svcs.length) {
    corps += '<div class="rouleau"><table class="svt">'
      + '<colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"></colgroup>'
      + "<thead><tr><th>Statut</th><th>Projet</th><th>Responsable</th><th>Date</th><th>Précision</th></tr></thead><tbody>";
    svcs.forEach(x => {
      corps += '<tr class="' + x.st + '"><td class="st">' + ST[x.st] + "</td>"
        + '<td class="pj">' + esc(x.pj) + "</td><td>" + esc(x.resp) + "</td>"
        + '<td class="dd">' + esc(/\d{4}/.test(x.date) ? dateLisible(x.date) : x.date) + "</td>"
        + "<td>" + esc(x.pr) + "</td></tr>";
    });
    corps += "</tbody></table></div>";
  }
  notesDe(4).forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  notesDe(5).forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Services de l'année " + C.annee, corps));

  corps = "";
  const tri = src.trinomes.filter(t => t.some(Boolean));
  if (tri.length) {
    corps += "<p><b>Trinômes de fraternité.</b> Mis en place pour favoriser des moments de prière et d’échange entre les membres. Chaque trinôme déjeune ensemble au moins deux fois dans l’année, et chacun prie pour les deux autres.</p>";
    corps += '<table class="tri"><tbody>' + tri.map(t =>
      "<tr>" + t.map(x => "<td>" + esc(nomDe(x)) + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
  }
  notesDe(6).forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Propositions spirituelles", corps));

  corps = "";
  if (s.presentation.qui) {
    corps += "<p>" + esc(nomDe(s.presentation.qui)) + " s’est présenté au conseil"
      + (s.presentation.sujet.trim() ? " : " + esc(s.presentation.sujet.trim()) : "") + ".</p>";
    if (s.presentation.audio) corps += '<p class="disc">Le partage est joint au présent envoi sous forme d’enregistrement audio.</p>';
  }
  notesDe(7).forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Présentation d'un frère", corps));

  corps = "";
  const tp = src.topos.filter(t => (t[1] || "").trim());
  if (tp.length) corps += '<div class="topos">' + tp.map(t =>
    "<div><span>" + esc(t[0]) + "</span> — " + esc(t[1]) + "</div>").join("") + "</div>";
  notesDe(8).forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Prochains topos", corps));

  corps = "";
  notesDe(9).forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Autres propositions", corps));

  const rap = src.retenir.filter(x => x.trim());
  if (rap.length) {
    H.push('<div class="encadre rappel"><h3>À retenir toute l’année</h3><ul class="losange">'
      + rap.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul></div>");
  }

  H.push('<p class="formule">Je vous prie d’agréer, Chers Frères, l’expression de mes sentiments fraternels et dévoués.</p>');
  H.push('<div class="signature">');
  H.push('<div class="lieu">Fait à ' + esc(C.ville) + ", le " + esc(dateLongue(s.fin || Date.now()).replace(/^\w+ /, "")) + "</div>");
  H.push("<div>Le secrétaire-archiviste du " + esc(C.nom) + ",</div>");
  H.push('<div class="nom">' + esc(C.secretaire) + "</div></div>");
  H.push('<div class="devise">Charité · Unité · Fraternité</div>');
  H.push('<p class="mention">Document interne — Chevaliers de Colomb, ' + esc(C.nom) + " — Ne pas diffuser hors du conseil</p>");
  H.push("</div></div>");
  return H.join("");
}

function vueCR(v) {
  if (!SE()) { v.appendChild(el("div", "vide-fil", "Aucune séance en cours. Débutez-en une dans l'onglet Séance.")); return; }
  const box = el("div");
  box.innerHTML = documentHTML(S);
  v.appendChild(box);
  preparerImpression(S);

  const a = el("div", "docact");
  const b1 = el("button", "p", "Générer le PDF"); b1.type = "button";
  b1.addEventListener("click", imprimer);
  const b2 = el("button", "s", "Sauvegarder la séance"); b2.type = "button";
  b2.addEventListener("click", exporter);
  a.appendChild(b2); a.appendChild(b1);
  v.appendChild(a);
}

function preparerImpression(src) {
  $("#impression").innerHTML = (src || S).seance ? documentHTML(src || S) : "";
}
function imprimer() {
  preparerImpression(S);
  setTimeout(() => window.print(), 60);
}
/* Une impression lancée depuis le menu du navigateur doit sortir le document,
   pas une page blanche. */
window.addEventListener("beforeprint", () => {
  if (!$("#impression").innerHTML.trim()) preparerImpression(S);
});

/* --------------------------- sauvegarde --------------------------- */
function exporter() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  a.href = url;
  a.download = "carnet-" + d.getFullYear() + String(d.getMonth() + 1).padStart(2,"0")
    + String(d.getDate()).padStart(2,"0") + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast("Sauvegarde enregistrée dans vos téléchargements.");
}
function importer(fichier) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const o = JSON.parse(r.result);
      if (!o || o.v !== 1 || !Array.isArray(o.effectif)) throw new Error("format");
      if (!confirm("Remplacer tout le contenu de ce téléphone par cette sauvegarde ?")) return;
      S = o; maj(); $("#sheet").hidden = true;
      toast("Sauvegarde restaurée.");
    } catch (e) { toast("Ce fichier n'est pas une sauvegarde du carnet."); }
  };
  r.readAsText(fichier);
}

/* ---------------------------- réglages ---------------------------- */
function ouvrirReglages() {
  const inn = $("#sheet-in");
  inn.textContent = "";
  const sh = el("div", "sh");
  sh.appendChild(el("h3", null, "Réglages"));
  const f = el("button", null, "Fermer"); f.type = "button";
  f.addEventListener("click", () => { $("#sheet").hidden = true; });
  sh.appendChild(f); inn.appendChild(sh);

  const c = el("div", "corps");
  champ(c, "Nom du conseil", S.conseil.nom, x => { S.conseil.nom = x; });
  champ(c, "Secteur paroissial", S.conseil.secteur, x => { S.conseil.secteur = x; });
  champ(c, "Ville", S.conseil.ville, x => { S.conseil.ville = x; });
  champ(c, "Lieu des réunions", S.conseil.lieu, x => { S.conseil.lieu = x; });
  champ(c, "Secrétaire-archiviste", S.conseil.secretaire, x => { S.conseil.secretaire = x; });
  champ(c, "Année fraternelle", S.conseil.annee, x => { S.conseil.annee = x; });

  c.appendChild(el("div", "derive", "Tout ce que vous saisissez reste dans ce téléphone. Rien n'est envoyé sur internet. Sauvegardez de temps en temps : si vous videz les données du navigateur, le carnet repart à zéro."));

  const be = el("button", "addl", "Sauvegarder dans un fichier"); be.type = "button";
  be.addEventListener("click", exporter); c.appendChild(be);

  const bi = el("button", "addl", "Restaurer une sauvegarde"); bi.type = "button";
  const inp = el("input"); inp.type = "file"; inp.accept = "application/json,.json"; inp.hidden = true;
  inp.addEventListener("change", () => { if (inp.files[0]) importer(inp.files[0]); });
  bi.addEventListener("click", () => inp.click());
  c.appendChild(bi); c.appendChild(inp);

  if (S.archives.length) {
    c.appendChild(el("div", "filtitre", "Séances archivées"));
    S.archives.forEach(a => {
      const b = el("button", "addl", dateLongue(a.debut)); b.type = "button";
      b.style.textAlign = "left";
      b.addEventListener("click", () => { preparerImpression(a); setTimeout(() => window.print(), 60); });
      c.appendChild(b);
    });
  }

  const bz = el("button", "addl danger", "Effacer tout et repartir de zéro"); bz.type = "button";
  bz.addEventListener("click", () => {
    if (!confirm("Effacer tout le contenu du carnet ? Cette action est définitive.")) return;
    if (!confirm("Vraiment ? Pensez à avoir sauvegardé dans un fichier.")) return;
    S = etatNeuf(); maj(); $("#sheet").hidden = true;
  });
  c.appendChild(bz);

  inn.appendChild(c);
  $("#sheet").hidden = false;
}

function ouvrirSommaire() {
  const inn = $("#sheet-in");
  inn.textContent = "";
  const sh = el("div", "sh");
  sh.appendChild(el("h3", null, "Déroulé du conseil"));
  const f = el("button", null, "Fermer"); f.type = "button";
  f.addEventListener("click", () => { $("#sheet").hidden = true; });
  sh.appendChild(f); inn.appendChild(sh);
  SECTIONS.forEach((s, i) => {
    const b = el("button", "pl"); b.type = "button";
    if (i + 1 === secCourante) b.setAttribute("aria-current", "true");
    b.appendChild(el("span", "nn", String(i + 1)));
    b.appendChild(el("span", "ll", s.t));
    const n = duSec(i + 1).length;
    b.appendChild(el("span", "bb", n ? n + (n > 1 ? " notes" : " note") : ""));
    b.addEventListener("click", () => { $("#sheet").hidden = true; allerSection(i + 1); });
    inn.appendChild(b);
  });
  $("#sheet").hidden = false;
}

/* -------------------------- orchestration -------------------------- */
function rendre() {
  const v = $("#vue");
  v.textContent = "";
  v.className = "vue" + (vueCourante === "cr" ? " doc" : "");
  ({ seance: vueSeance, freres: vueFreres, cr: vueCR })[vueCourante](v);

  const enCours = vueCourante === "seance" && SE() && !SE().fin;
  $("#secwrap").hidden = !enCours;
  $("#compose").hidden = !enCours;
  if (enCours) {
    $("#s-n").textContent = secCourante + " sur " + SECTIONS.length;
    $("#s-l").textContent = SEC().t;
    $("#s-prec").disabled = secCourante <= 1;
    $("#s-suiv").disabled = secCourante >= SECTIONS.length;
    $("#jauge").style.width = Math.round(secCourante / SECTIONS.length * 100) + "%";
    $("#saisie").placeholder = SEC().ph;
  }

  const dc = $("#dicta");
  const audio = !!(SE() && SE().dicta);
  dc.className = "dicta" + (audio ? "" : " off");
  $("#dicta-t").textContent = audio ? "Dictaphone" : "Sans audio";
  dc.hidden = !SE();

  $("#bar-conseil").textContent = S.conseil.nom;
  $("#bar-date").textContent = SE()
    ? dateLongue(SE().debut).replace(/ \d{4}$/, "")
    : dateLongue(Date.now()).replace(/ \d{4}$/, "");

  document.querySelectorAll("#nav5 button").forEach(b => {
    if (b.dataset.v === vueCourante) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}

function setMode(m) {
  mode = m;
  $("#m-action").setAttribute("aria-pressed", String(m === "action"));
  $("#m-etat").textContent = m === "action" ? "cette note sera une action" : "note simple";
}
function envoyer() {
  const ta = $("#saisie");
  if (!ta.value.trim()) return;
  ajouterNote(secCourante, mode, ta.value.trim());
  ta.value = ""; ta.style.height = "auto"; $("#go").disabled = true;
  setMode("note"); maj();
  const v = $("#vue"); v.scrollTop = v.scrollHeight;
}

document.querySelectorAll("#nav5 button").forEach(b => {
  b.addEventListener("click", () => { vueCourante = b.dataset.v; rendre(); });
});
function allerSection(n) {
  secCourante = n; svOuvert = null;
  if (SEC().k === "services") { trierServices(); sauver(); }
  rendre();
}
$("#s-prec").addEventListener("click", () => { if (secCourante > 1) allerSection(secCourante - 1); });
$("#s-suiv").addEventListener("click", () => { if (secCourante < SECTIONS.length) allerSection(secCourante + 1); });
$("#s-cur").addEventListener("click", ouvrirSommaire);
$("#ouvrir-reglages").addEventListener("click", ouvrirReglages);
$("#sheet").addEventListener("click", e => { if (e.target.id === "sheet") $("#sheet").hidden = true; });
$("#dicta").addEventListener("click", () => { if (SE()) { SE().dicta = !SE().dicta; maj(); } });
$("#m-action").addEventListener("click", () => setMode(mode === "action" ? "note" : "action"));
$("#go").addEventListener("click", envoyer);

const ta = $("#saisie");
ta.addEventListener("input", () => {
  $("#go").disabled = !ta.value.trim();
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 130) + "px";
});
ta.addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); envoyer(); }
});

setInterval(() => {
  const s = SE();
  $("#chrono").textContent = s ? mmss((s.fin || Date.now()) - s.debut) : "00:00";
  $("#chrono").hidden = !s;
}, 1000);

window.addEventListener("beforeunload", () => {
  clearTimeout(sauveTimer);
  try { localStorage.setItem(CLE, JSON.stringify(S)); } catch (e) { /* rien à faire */ }
});

/* ------------------------------ départ ------------------------------ */
S = charger();
setMode("note");
rendre();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* hors ligne indisponible */ });
  });
}
