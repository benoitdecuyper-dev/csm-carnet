/* ================= Carnet du Conseil Saint Mommolin =================
   Tout vit dans ce téléphone : rien n'est envoyé nulle part.
   ==================================================================== */
"use strict";

const CLE = "csm.carnet.v1";
const CLE_BAC = "csm.carnet.bac";
const DUREE_TOPO = 10 * 60 * 1000;
const $ = s => document.querySelector(s);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const uid = () => Math.random().toString(36).slice(2, 9);

const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const JOURS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const POSTES = ["","Grand Chevalier","Député Grand Chevalier","Aumônier","Secrétaire-archiviste",
  "Secrétaire financier","Trésorier","Avocat","Cérémoniaire","Syndic","Intendant"];
const ST = { v:"À venir", c:"En cours", t:"Terminé" };
const ROM = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII"];

const SECTIONS = [
  { t:"Effectif", k:"effectif", ph:"Une remarque sur l'ouverture…" },
  { t:"Enseignement du Padre", k:"topo", ph:"Ce qu'a dit le Padre…" },
  { t:"Effectifs et intronisations", k:"recrutement", ph:"Ce qui s'est dit sur le recrutement…" },
  { t:"Trésorerie", k:"comptes", ph:"Une précision sur les comptes…" },
  { t:"Services", k:"services", ph:"Ce qui s'est dit sur les services…" },
  { t:"Prochaines dates", k:"dates", ph:"Une précision sur le calendrier…" },
  { t:"Actualités de l'Ordre en France", k:"france", ph:"Une actualité de l'Ordre…" },
  { t:"Propositions spirituelles", k:"spirituel", ph:"Ce qui a été proposé…" },
  { t:"Présentation d'un frère", k:"presentation", ph:"Ce qu'il a partagé…" },
  { t:"Prochains topos", k:"topos", ph:"Une remarque sur les topos…" },
  { t:"Autres propositions", k:"note", ph:"Une proposition libre…" },
  { t:"À retenir toute l'année", k:"retenir", ph:"Un rappel permanent…" },
  { t:"Prochain conseil", k:"prochain", ph:"Une précision sur la prochaine fois…" }
];
/* Ordre des sections de la version 1, pour rattacher les notes déjà prises. */
const SECTIONS_V1 = ["effectif","topo","comptes","services","dates","spirituel",
  "presentation","topos","note","retenir","prochain"];
/* Le parcours d'un aspirant. L'Exemplification de la charité, l'unité et la
   fraternité réunit depuis 2020 les trois premiers degrés en une cérémonie. */
const ETAPES = ["Pressenti", "Formulaire 100 remis", "Scrutin d'admission fait",
  "Exemplification programmée", "Exemplifié", "Quatrième degré"];

/* ------------------------- état de départ ------------------------- */
function frere(p, n, po, asp, pere) {
  return { id: uid(), p: p, n: n || "", po: po || "", asp: !!asp, pere: !!pere };
}
/* L'application est publiée sur une adresse publique : elle ne contient
   AUCUN nom de frère. Le conseil charge son effectif une fois, depuis le
   fichier d'amorçage, par « Restaurer une sauvegarde » dans les réglages. */
function etatNeuf() {
  return {
    v: 2,
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
    ceremonies: [],
    objectif: "",
    seance: null,
    archives: []
  };
}
/* Le conseil se réunit le premier mardi du mois : la date du prochain conseil
   se propose d'elle-même, personne ne devrait avoir à la chercher. */
function premierMardi(an, mois) {
  const d = new Date(an, mois, 1);
  d.setDate(1 + ((2 - d.getDay()) + 7) % 7);
  return d;
}
function prochainPremierMardi(apres) {
  const d = new Date(apres);
  let c = premierMardi(d.getFullYear(), d.getMonth());
  if (c <= d) c = premierMardi(d.getFullYear(), d.getMonth() + 1);
  return isoDe(c);
}
function anneeFraternelle() {
  const d = new Date(), a = d.getFullYear();
  return d.getMonth() >= 6 ? a + "-" + (a + 1) : (a - 1) + "-" + a;
}

/* --------------------------- persistance --------------------------- */
let S = null;
let vueCourante = "seance", secCourante = 1, mode = "note";
let svOuvert = null, frOuvert = null, filtreSv = "actifs";
let modeSuppr = false;
const choisis = new Set();
let sauveTimer = null;
let gele = false;   /* on quitte le bac à sable : plus une seule écriture */

function charger() {
  try {
    const brut = localStorage.getItem(auBac() ? CLE_BAC : CLE);
    if (brut) {
      const o = JSON.parse(brut);
      if (o && Array.isArray(o.effectif)) return migrer(o);
    }
  } catch (e) { /* stockage indisponible : on repart d'un état neuf */ }
  return etatNeuf();
}
/* Une version qui ajoute des sections ne doit pas déplacer les notes déjà
   prises : on les rattache par clé, et non plus par rang. */
function migrer(o) {
  if (o.v === 1) {
    const s = o.seance;
    const recale = n => { if (typeof n.sec === "number") n.sec = SECTIONS_V1[n.sec - 1] || "note"; };
    if (s && Array.isArray(s.notes)) s.notes.forEach(recale);
    (o.archives || []).forEach(a => { if (a.seance && Array.isArray(a.seance.notes)) a.seance.notes.forEach(recale); });
    o.v = 2;
  }
  if (!Array.isArray(o.ceremonies)) o.ceremonies = [];
  if (typeof o.objectif !== "string") o.objectif = "";
  if (o.seance) completerSeance(o.seance);
  (o.archives || []).forEach(a => { if (a.seance) completerSeance(a.seance); });
  /* les dates saisies en jj/mm/aaaa passent au format de l'agenda */
  (o.services || []).forEach(x => { x.date = versIso(x.date); });
  (o.evenements || []).forEach(x => { x.date = versIso(x.date); });
  return o;
}
function completerSeance(s) {
  if (!Array.isArray(s.notes)) s.notes = [];
  if (!Array.isArray(s.invites)) s.invites = [];
  if (!s.france) s.france = { membres:"", conseils:"", dioceses:"", creations:"", quand:"" };
  if (!s.padre) s.padre = { titre:"", audio:true };
  if (!s.presentation) s.presentation = { qui:"", sujet:"", audio:true };
  if (!s.prochain) s.prochain = { date:"", heure:"20h30", lieu:"", topo:"" };
  s.prochain.date = versIso(s.prochain.date);
  if (!s.prochain.date) s.prochain.date = prochainPremierMardi(s.debut || Date.now());
  if (!s.tk) s.tk = null;
  if (!Array.isArray(s.audios)) s.audios = [];
  return s;
}
function sauver() {
  if (gele) return;
  clearTimeout(sauveTimer);
  sauveTimer = setTimeout(() => {
    try { localStorage.setItem(auBac() ? CLE_BAC : CLE, JSON.stringify(S)); }
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
const chevaliers = () => S.effectif.filter(f => !f.asp);
function presents() { const s = SE(); if (!s) return 0;
  return S.effectif.filter(f => s.presence[f.id] === "P").length; }
function etatPres(f) { const s = SE(); return (s && s.presence[f.id]) || "A"; }

/* Une date se saisit dans l'agenda du téléphone et se range en aaaa-mm-jj.
   Les carnets d'avant notaient jj/mm/aaaa : on continue de les lire. */
function isoDe(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2,"0")
    + "-" + String(d.getDate()).padStart(2,"0");
}
function versIso(d) {
  d = (d || "").trim();
  if (!d) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(d);
  if (!m) return d;                       /* « chaque samedi » reste tel quel */
  const an = m[3].length === 2 ? "20" + m[3] : m[3];
  return an + "-" + m[2].padStart(2,"0") + "-" + m[1].padStart(2,"0");
}
const estIso = d => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
function jourCourt(d) {
  d = versIso(d);
  return estIso(d) ? d.slice(8,10) + "/" + d.slice(5,7) : (d || "");
}
function clefDate(d) { d = versIso(d); return estIso(d) ? d.replace(/-/g,"") : "9999"; }
function dateLisible(d) {
  d = versIso(d);
  if (!estIso(d)) return d || "";
  return parseInt(d.slice(8,10),10) + " " + MOIS[parseInt(d.slice(5,7),10) - 1] + " " + d.slice(0,4);
}
function moisDe(d) { d = versIso(d); return estIso(d) ? MOIS[parseInt(d.slice(5,7),10) - 1] : ""; }
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
  const mois = moisDe(s.prochain.date);
  if (!mois) return "";
  const t = S.topos.find(x => (x[0] || "").toLowerCase() === mois);
  return t ? (t[1] || "").trim() : "";
}

/* ------------------------- cycle de séance ------------------------- */
/* Un conseil ressemble au précédent : la nouvelle séance reprend ce qui ne
   change pas d'un mois sur l'autre — le solde, l'heure, le lieu, les chiffres
   de l'Ordre — et laisse vide ce qui se joue ce soir-là. */
function derniereSeance() {
  if (S.seance) return S.seance;
  const a = S.archives.find(x => x && x.seance);
  return a ? a.seance : null;
}
function debuterSeance(avecAudio) {
  const pres = {};
  S.effectif.forEach(f => { pres[f.id] = "A"; });
  const p = derniereSeance();
  S.seance = completerSeance({
    id: uid(), debut: Date.now(), fin: null, dicta: !!avecAudio,
    padre: { titre: "", audio: true },
    comptes: p ? p.comptes : "",
    presentation: { qui: "", sujet: "", audio: true },
    prochain: { date: prochainPremierMardi(Date.now()),
      heure: p ? p.prochain.heure : "20h30",
      lieu: (p && p.prochain.lieu) || S.conseil.lieu, topo: "" },
    france: p ? JSON.parse(JSON.stringify(p.france)) : null,
    invites: [],
    presence: pres,
    notes: []
  });
  secCourante = 1;
  garderEcran(true);
  maj();
  if (p) toast("Séance ouverte, reprise de la précédente.");
}
function cloreSeance() {
  SE().fin = Date.now();
  SE().dicta = false;
  SE().tk = null;
  garderEcran(false);
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
/* Une date ne se tape pas au clavier : l'agenda du téléphone la donne
   entière, année comprise. Ce qui n'est pas une date (« chaque samedi »)
   garde un champ libre, accessible d'un bouton. */
function champDate(parent, lib, val, set, aide) {
  const c = el("label", "ch");
  c.appendChild(el("span", null, lib));
  const v = versIso(val);
  const libre = !!v && !estIso(v);
  const i = el("input");
  i.type = libre ? "text" : "date";
  i.value = v || "";
  if (libre) i.placeholder = "chaque samedi, en juin…";
  i.addEventListener("input", () => { set(i.value); sauver(); });
  i.addEventListener("change", () => { set(i.value); maj(); });
  c.appendChild(i);
  parent.appendChild(c);
  const b = el("button", "lien", libre ? "Choisir une date dans l'agenda" : "Pas une date précise ?");
  b.type = "button";
  b.addEventListener("click", () => { set(libre ? "" : "à préciser"); maj(); });
  parent.appendChild(b);
  if (aide) parent.appendChild(el("div", "derive", aide));
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

  /* Un invité n'entre pas à l'effectif : il est là ce soir, et c'est tout. */
  const g = el("div", "outil");
  const gh = el("div", "th");
  gh.appendChild(el("h3", null, "Invités de ce soir"));
  gh.appendChild(el("span", "cpt", String(SE().invites.length)));
  g.appendChild(gh);
  const gt = el("div", "tb plat");
  SE().invites.forEach((iv, i) => {
    const l = el("div", "dt");
    const inp = el("input"); inp.type = "text"; inp.value = iv.txt;
    inp.placeholder = "Nom et qualité de l'invité";
    inp.style.cssText = "flex:1;min-width:0;border:1px solid var(--rule);border-radius:7px;padding:8px 10px;background:#fbfcfd;min-height:40px;";
    inp.addEventListener("input", () => { SE().invites[i].txt = inp.value; sauver(); });
    l.appendChild(inp);
    const b = el("button", "mini", "×"); b.type = "button";
    b.setAttribute("aria-label", "Retirer cet invité");
    b.addEventListener("click", () => { SE().invites.splice(i, 1); maj(); });
    l.appendChild(b);
    gt.appendChild(l);
  });
  g.appendChild(gt);
  const ga = el("button", "addl", "＋ un invité"); ga.type = "button";
  ga.addEventListener("click", () => { SE().invites.push({ id: uid(), txt: "" }); maj(); });
  g.appendChild(ga);
  v.appendChild(g);
}

/* ---------------------- le chrono du topo ----------------------
   Dix minutes qui décomptent, l'écran qui reste allumé, et un voyant
   discret quand on déborde : de quoi tenir le temps sans couper la parole. */
function lancerChrono(cible, titre) {
  SE().tk = { debut: Date.now(), duree: DUREE_TOPO, cible: cible, titre: titre || "" };
  garderEcran(true);
  maj();
}
function arreterChrono() {
  SE().tk = null;
  garderEcran(false);
  maj();
}
let verrou = null;
async function garderEcran(oui) {
  try {
    if (oui) {
      if (!verrou && "wakeLock" in navigator) {
        verrou = await navigator.wakeLock.request("screen");
        verrou.addEventListener("release", () => { verrou = null; });
      }
    } else if (verrou) { await verrou.release(); verrou = null; }
  } catch (e) { /* l'appareil refuse : le chrono marche quand même */ }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && SE() && SE().tk) garderEcran(true);
});

function panneauChrono(v) {
  const tk = SE().tk;
  const reste = tk.duree - (Date.now() - tk.debut);
  const p = el("div", "tk" + (reste < 0 ? " over" : ""));
  p.appendChild(el("div", "tk-q", tk.titre || "Topo en cours"));
  const h = el("div", "tk-h", (reste < 0 ? "+" : "") + mmss(Math.abs(reste)));
  h.id = "tk-h";
  p.appendChild(h);
  p.appendChild(el("div", "tk-s", reste < 0 ? "temps dépassé" : "il reste"));
  const r = el("div", "tk-b");
  [["＋ 2 min", () => { SE().tk.duree += 120000; maj(); }],
   ["Terminer", arreterChrono]].forEach(([lib, fn]) => {
    const b = el("button", null, lib); b.type = "button";
    b.addEventListener("click", fn); r.appendChild(b);
  });
  p.appendChild(r);
  v.appendChild(p);
}

function blocTopo(v, cible, titreBloc, champTitre, valTitre, setTitre, ph) {
  const o = el("div", "outil");
  const th = el("div", "th"); th.appendChild(el("h3", null, titreBloc)); o.appendChild(th);
  const tb = el("div", "tb");
  champ(tb, champTitre, valTitre, setTitre, ph);
  const c = el("div", "chipline");
  const obj = cible === "padre" ? SE().padre : SE().presentation;
  const b = el("button", "chip" + (obj.audio ? " on" : ""), "Enregistrement joint"); b.type = "button";
  b.addEventListener("click", () => { obj.audio = !obj.audio; maj(); });
  c.appendChild(b); tb.appendChild(c);
  tb.appendChild(el("div", "derive", "L'enregistreur du téléphone tourne à part ; le fichier se joint au compte rendu au moment de l'enregistrer."));
  const g = el("button", "gros", "Lancer le chrono — 10 minutes"); g.type = "button";
  g.addEventListener("click", () => {
    const t = cible === "padre" ? SE().padre.titre : SE().presentation.sujet;
    lancerChrono(cible, (t || "").trim() || titreBloc);
  });
  tb.appendChild(g);
  o.appendChild(tb); v.appendChild(o);
}

function outilTopo(v) {
  blocTopo(v, "padre", "Enseignement du Padre", "Sujet du topo",
    SE().padre.titre, x => { SE().padre.titre = x; }, "Dieu qui nous parle");
}

function outilComptes(v) {
  const o = el("div", "outil");
  const th = el("div", "th"); th.appendChild(el("h3", null, "Trésorerie")); o.appendChild(th);
  const tb = el("div", "tb");
  champ(tb, "Solde du conseil", SE().comptes, x => { SE().comptes = x; }, "256,80 €");
  o.appendChild(tb); v.appendChild(o);
}

/* Ajouter quelque chose se voit et se valide : un formulaire qui porte son
   nom, un bouton qui dit ce qu'il fait, et la ligne créée qui s'ouvre en tête. */
function ouvrirFormulaire(titre, remplir, valider, libValider) {
  const inn = $("#sheet-in");
  inn.textContent = "";
  const sh = el("div", "sh");
  sh.appendChild(el("h3", null, titre));
  const f = el("button", null, "Annuler"); f.type = "button";
  f.addEventListener("click", () => { $("#sheet").hidden = true; });
  sh.appendChild(f); inn.appendChild(sh);
  const c = el("div", "corps");
  const brouillon = {};
  remplir(c, brouillon);
  const pied = el("div", "pied-form");
  const ok = el("button", "gros", libValider); ok.type = "button";
  ok.addEventListener("click", () => {
    const msg = valider(brouillon);
    if (msg) { toast(msg); return; }
    $("#sheet").hidden = true;
  });
  pied.appendChild(ok);
  c.appendChild(pied);
  inn.appendChild(c);
  $("#sheet").hidden = false;
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
    champDate(ed, "Date", sv.date, x => { sv.date = x; });
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
    ouvrirFormulaire("Nouveau service", (c, b) => {
      b.pj = ""; b.resp = ""; b.date = ""; b.pr = ""; b.st = "v";
      champ(c, "Projet", "", x => { b.pj = x; }, "vente de gâteaux à la sortie");
      champ(c, "Responsable", "", x => { b.resp = x; }, "un ou plusieurs frères");
      champDate(c, "Date", "", x => { b.date = x; });
      champ(c, "Précision", "", x => { b.pr = x; }, "", true);
      const l = el("div", "chipline");
      Object.keys(ST).forEach(k => {
        const bb = el("button", "chip" + (k === "v" ? " on" : ""), ST[k]); bb.type = "button";
        bb.addEventListener("click", () => {
          b.st = k;
          l.querySelectorAll("button").forEach(x => x.classList.remove("on"));
          bb.classList.add("on");
        });
        l.appendChild(bb);
      });
      c.appendChild(l);
      c.appendChild(el("div", "derive", "Un service « à venir » qui porte une date remonte de lui-même dans les prochaines dates et dans le compte rendu."));
    }, b => {
      if (!b.pj.trim()) return "Il manque le nom du projet.";
      const sv = { id: uid(), st: b.st, pj: b.pj.trim(), resp: b.resp.trim(), date: b.date, pr: b.pr };
      S.services.unshift(sv); svOuvert = sv.id; filtreSv = b.st === "t" ? "t" : "actifs"; maj();
      toast("Service ajouté : " + sv.pj);
      return "";
    }, "Ajouter le service");
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
  const b = el("button", "addl", "＋ un événement"); b.type = "button";
  b.addEventListener("click", () => {
    ouvrirFormulaire("Nouvel événement", (c, br) => {
      br.q = ""; br.date = "";
      champ(c, "Événement", "", x => { br.q = x; }, "messe de la Toussaint");
      champDate(c, "Date", "", x => { br.date = x; });
    }, br => {
      if (!br.q.trim()) return "Il manque le nom de l'événement.";
      S.evenements.push({ id: uid(), q: br.q.trim(), date: br.date });
      maj(); toast("Événement ajouté.");
      return "";
    }, "Ajouter l'événement");
  });
  f.appendChild(b);
  o.appendChild(f);
  v.appendChild(o);
}

/* Le hasard vaut mieux que la page blanche : on complète, on ne remplace
   jamais ce qui a été décidé en séance. */
function melange(t) {
  const a = t.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const x = a[i]; a[i] = a[j]; a[j] = x;
  }
  return a;
}
function completerTrinomes() {
  const places = S.trinomes.flat().filter(Boolean);
  const reste = melange(chevaliers().filter(f => !places.includes(f.id)).map(f => f.id));
  if (!reste.length) return 0;
  const n = reste.length;
  S.trinomes.forEach(t => {
    for (let j = 0; j < 3; j++) if (!t[j] && reste.length) t[j] = reste.shift();
  });
  while (reste.length) {
    const t = [reste.shift() || "", reste.shift() || "", reste.shift() || ""];
    S.trinomes.push(t);
  }
  /* Un frère seul rejoint le dernier trinôme plutôt que d'y rester seul. */
  if (S.trinomes.length > 1) {
    const d = S.trinomes[S.trinomes.length - 1];
    if (d.filter(Boolean).length === 1) {
      const av = S.trinomes[S.trinomes.length - 2];
      if (av.filter(Boolean).length < 3) { av[av.indexOf("")] = d.find(Boolean); S.trinomes.pop(); }
    }
  }
  maj();
  return n;
}
function designerTopos() {
  const pris = S.topos.map(t => (t[1] || "").trim()).filter(Boolean);
  const libres = melange(chevaliers().map(nomc).filter(x => !pris.includes(x)));
  let n = 0;
  S.topos.forEach(t => {
    if (!(t[1] || "").trim() && libres.length) { t[1] = libres.shift(); n++; }
  });
  if (n) maj();
  return n;
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
  const h = el("button", "addl", "Compléter au hasard"); h.type = "button";
  h.addEventListener("click", () => {
    const n = completerTrinomes();
    toast(n ? n + (n > 1 ? " frères placés" : " frère placé") + " au hasard." : "Tout le monde a déjà son trinôme.");
  });
  f.appendChild(h);

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
  o.appendChild(tb); v.appendChild(o);
  blocTopo(v, "presentation", "Son partage", "Sujet",
    SE().presentation.sujet, x => { SE().presentation.sujet = x; }, "son chemin jusqu'ici");
}

/* -------- suivi des effectifs et cérémonies d'intronisation --------
   Le conseil vit de son recrutement : où en est chaque aspirant, et quand
   passe-t-il l'Exemplification. */
function outilRecrutement(v) {
  const ch = chevaliers().length, asp = S.effectif.filter(f => f.asp).length;
  const o = el("div", "outil");
  const th = el("div", "th");
  th.appendChild(el("h3", null, "Où en est l'effectif"));
  th.appendChild(el("span", "cpt", ch + " chevaliers · " + asp + " aspirants"));
  o.appendChild(th);
  const tb = el("div", "tb");
  champ(tb, "Objectif de l'année fraternelle", S.objectif, x => { S.objectif = x; }, "trois nouveaux frères");
  o.appendChild(tb);
  v.appendChild(o);

  const a = el("div", "outil");
  const ah = el("div", "th");
  ah.appendChild(el("h3", null, "Parcours des aspirants"));
  a.appendChild(ah);
  const at = el("div", "tb plat");
  const asps = S.effectif.filter(f => f.asp);
  asps.forEach(f => {
    const l = el("div", "li");
    const w = el("div", "who");
    w.appendChild(el("div", "nm", nomc(f)));
    w.appendChild(el("div", "po", f.etape || "étape à préciser"));
    l.appendChild(w);
    const sel = el("select"); sel.style.cssText = "flex:0 0 auto;max-width:52%;border:1px solid var(--rule);border-radius:7px;padding:7px 8px;background:#fbfcfd;min-height:40px;";
    const vide = el("option", null, "— à préciser —"); vide.value = ""; sel.appendChild(vide);
    ETAPES.forEach(e => { const op = el("option", null, e); op.value = e; if (e === (f.etape || "")) op.selected = true; sel.appendChild(op); });
    sel.addEventListener("change", () => { f.etape = sel.value; maj(); });
    l.appendChild(sel);
    at.appendChild(l);
  });
  if (!asps.length) at.appendChild(el("div", "vide-fil", "Aucun aspirant pour l'instant."));
  a.appendChild(at);
  v.appendChild(a);

  const c = el("div", "outil");
  const chh = el("div", "th");
  chh.appendChild(el("h3", null, "Cérémonies d'intronisation"));
  chh.appendChild(el("span", "cpt", String(S.ceremonies.length)));
  c.appendChild(chh);
  const ct = el("div", "tb plat");
  S.ceremonies.forEach(ce => {
    const w = el("div", "sv"); w.dataset.open = String(svOuvert === ce.id);
    const hd = el("div", "hd");
    const co = el("button"); co.type = "button"; co.style.cssText = "flex:1;min-width:0;";
    co.appendChild(el("div", "pj", ce.q || "Exemplification"));
    co.appendChild(el("div", "sub", [dateLisible(ce.date), ce.lieu].filter(Boolean).join(" · ") || "date et lieu à préciser"));
    co.addEventListener("click", () => { svOuvert = (svOuvert === ce.id ? null : ce.id); rendre(); });
    hd.appendChild(co);
    w.appendChild(hd);
    const ed = el("div", "ed");
    champ(ed, "Cérémonie", ce.q, x => { ce.q = x; }, "Exemplification charité, unité, fraternité");
    champDate(ed, "Date", ce.date, x => { ce.date = x; });
    champ(ed, "Lieu", ce.lieu, x => { ce.lieu = x; });
    champ(ed, "Qui est reçu", ce.qui, x => { ce.qui = x; }, "prénoms des aspirants reçus");
    const sup = el("button", "addl danger", "Retirer cette cérémonie"); sup.type = "button";
    sup.addEventListener("click", () => {
      if (!confirm("Retirer cette cérémonie ?")) return;
      S.ceremonies = S.ceremonies.filter(x => x.id !== ce.id); svOuvert = null; maj();
    });
    ed.appendChild(sup);
    w.appendChild(ed);
    ct.appendChild(w);
  });
  if (!S.ceremonies.length) ct.appendChild(el("div", "vide-fil", "Aucune cérémonie programmée."));
  c.appendChild(ct);
  const ca = el("button", "addl", "＋ une cérémonie"); ca.type = "button";
  ca.addEventListener("click", () => {
    const ce = { id: uid(), q: "Exemplification", date: "", lieu: S.conseil.lieu, qui: "" };
    S.ceremonies.push(ce); svOuvert = ce.id; maj();
    toast("Cérémonie ajoutée : complétez-la ci-dessous.");
  });
  c.appendChild(ca);
  v.appendChild(c);
}

/* ---------- actualités de l'Ordre en France ---------- */
function outilFrance(v) {
  const f = SE().france;
  const o = el("div", "outil");
  const th = el("div", "th"); th.appendChild(el("h3", null, "L'Ordre en France")); o.appendChild(th);
  const tb = el("div", "tb");
  const num = (lib, k, ph) => {
    const i = champ(tb, lib, f[k], x => { f[k] = x; }, ph);
    i.inputMode = "numeric";
  };
  num("Membres en France", "membres", "3 200");
  num("Conseils", "conseils", "78");
  num("Diocèses", "dioceses", "42");
  num("Conseils créés cette année", "creations", "4");
  champDate(tb, "Dernière création", f.quand, x => { f.quand = x; });
  tb.appendChild(el("div", "derive", "Ces quatre chiffres se reportent d'une séance sur l'autre : ne corrigez que ce qui a bougé."));
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
  const a = el("button", "addl", "＋ un mois"); a.type = "button";
  a.addEventListener("click", () => {
    ouvrirFormulaire("Nouveau topo", (c, b) => {
      b.mois = ""; b.qui = "";
      const cm = el("label", "ch");
      cm.appendChild(el("span", null, "Mois"));
      const sm = el("select");
      const vm = el("option", null, "— choisir —"); vm.value = ""; sm.appendChild(vm);
      MOIS.forEach(m => { const op = el("option", null, m); op.value = m; sm.appendChild(op); });
      sm.addEventListener("change", () => { b.mois = sm.value; });
      cm.appendChild(sm); c.appendChild(cm);
      const cq = el("label", "ch");
      cq.appendChild(el("span", null, "Quel frère"));
      const sq = el("select");
      const vq = el("option", null, "— à désigner —"); vq.value = ""; sq.appendChild(vq);
      chevaliers().forEach(x => { const op = el("option", null, nomc(x)); op.value = nomc(x); sq.appendChild(op); });
      sq.addEventListener("change", () => { b.qui = sq.value; });
      cq.appendChild(sq); c.appendChild(cq);
    }, b => {
      if (!b.mois) return "Il manque le mois.";
      S.topos.push([b.mois, b.qui]); maj(); toast("Topo de " + b.mois + " ajouté.");
      return "";
    }, "Ajouter le topo");
  });
  f.appendChild(a);
  if (!S.topos.length) {
    const dr = el("button", "addl", "Dresser les mois de l'année fraternelle"); dr.type = "button";
    dr.addEventListener("click", () => {
      ["septembre","octobre","novembre","décembre","janvier","février","mars","avril","mai","juin"]
        .forEach(m => S.topos.push([m, ""]));
      maj(); toast("Dix mois dressés : reste à désigner les frères.");
    });
    f.appendChild(dr);
  }
  const rd = el("button", "addl", "Désigner au hasard les mois vides"); rd.type = "button";
  rd.addEventListener("click", () => {
    const n = designerTopos();
    toast(n ? n + " mois attribué" + (n > 1 ? "s" : "") + " au hasard." : "Aucun mois vide à attribuer.");
  });
  f.appendChild(rd);
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
  champDate(tb, "Date", SE().prochain.date, x => { SE().prochain.date = x; },
    "Proposée d'office : le premier mardi du mois qui vient.");
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

const OUTILS = { effectif:outilEffectif, topo:outilTopo, recrutement:outilRecrutement,
  comptes:outilComptes, services:outilServices, dates:outilDates, france:outilFrance,
  spirituel:outilSpirituel, presentation:outilPresentation, topos:outilTopos,
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

  if (SE().tk) { panneauChrono(v); }

  OUTILS[SEC().k](v);

  const mes = duSec(SEC().k);
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
  th.appendChild(el("span", "cpt", chevaliers().length + " chevaliers · "
    + S.effectif.filter(f => f.asp).length + " aspirants"));
  o.appendChild(th);

  /* Des départs se prononcent souvent ensemble : on coche, on retire une fois. */
  if (modeSuppr) {
    const bar = el("div", "raccourcis");
    const d = el("button", "danger", "Retirer les " + choisis.size + " frères"); d.type = "button";
    d.disabled = !choisis.size;
    d.addEventListener("click", () => {
      const noms = S.effectif.filter(x => choisis.has(x.id)).map(nomc);
      if (!confirm("Retirer du conseil " + noms.join(", ") + " ?")) return;
      S.effectif = S.effectif.filter(x => !choisis.has(x.id));
      S.trinomes = S.trinomes.map(t => t.map(x => choisis.has(x) ? "" : x));
      S.trinomes = S.trinomes.filter(t => t.some(Boolean));
      toast(noms.length + (noms.length > 1 ? " frères retirés." : " frère retiré."));
      choisis.clear(); modeSuppr = false; maj();
    });
    const t2 = el("button", null, "Terminer"); t2.type = "button";
    t2.addEventListener("click", () => { choisis.clear(); modeSuppr = false; rendre(); });
    bar.appendChild(d); bar.appendChild(t2);
    o.appendChild(bar);
  }

  const tb = el("div", "tb plat");
  let der = null;
  S.effectif.forEach((f, i) => {
    if (modeSuppr) {
      const g2 = f.asp ? "Aspirants" : "Chevaliers";
      if (g2 !== der) { tb.appendChild(el("div", "grptitre", g2)); der = g2; }
      const li = el("button", "li" + (choisis.has(f.id) ? "" : " abs")); li.type = "button";
      const w2 = el("div", "who");
      w2.appendChild(el("div", "nm", nomc(f)));
      if (f.po) w2.appendChild(el("div", "po", f.po));
      li.appendChild(w2);
      li.appendChild(el("span", "st " + (choisis.has(f.id) ? "E" : "A"), choisis.has(f.id) ? "Retiré" : "Gardé"));
      li.addEventListener("click", () => {
        if (choisis.has(f.id)) choisis.delete(f.id); else choisis.add(f.id);
        rendre();
      });
      tb.appendChild(li);
      return;
    }
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

  if (!modeSuppr && S.effectif.length) {
    const md = el("button", "addl", "Retirer plusieurs frères"); md.type = "button";
    md.addEventListener("click", () => { modeSuppr = true; frOuvert = null; choisis.clear(); rendre(); });
    o.appendChild(md);
  }

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
  (src.ceremonies || []).filter(c => /\d/.test(c.date))
    .forEach(c => dates.push({ j: jourCourt(c.date), q: c.q || "Exemplification", k: clefDate(c.date) }));
  if (/\d/.test(s.prochain.date))
    dates.push({ j: jourCourt(s.prochain.date), q: "Conseil du mois", k: clefDate(s.prochain.date) });
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

  /* Le prochain conseil et son topo ouvrent toujours le document : c'est ce
     que le frère cherche en premier, il ne doit jamais avoir à le déduire. */
  H.push('<div class="encadre conclave-seul"><h3>Prochain conseil</h3><div class="conclave">');
  H.push('<span class="quand">' + esc(dateLisible(s.prochain.date) || "date à fixer")
    + (s.prochain.heure ? ", " + esc(s.prochain.heure) : "") + "</span>");
  if (s.prochain.lieu) H.push('<span class="ou">' + esc(s.prochain.lieu) + "</span>");
  H.push('<span class="topo">Topo du mois : <b>' + esc(topo || "à désigner") + "</b></span>");
  H.push("</div></div>");

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
  const inv = (s.invites || []).filter(x => x.txt.trim());
  if (inv.length) corps += "<p><b>Invité" + (inv.length > 1 ? "s" : "") + " :</b> "
    + inv.map(x => esc(x.txt.trim())).join(", ") + ".</p>";
  notesDe("effectif").forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Effectif", corps));

  corps = "";
  if (s.padre.titre.trim()) {
    corps += "<p>« " + esc(s.padre.titre.trim()) + " ».</p>";
    if (s.padre.audio) corps += '<p class="disc">Le topo est joint au présent envoi sous forme d’enregistrement audio.</p>';
  }
  notesDe("topo").forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Enseignement du Padre", corps));

  /* --- effectifs et intronisations --- */
  corps = "";
  if (src.objectif && src.objectif.trim())
    corps += "<p>Objectif de l’année fraternelle : <b>" + esc(src.objectif.trim()) + "</b>.</p>";
  const aspirants = eff.filter(f => f.asp);
  if (aspirants.length) {
    corps += '<table class="tri asp"><tbody>' + aspirants.map(f =>
      "<tr><td>" + esc(nomc(f)) + "</td><td>" + esc(f.etape || "étape à préciser") + "</td></tr>").join("")
      + "</tbody></table>";
  }
  const cer = (src.ceremonies || []).filter(c => (c.q || c.date || c.qui));
  if (cer.length) {
    corps += '<div class="topos">' + cer.map(c =>
      "<div><span>" + esc(dateLisible(c.date) || "date à fixer") + "</span> — "
      + esc(c.q || "Exemplification") + (c.lieu ? ", " + esc(c.lieu) : "")
      + (c.qui ? " : " + esc(c.qui) : "") + "</div>").join("") + "</div>";
  }
  notesDe("recrutement").forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Effectifs et intronisations", corps));

  corps = "";
  if (s.comptes.trim()) corps += "<p>Le solde du conseil s’établit à <b>" + esc(s.comptes.trim()) + "</b>.</p>";
  notesDe("comptes").forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Trésorerie", corps));

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
  notesDe("services").forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  notesDe("dates").forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Services de l'année " + C.annee, corps));

  /* --- l'Ordre en France, toujours dans la même forme --- */
  corps = "";
  const fr = s.france || {};
  if (fr.membres || fr.conseils || fr.dioceses || fr.creations) {
    const bouts = [];
    if (fr.membres) bouts.push("<b>" + esc(fr.membres) + "</b> membres");
    if (fr.conseils) bouts.push("<b>" + esc(fr.conseils) + "</b> conseils");
    if (fr.dioceses) bouts.push("<b>" + esc(fr.dioceses) + "</b> diocèses");
    corps += "<p>L’Ordre compte en France " + bouts.join(", ") + ".</p>";
    if (fr.creations) corps += "<p><b>" + esc(fr.creations) + "</b> conseil"
      + (parseInt(fr.creations, 10) > 1 ? "s ont" : " a") + " été créé"
      + (parseInt(fr.creations, 10) > 1 ? "s" : "") + " cette année"
      + (fr.quand ? ", le dernier le " + esc(dateLisible(fr.quand)) : "") + ".</p>";
  }
  notesDe("france").forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("L'Ordre en France", corps));

  corps = "";
  const tri = src.trinomes.filter(t => t.some(Boolean));
  if (tri.length) {
    corps += "<p><b>Trinômes de fraternité.</b> Mis en place pour favoriser des moments de prière et d’échange entre les membres. Chaque trinôme déjeune ensemble au moins deux fois dans l’année, et chacun prie pour les deux autres.</p>";
    corps += '<table class="tri"><tbody>' + tri.map(t =>
      "<tr>" + t.map(x => "<td>" + esc(nomDe(x)) + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
  }
  notesDe("spirituel").forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Propositions spirituelles", corps));

  corps = "";
  if (s.presentation.qui) {
    corps += "<p>" + esc(nomDe(s.presentation.qui)) + " s’est présenté au conseil"
      + (s.presentation.sujet.trim() ? " : " + esc(s.presentation.sujet.trim()) : "") + ".</p>";
    if (s.presentation.audio) corps += '<p class="disc">Le partage est joint au présent envoi sous forme d’enregistrement audio.</p>';
  }
  notesDe("presentation").forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Présentation d'un frère", corps));

  corps = "";
  const tp = src.topos.filter(t => (t[1] || "").trim());
  if (tp.length) corps += '<div class="topos">' + tp.map(t =>
    "<div><span>" + esc(t[0]) + "</span> — " + esc(t[1]) + "</div>").join("") + "</div>";
  notesDe("topos").forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  H.push(sec("Prochains topos", corps));

  corps = "";
  notesDe("note").forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  notesDe("retenir").forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
  notesDe("prochain").forEach(x => { corps += "<p>" + esc(x.txt) + "</p>"; });
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
  const b2 = el("button", "s", "PDF simplifié"); b2.type = "button";
  b2.addEventListener("click", exporterPDF);
  const b1 = el("button", "p", "Enregistrer le compte rendu"); b1.type = "button";
  b1.addEventListener("click", ouvrirEnvoi);
  a.appendChild(b2); a.appendChild(b1);
  v.appendChild(a);
  v.appendChild(el("div", "derive", "Le compte rendu s'enregistre en une page à envoyer : elle s'ouvre sur n'importe quel téléphone, garde la mise en forme du conseil, et peut porter les enregistrements des topos."));
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

/* ------------------- le compte rendu à envoyer -------------------
   Une page HTML, un seul fichier : la mise en forme du conseil voyage avec
   le texte, sans imprimante, sans lecteur particulier, sans internet. */
function fichierEnDataURL(f) {
  return new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = ko;
    r.readAsDataURL(f);
  });
}
async function urlEnDataURL(u) {
  const rep = await fetch(u, { cache: "force-cache" });
  return fichierEnDataURL(await rep.blob());
}
function nomFichier(ext) {
  const d = new Date(SE().debut);
  return "CR-" + S.conseil.nom.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")
    + "-" + d.getFullYear() + String(d.getMonth() + 1).padStart(2,"0")
    + String(d.getDate()).padStart(2,"0") + "." + ext;
}
function telecharger(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}
const poidsLisible = o => o < 1048576 ? Math.round(o / 1024) + " Ko" : (o / 1048576).toFixed(1) + " Mo";

async function construirePage(audios) {
  const css = await (await fetch("cr.css", { cache: "force-cache" })).text();
  const emb = await urlEnDataURL("assets/emblem.png");
  const fil = await urlEnDataURL("assets/saint-mommolin.jpg");
  let corps = documentHTML(S)
    .replace(/assets\/emblem\.png/g, emb)
    .replace(/assets\/saint-mommolin\.jpg/g, fil);

  if (audios && audios.length) {
    let bloc = '<div class="encadre audios"><h3>Enregistrements</h3>';
    for (const a of audios) {
      bloc += '<div class="au"><div class="nm">' + esc(a.nom) + "</div>"
        + '<audio controls preload="none" src="' + a.data + '"></audio></div>';
    }
    bloc += "</div>";
    corps = corps.replace('<p class="formule">', bloc + '<p class="formule">');
  }

  const d = new Date(SE().debut);
  const titre = "Compte rendu — " + S.conseil.nom + " — " + d.getDate() + " " + MOIS[d.getMonth()] + " " + d.getFullYear();
  return "<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n<meta charset=\"UTF-8\">\n"
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + "<title>" + esc(titre) + "</title>\n"
    + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&display=swap">\n'
    + "<style>\n" + css + "\n"
    + "html,body{margin:0;padding:0;background:#c9cfd6;}\n"
    + ".cr{margin:0 auto;box-shadow:0 2px 22px rgba(0,0,0,.22);}\n"
    + "@media print{html,body{background:#fff;} .cr{box-shadow:none;}}\n"
    + ".audios .au{margin:10px 0;} .audios .au .nm{font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px;}\n"
    + ".audios audio{width:100%;}\n"
    + "</style>\n</head>\n<body>\n" + corps + "\n</body>\n</html>\n";
}

function ouvrirEnvoi() {
  const joints = [];
  ouvrirFormulaire("Enregistrer le compte rendu", (c, b) => {
    c.appendChild(el("div", "derive", "La page produite contient tout : le texte, la mise en forme, l'emblème. Elle s'ouvre d'un double clic ou se joint à un courriel."));
    const zone = el("div", "tb plat");
    const compte = el("div", "vide-fil", "Aucun enregistrement joint.");
    zone.appendChild(compte);
    c.appendChild(el("div", "filtitre", "Enregistrements des topos"));
    c.appendChild(zone);
    const inp = el("input"); inp.type = "file"; inp.accept = "audio/*"; inp.multiple = true; inp.hidden = true;
    inp.addEventListener("change", async () => {
      for (const f of inp.files) {
        joints.push({ nom: f.name, taille: f.size, data: await fichierEnDataURL(f) });
      }
      inp.value = "";
      zone.textContent = "";
      let total = 0;
      joints.forEach((a, i) => {
        total += a.taille;
        const l = el("div", "dt");
        l.appendChild(el("span", "q", a.nom + " · " + poidsLisible(a.taille)));
        const x = el("button", "mini", "×"); x.type = "button";
        x.addEventListener("click", () => { joints.splice(i, 1); inp.dispatchEvent(new Event("change")); });
        l.appendChild(x);
        zone.appendChild(l);
      });
      if (!joints.length) zone.appendChild(compte);
      else if (total > 20 * 1048576)
        zone.appendChild(el("div", "alerte", "Au-delà d'une vingtaine de mégaoctets, le courriel passera mal : mieux vaut envoyer l'audio à part."));
    });
    const bj = el("button", "addl", "Joindre un enregistrement"); bj.type = "button";
    bj.addEventListener("click", () => inp.click());
    c.appendChild(bj); c.appendChild(inp);
  }, () => {
    toast("Préparation du compte rendu…");
    construirePage(joints).then(html => {
      telecharger(new Blob([html], { type: "text/html;charset=utf-8" }), nomFichier("html"));
      toast("Compte rendu enregistré dans vos téléchargements.");
    }).catch(() => toast("La page n'a pas pu être produite."));
    return "";
  }, "Enregistrer la page");
}

/* ------------------------ le PDF, en sobre ------------------------
   Sans mise en apparat : du texte réel, léger, pour l'archive et pour qui
   veut imprimer. La page HTML reste le document de référence. */
function chargerJsPDF() {
  if (window.jspdf) return Promise.resolve();
  return new Promise((ok, ko) => {
    const sc = document.createElement("script");
    sc.src = "vendor/jspdf.umd.min.js";
    sc.onload = ok; sc.onerror = ko;
    document.head.appendChild(sc);
  });
}
function texteDuCR(src) {
  const s = src.seance, eff = src.effectif;
  const nomDe = id => { const f = eff.find(x => x.id === id); return f ? ((f.pere ? "Père " : "") + f.p + (f.n ? " " + f.n : "")).trim() : ""; };
  const notesDe = k => s.notes.filter(n => n.sec === k && n.txt.trim() && n.type !== "action").map(n => n.txt.trim());
  const B = [];
  const bloc = (t, l) => { const c = l.filter(Boolean); if (c.length) B.push({ t: t, l: c }); };

  let topo = s.prochain.topo;
  if (!topo) { const t = src.topos.find(x => (x[0] || "").toLowerCase() === moisDe(s.prochain.date)); topo = t ? t[1] : ""; }
  bloc("Prochain conseil", [
    (dateLisible(s.prochain.date) || "date à fixer") + (s.prochain.heure ? ", " + s.prochain.heure : "")
      + (s.prochain.lieu ? " — " + s.prochain.lieu : ""),
    "Topo du mois : " + (topo || "à désigner")
  ]);

  const dates = [];
  src.services.filter(x => x.st === "v" && /\d/.test(x.date)).forEach(x => dates.push({ k: clefDate(x.date), s: dateLisible(x.date) + " — " + x.pj }));
  src.evenements.forEach(e => dates.push({ k: clefDate(e.date), s: dateLisible(e.date) + " — " + e.q }));
  (src.ceremonies || []).filter(c => /\d/.test(c.date)).forEach(c => dates.push({ k: clefDate(c.date), s: dateLisible(c.date) + " — " + (c.q || "Exemplification") }));
  dates.sort((a, b) => a.k.localeCompare(b.k));
  bloc("Prochaines dates", dates.map(x => x.s));

  bloc("Qui fait quoi", s.notes.filter(n => n.type === "action" && n.txt.trim())
    .map(a => (nomDe(a.qui) || "À préciser") + (a.quand ? " (" + a.quand + ")" : "") + " : " + a.txt.trim()));

  const pres = eff.filter(f => s.presence[f.id] === "P").map(f => nomDe(f.id));
  const exc = eff.filter(f => s.presence[f.id] === "E").map(f => nomDe(f.id));
  const inv = (s.invites || []).map(x => x.txt.trim()).filter(Boolean);
  bloc("Effectif", [
    eff.filter(f => !f.asp).length + " chevaliers, " + eff.filter(f => f.asp).length + " aspirants.",
    pres.length ? "Présents : " + pres.join(", ") + "." : "",
    exc.length ? "Excusés : " + exc.join(", ") + "." : "",
    inv.length ? "Invités : " + inv.join(", ") + "." : ""
  ].concat(notesDe("effectif")));

  bloc("Enseignement du Padre", [s.padre.titre.trim() ? "« " + s.padre.titre.trim() + " »" : ""].concat(notesDe("topo")));

  bloc("Effectifs et intronisations", [src.objectif ? "Objectif de l'année : " + src.objectif : ""]
    .concat(eff.filter(f => f.asp).map(f => nomDe(f.id) + " — " + (f.etape || "étape à préciser")))
    .concat((src.ceremonies || []).map(c => (dateLisible(c.date) || "date à fixer") + " — " + (c.q || "Exemplification") + (c.qui ? " : " + c.qui : "")))
    .concat(notesDe("recrutement")));

  bloc("Trésorerie", [s.comptes.trim() ? "Solde : " + s.comptes.trim() : ""].concat(notesDe("comptes")));

  bloc("Services de l'année", src.services.map(x =>
    "[" + ST[x.st] + "] " + x.pj + (x.resp ? " — " + x.resp : "")
    + (x.date ? " — " + (dateLisible(x.date) || x.date) : "") + (x.pr ? " — " + x.pr : ""))
    .concat(notesDe("services")).concat(notesDe("dates")));

  const fr = s.france || {};
  bloc("L'Ordre en France", [
    (fr.membres || fr.conseils || fr.dioceses)
      ? [fr.membres ? fr.membres + " membres" : "", fr.conseils ? fr.conseils + " conseils" : "",
         fr.dioceses ? fr.dioceses + " diocèses" : ""].filter(Boolean).join(", ") + "."
      : "",
    fr.creations ? fr.creations + " conseil(s) créé(s) cette année" + (fr.quand ? ", le dernier le " + dateLisible(fr.quand) : "") + "." : ""
  ].concat(notesDe("france")));

  bloc("Propositions spirituelles", src.trinomes.filter(t => t.some(Boolean))
    .map((t, i) => "Trinôme " + (i + 1) + " : " + t.map(nomDe).filter(Boolean).join(", "))
    .concat(notesDe("spirituel")));

  bloc("Présentation d'un frère", [s.presentation.qui
    ? nomDe(s.presentation.qui) + (s.presentation.sujet.trim() ? " : " + s.presentation.sujet.trim() : "") : ""]
    .concat(notesDe("presentation")));

  bloc("Prochains topos", src.topos.filter(t => (t[1] || "").trim()).map(t => t[0] + " — " + t[1]).concat(notesDe("topos")));
  bloc("Autres propositions", notesDe("note").concat(notesDe("prochain")));
  bloc("À retenir toute l'année", src.retenir.filter(x => x.trim()).concat(notesDe("retenir")));
  return B;
}
async function exporterPDF() {
  try { await chargerJsPDF(); } catch (e) { toast("Le module PDF n'a pas pu être chargé."); return; }
  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  const L = 20, R = 190, HAUT = 20, BAS = 282;
  let y = HAUT;
  const saut = h => { if (y + h > BAS) { doc.addPage(); y = HAUT; } };

  doc.setFont("times", "bold"); doc.setFontSize(16);
  doc.text("Chevaliers de Colomb", 105, y, { align: "center" }); y += 7;
  doc.setFontSize(13);
  doc.text(S.conseil.nom, 105, y, { align: "center" }); y += 7;
  doc.setFont("times", "normal"); doc.setFontSize(11);
  doc.text("Compte rendu de la réunion du " + dateLongue(SE().debut), 105, y, { align: "center" }); y += 5;
  doc.setFontSize(9);
  doc.text("Année fraternelle " + S.conseil.annee, 105, y, { align: "center" }); y += 8;
  doc.setLineWidth(0.4); doc.line(L, y, R, y); y += 8;

  texteDuCR(S).forEach(b => {
    saut(14);
    doc.setFont("times", "bold"); doc.setFontSize(12);
    doc.text(b.t, L, y); y += 6;
    doc.setFont("times", "normal"); doc.setFontSize(10.5);
    b.l.forEach(ligne => {
      const lignes = doc.splitTextToSize(String(ligne), R - L - 4);
      saut(lignes.length * 5 + 2);
      doc.text(lignes, L + 4, y);
      y += lignes.length * 5 + 1.5;
    });
    y += 4;
  });

  saut(24);
  y += 4;
  doc.setFont("times", "italic"); doc.setFontSize(10.5);
  doc.text("Le secrétaire-archiviste du " + S.conseil.nom + ", " + S.conseil.secretaire, L, y); y += 7;
  doc.setFont("times", "normal");
  doc.text("Charité · Unité · Fraternité", 105, y, { align: "center" });

  const n = doc.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("times", "normal"); doc.setFontSize(8);
    doc.text("Document interne — ne pas diffuser hors du conseil", L, 290);
    doc.text(i + " / " + n, R, 290, { align: "right" });
  }
  doc.save(nomFichier("pdf"));
  toast("PDF simplifié enregistré.");
}

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
      if (!o || !Array.isArray(o.effectif) || !(o.v === 1 || o.v === 2)) throw new Error("format");
      if (!confirm("Remplacer tout le contenu de ce téléphone par cette sauvegarde ?")) return;
      S = migrer(o); maj(); $("#sheet").hidden = true;
      toast("Sauvegarde restaurée.");
    } catch (e) { toast("Ce fichier n'est pas une sauvegarde du carnet."); }
  };
  r.readAsText(fichier);
}

/* ------------------------- le bac à sable -------------------------
   On essaie sur une copie : mêmes frères, mêmes services, mais rien de ce
   qu'on y fait ne redescend dans le carnet du conseil. */
function auBac() { try { return sessionStorage.getItem("csm.bac") === "1"; } catch (e) { return false; } }
function entrerBac() {
  try {
    localStorage.setItem(CLE_BAC, JSON.stringify(S));
    sessionStorage.setItem("csm.bac", "1");
  } catch (e) { toast("Impossible d'ouvrir le bac à sable ici."); return; }
  location.reload();
}
function quitterBac() {
  gele = true;
  clearTimeout(sauveTimer);
  try { localStorage.removeItem(CLE_BAC); sessionStorage.removeItem("csm.bac"); } catch (e) { /* rien */ }
  location.reload();
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

  c.appendChild(el("div", "filtitre", "Essayer sans rien casser"));
  if (auBac()) {
    c.appendChild(el("div", "derive", "Vous êtes dans le bac à sable : ce carnet est une copie, prise au moment où vous y êtes entré. En sortir jette la copie et retrouve le carnet du conseil, intact."));
    const bq = el("button", "addl", "Quitter le bac à sable"); bq.type = "button";
    bq.addEventListener("click", () => {
      if (!confirm("Quitter le bac à sable ? Tout ce que vous y avez fait sera jeté.")) return;
      quitterBac();
    });
    c.appendChild(bq);
  } else {
    c.appendChild(el("div", "derive", "Le bac à sable recopie le carnet du conseil et travaille sur la copie : bidouillez, testez, rien n'atteint vos vraies séances."));
    const be2 = el("button", "addl", "Ouvrir le bac à sable"); be2.type = "button";
    be2.addEventListener("click", entrerBac);
    c.appendChild(be2);
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
    const n = duSec(s.k).length;
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

  /* L'audio ne se pilote plus depuis la barre : il ne concerne que les topos,
     et se règle dans leur section. Reste ici le repère du temps. */
  const dc = $("#dicta");
  dc.hidden = true;

  $("#bar-conseil").textContent = (auBac() ? "⚑ " : "") + S.conseil.nom;
  document.body.classList.toggle("bac", auBac());
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
  ajouterNote(SEC().k, mode, ta.value.trim());
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
  if (s && s.tk) {
    const reste = s.tk.duree - (Date.now() - s.tk.debut);
    const h = $("#tk-h");
    if (h) {
      h.textContent = (reste < 0 ? "+" : "") + mmss(Math.abs(reste));
      const p = h.parentNode;
      if (p) {
        p.classList.toggle("over", reste < 0);
        const sl = p.querySelector(".tk-s");
        if (sl) sl.textContent = reste < 0 ? "temps dépassé" : "il reste";
      }
    }
  }
}, 1000);

window.addEventListener("beforeunload", () => {
  if (gele) return;
  clearTimeout(sauveTimer);
  try { localStorage.setItem(auBac() ? CLE_BAC : CLE, JSON.stringify(S)); } catch (e) { /* rien à faire */ }
});

/* ------------------------- amorçage du conseil -------------------------
   L'adresse est publique : l'amorçage est chiffré dans le dossier publié, et
   la phrase de passe voyage dans le lien d'installation. Une fois chargé, il
   vit dans l'appareil et le lien n'est plus nécessaire. */
function b64versOctets(b64) {
  const bin = atob(b64.trim());
  const o = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
  return o;
}
async function dechiffrer(b64, phrase) {
  const tout = b64versOctets(b64);
  const sel = tout.slice(0, 16), iv = tout.slice(16, 28), corps = tout.slice(28);
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(phrase), "PBKDF2", false, ["deriveKey"]);
  const cle = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: sel, iterations: 150000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const clair = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cle, corps);
  return new TextDecoder().decode(clair);
}
function phraseDuLien() {
  const m = /[#&?]c=([A-Za-z0-9]+)/.exec(location.hash + location.search);
  if (m) return m[1];
  try { return sessionStorage.getItem("csm.phrase") || ""; } catch (e) { return ""; }
}
async function amorcer() {
  const phrase = phraseDuLien();
  if (!phrase) return false;
  try { sessionStorage.setItem("csm.phrase", phrase); } catch (e) { /* peu importe */ }
  try {
    const rep = await fetch("amorcage.enc", { cache: "no-cache" });
    if (!rep.ok) return false;
    const o = JSON.parse(await dechiffrer(await rep.text(), phrase));
    if (!o || !Array.isArray(o.effectif)) return false;
    S = migrer(o); sauver(); rendre();
    toast("Conseil chargé : " + o.effectif.length + " frères.");
    return true;
  } catch (e) {
    toast("Le lien d'installation n'est pas le bon.");
    return false;
  }
}

/* ------------------------------ départ ------------------------------ */
S = charger();
setMode("note");
rendre();
sauver();   /* un carnet d'une version d'avant est réécrit au format courant */
if (!S.effectif.length && !S.archives.length) amorcer();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* hors ligne indisponible */ });
  });
}
