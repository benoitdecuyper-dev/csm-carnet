/* Fabrique le fichier d'amorçage du Conseil Saint Mommolin.
   Ce fichier contient des noms de frères : il ne va JAMAIS dans le dépôt publié,
   il se charge une fois depuis le téléphone, par « Restaurer une sauvegarde ».
   Lancer : node amorcage.js > ../export/amorcage-saint-mommolin.json          */
const uid = () => Math.random().toString(36).slice(2, 9);
const frere = (p, n, po, asp, pere) => ({ id: uid(), p, n: n || "", po: po || "", asp: !!asp, pere: !!pere });

const eff = [
  frere("Henri", "", "Aumônier", false, true),
  frere("Étienne"), frere("Louis"), frere("Raphaël"),
  frere("Jocelyn", "Dausque", "Grand Chevalier"),
  frere("Matthieu"), frere("Jean-Luc"), frere("Alexandre"), frere("Angy"),
  frere("Joseph"), frere("Pierre"), frere("Emmanuel"),
  frere("François", "Raymond"), frere("Félix"),
  frere("Benoît", "Decuyper", "Secrétaire-archiviste"),
  frere("Pierre", "A.", "", true), frere("Ghislain", "", "", true),
  frere("Vivien", "", "", true), frere("Magnus", "", "", true),
  frere("Rudy", "", "", true), frere("Christophe", "", "", true)
];
const id = (p, n) => { const f = eff.find(x => x.p === p && (n === undefined || x.n === n)); return f ? f.id : ""; };

const etat = {
  v: 1,
  conseil: {
    nom: "Conseil Saint Mommolin",
    secteur: "Secteur paroissial Saint-Jean Apôtre",
    ville: "Bordeaux",
    lieu: "Centre Jean-Paul II — 21 rue Buchou, 33800 Bordeaux",
    secretaire: "Benoît Decuyper",
    annee: "2026-2027"
  },
  effectif: eff,
  trinomes: [
    [id("Pierre", ""), id("Jocelyn"), id("Louis")],
    [id("Ghislain"), id("Raphaël"), id("Alexandre")],
    [id("Pierre", "A."), id("Benoît"), id("Henri")],
    [id("Matthieu"), id("Étienne"), id("Jean-Luc")],
    [id("Emmanuel"), id("François"), id("Angy")],
    [id("Jean-Luc"), id("Joseph"), id("Félix")]
  ],
  topos: [["Septembre", "Raphaël"], ["Octobre", "François Raymond"],
          ["Novembre", "Benoît"], ["Décembre", "Jocelyn"]],
  services: [
    { id: uid(), st: "v", pj: "Abri à vélo des sœurs consacrées", resp: "Louis", date: "devis attendu",
      pr: "Devis à obtenir avant tout engagement." },
    { id: uid(), st: "v", pj: "Don du sang", resp: "Raphaël", date: "",
      pr: "Faire don de son sang." },
    { id: uid(), st: "v", pj: "Concert « Cantus Crucis »", resp: "", date: "29/09/2026",
      pr: "Service d'ordre. Thème : la passion du Christ." },
    { id: uid(), st: "c", pj: "Maraude — Macadam Café", resp: "Jean-Luc, Angy, Pierre", date: "chaque samedi",
      pr: "Renfort au service hebdomadaire des maraudes du secteur paroissial Saint-Jean Apôtre. Chaque chevalier est invité à s'y joindre." },
    { id: uid(), st: "c", pj: "Nettoyage des églises", resp: "Jean-Luc", date: "sur WhatsApp",
      pr: "Aide au nettoyage de nos églises." }
  ],
  evenements: [
    { id: uid(), q: "Pèlerinage des Chevaliers de Colomb à Rocamadour", date: "16/10/2026" }
  ],
  retenir: [
    "Maraudes Macadam Café — chaque samedi, secteur paroissial Saint-Jean Apôtre",
    "Heure sainte — tous les jeudis au Sacré-Cœur, de 19 h 40 à 20 h 40, après la messe de 19 h"
  ],
  seance: null,
  archives: []
};

process.stdout.write(JSON.stringify(etat, null, 2));
