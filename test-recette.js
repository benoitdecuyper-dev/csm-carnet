/* Recette du carnet : on joue une séance complète comme Benoît le ferait au téléphone.
   Lancer : node test-recette.js   (serveur local sur 8787)                       */
const { chromium } = require("C:/Users/Ben/Claude/Projects/Sporae/node_modules/playwright");
const fs = require("fs");
const BASE = process.env.BASE || "http://127.0.0.1:8787/index.html";
const AMORCE = fs.readFileSync("../export/amorcage-saint-mommolin.json", "utf8");

const echecs = [];
const notes = [];
function verifie(nom, ok, detail) {
  if (ok) notes.push("  ok   " + nom);
  else { echecs.push(nom + (detail ? " — " + detail : "")); notes.push("  ECHEC " + nom + (detail ? " — " + detail : "")); }
}

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on("pageerror", e => erreurs.push(String(e)));
  page.on("console", m => { if (m.type() === "error") erreurs.push("console: " + m.text()); });

  /* le carnet publié est vide : on charge l'amorçage du conseil, comme Benoît le fera une fois */
  await page.addInitScript(a => { try { if (!localStorage.getItem("csm.carnet.v1")) localStorage.setItem("csm.carnet.v1", a); } catch (e) {} }, AMORCE);
  await page.goto(BASE, { waitUntil: "networkidle" });

  /* --- 1. écran de démarrage --- */
  verifie("l'accueil propose de débuter", await page.getByText("Débuter la séance").isVisible());
  verifie("le badge audio est masqué avant la séance", !(await page.locator("#dicta").isVisible()));
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  verifie("aucun débordement horizontal", largeur <= 390, "scrollWidth=" + largeur);

  /* --- 2. démarrage --- */
  await page.getByText("Débuter la séance").click();
  verifie("le bandeau de section apparaît", await page.locator("#secwrap").isVisible());
  verifie("on démarre au point 1", (await page.locator("#s-l").textContent()) === "Effectif");
  verifie("le badge dictaphone s'allume", (await page.locator("#dicta-t").textContent()) === "Dictaphone");

  /* --- 3. appel : tout le monde absent, on coche --- */
  verifie("l'appel liste l'effectif", (await page.locator(".li").count()) === 21);
  let cpt = await page.locator(".outil .cpt").first().textContent();
  verifie("l'appel démarre à zéro présent", cpt.trim() === "0 / 21", cpt);
  await page.locator(".raccourcis button", { hasText: "Tous présents" }).click();
  cpt = await page.locator(".outil .cpt").first().textContent();
  verifie("« Tous présents » coche les 21", cpt.trim() === "21 / 21", cpt);
  await page.locator(".li").nth(1).click();   // Étienne -> Excusé
  cpt = await page.locator(".outil .cpt").first().textContent();
  verifie("une tape passe un frère en excusé", cpt.trim() === "20 / 21", cpt);

  /* --- 4. une note simple --- */
  await page.locator("#saisie").fill("Ouverture à l'heure, quorum atteint.");
  await page.locator("#go").click();
  verifie("la note est enregistrée", (await page.locator(".n8").count()) === 1);
  verifie("la note porte son minutage", /\d\d:\d\d/.test(await page.locator(".n8 .h").first().textContent()));

  /* --- 5. navigation par section --- */
  await page.locator("#s-suiv").click();
  verifie("on avance au point 2", (await page.locator("#s-l").textContent()) === "Enseignement du Padre");
  await page.locator(".ch input").first().fill("Dieu qui nous parle");
  await page.locator("#s-suiv").click();
  await page.locator(".ch input").first().fill("256,80 €");
  verifie("on est aux comptes", (await page.locator("#s-l").textContent()) === "Comptes");

  /* --- 6. services : changer un statut d'une tape --- */
  await page.locator("#s-suiv").click();
  verifie("on est aux services", (await page.locator("#s-l").textContent()) === "Services");
  const ligneAbri = page.locator(".sv").filter({ hasText: "Abri à vélo" });
  const avant = (await ligneAbri.locator(".badge").textContent()).trim();
  await ligneAbri.locator(".badge").click();
  const apres = (await ligneAbri.locator(".badge").textContent()).trim();
  verifie("le statut change d'une tape", avant === "À venir" && apres === "En cours", avant + " -> " + apres);
  const rang = await page.locator(".sv .pj").allTextContents();
  verifie("la ligne ne saute pas sous le doigt", /Abri à vélo/.test(rang[0]), JSON.stringify(rang));

  /* --- 7. une action, attribuée --- */
  await page.locator("#m-action").click();
  await page.locator("#saisie").fill("Relancer le menuisier pour le devis de l'abri à vélo.");
  await page.locator("#go").click();
  const carteAction = page.locator(".n8").filter({ hasText: "Relancer le menuisier" });
  verifie("l'action est créée", await carteAction.count() === 1);
  await carteAction.locator("select").selectOption({ label: "Louis" });
  await carteAction.locator(".chip", { hasText: "Sous 8 jours" }).click();
  verifie("l'action porte son échéance",
    (await carteAction.locator(".chip.att").count()) === 1);
  verifie("le mode retombe sur note simple",
    (await page.locator("#m-etat").textContent()).indexOf("simple") >= 0);

  /* --- 8. prochaines dates dérivées --- */
  await page.locator("#s-suiv").click();
  verifie("on est aux prochaines dates", (await page.locator("#s-l").textContent()) === "Prochaines dates");
  const srcs = await page.locator(".dt .src").allTextContents();
  verifie("une date vient d'un service", srcs.some(x => x.trim() === "service"), JSON.stringify(srcs));

  /* --- 9. trinômes : contrôle des doublons et des oubliés --- */
  await page.locator("#s-suiv").click();
  verifie("on est aux propositions spirituelles", (await page.locator("#s-l").textContent()) === "Propositions spirituelles");
  verifie("six trinômes", (await page.locator(".tri-l").count()) === 6);
  const alerte = await page.locator(".alerte").textContent();
  verifie("le doublon Jean-Luc est signalé", /Jean-Luc/.test(alerte), alerte);
  verifie("les frères sans trinôme sont signalés", /aucun trin/.test(alerte), alerte);

  /* --- 10. prochain conseil : le topo se déduit du mois --- */
  await page.locator("#s-cur").click();
  await page.locator(".sheet .pl", { hasText: "Prochain conseil" }).click();
  verifie("on saute au dernier point", (await page.locator("#s-l").textContent()) === "Prochain conseil");
  await page.locator(".ch input").first().fill("06/10/2026");
  await page.locator(".ch input").first().blur();
  await page.waitForTimeout(120);
  const topo = await page.locator(".ch select").first().inputValue();
  verifie("le topo d'octobre est repris du calendrier", topo === "François Raymond", "topo=" + topo);

  /* --- 11. clôture --- */
  page.once("dialog", d => d.accept());
  await page.locator(".gros.fin").click();
  await page.waitForTimeout(200);
  verifie("la clôture bascule sur le compte rendu", await page.locator("#vue .cr").isVisible());

  /* --- 12. le document --- */
  const cr = await page.locator("#vue .cr").textContent();
  verifie("le document porte le nom du conseil", /Conseil Saint Mommolin/.test(cr));
  verifie("les actions sont en tête", cr.indexOf("Qui fait quoi") < cr.indexOf("Effectif"));
  verifie("le prochain conseil précède les dates",
    cr.indexOf("Prochain conseil") < cr.indexOf("Prochaines dates"));
  verifie("le topo figure au prochain conseil", /Topo du mois/.test(cr));
  verifie("l'action nomme son responsable", /Louis/.test(cr) && /Relancer le menuisier/.test(cr));
  verifie("le solde est repris", /256,80/.test(cr));
  verifie("l'excusé est nommé", /Excusé\s*:\s*Étienne/.test(cr.replace(/\s+/g, " ")));
  verifie("les services sont en tableau", (await page.locator("#vue .cr table.svt tbody tr").count()) === 5);
  verifie("le tableau a ses cinq colonnes", (await page.locator("#vue .cr table.svt thead th").count()) === 5);
  verifie("le filigrane est présent", (await page.locator("#vue .cr .filigrane").count()) === 1);
  verifie("l'emblème est présent", (await page.locator("#vue .cr .blason").count()) === 1);
  verifie("la devise ferme le document", /Charité · Unité · Fraternité/.test(cr));

  /* --- 13. persistance --- */
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  const stock = await page.evaluate(() => localStorage.getItem("csm.carnet.v1"));
  verifie("l'état est bien stocké", !!stock && stock.length > 500);
  verifie("la séance close est retrouvée après rechargement",
    await page.getByText("Séance close").isVisible());

  /* --- 14. rendu imprimé --- */
  await page.locator("#nav5 button[data-v=cr]").click();
  await page.waitForTimeout(150);
  verifie("le document est prêt pour une impression lancée du navigateur",
    (await page.locator("#impression .cr").count()) === 1);
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ format: "A4", printBackground: true,
    margin: { top: "13mm", bottom: "13mm", left: "14mm", right: "14mm" } });
  verifie("le PDF se génère", pdf.length > 20000, pdf.length + " octets");

  /* --- 15. le code publié ne contient aucun nom de frère --- */
  const src = fs.readFileSync("app.js", "utf8");
  const html = fs.readFileSync("index.html", "utf8");
  const fuites = ["Dausque", "Decuyper", "Jean-Luc", "Raphaël", "Jocelyn", "Macadam", "Buchou", "Étienne"]
    .filter(x => src.includes(x) || html.includes(x));
  verifie("aucun nom de frère dans le code publié", fuites.length === 0, fuites.join(", "));
  verifie("le carnet publié démarre vide", /effectif:\s*\[\]/.test(src));
  require("fs").writeFileSync("../export/qa-cr-genere.pdf", pdf);
  await page.emulateMedia({ media: "screen" });

  await page.screenshot({ path: "../export/qa-02-document.png", fullPage: false });
  await nav.close();

  console.log(notes.join("\n"));
  console.log("\n" + (echecs.length ? "ECHECS (" + echecs.length + ") :\n - " + echecs.join("\n - ")
    : "Recette complète : " + notes.length + " contrôles au vert."));
  if (erreurs.length) console.log("\nErreurs JS :\n - " + erreurs.join("\n - "));
  process.exit(echecs.length || erreurs.length ? 1 : 0);
})();
