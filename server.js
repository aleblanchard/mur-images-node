// Mur d'images — serveur web en Node.js natif (module http, sans framework).
// Il suit le projet des chapitres 1 à 10 de vanillacademy.com :
//   ressources statiques sous /public (ch. 4), pages générées dynamiquement (ch. 4),
//   commentaires par formulaire POST + redirection 302 (ch. 5), données en base
//   PostgreSQL (ch. 6 à 8), JavaScript côté navigateur (ch. 9), comptes et likes (ch. 10).
const fs = require("fs");
const http = require("http");
const path = require("path");

const db = require("./db");
const auth = require("./auth");
const views = require("./views");

const PORT = Number(process.env.PORT || 8080);
const DOSSIER_PUBLIC = path.join(__dirname, "public");
const TAILLE_MAX_CORPS = 10 * 1024;   // 10 Ko suffisent pour un commentaire ou un formulaire

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
};

// ---------------------------------------------------------------- réponses
function envoyerHTML(res, html, statut = 200) {
    res.writeHead(statut, { "Content-Type": TYPES[".html"] });
    res.end(html);
}

function rediriger(res, url) {
    res.statusCode = 302;
    res.setHeader("Location", url);
    res.end();
}

function erreurPage(res, utilisateur, code, message) {
    envoyerHTML(res, views.erreur({ utilisateur, code, message }), code);
}

// ------------------------------------------------- fichiers statiques (ch. 4)
// Convention : l'URL /public/xxx correspond au fichier public/xxx.
function servirStatique(req, res, utilisateur) {
    let chemin;
    try {
        chemin = decodeURIComponent(req.url.split("?")[0]);
    } catch {
        return erreurPage(res, utilisateur, 400, "Adresse invalide.");
    }
    const fichier = path.normalize(path.join(__dirname, chemin));
    // Interdit de sortir du dossier public (ex. /public/../server.js)
    if (!fichier.startsWith(DOSSIER_PUBLIC + path.sep)) {
        return erreurPage(res, utilisateur, 403, "Accès interdit.");
    }
    fs.readFile(fichier, (err, contenu) => {
        if (err) return erreurPage(res, utilisateur, 404, "Ressource introuvable.");
        res.writeHead(200, { "Content-Type": TYPES[path.extname(fichier).toLowerCase()] || "application/octet-stream" });
        res.end(contenu);
    });
}

// ------------------------------------------- lecture d'un formulaire (ch. 5)
function lireFormulaire(req) {
    return new Promise((resolve, reject) => {
        let corps = "";
        req.on("data", morceau => {
            corps += morceau;
            if (corps.length > TAILLE_MAX_CORPS) {
                reject(Object.assign(new Error("Requête trop volumineuse"), { statut: 413 }));
                req.destroy();
            }
        });
        req.on("end", () => resolve(new URLSearchParams(corps)));
        req.on("error", reject);
    });
}

function idDepuis(texte) {
    const id = Number(texte);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// ---------------------------------------------------------------- routage
async function routeur(req, res) {
    const session = auth.session(req, res);
    const utilisateur = session.username || null;
    const url = req.url.split("?")[0];
    const methode = req.method;

    // Fichiers statiques
    if (methode === "GET" && url.startsWith("/public/")) {
        return servirStatique(req, res, utilisateur);
    }

    // Accueil : les trois images les plus récentes (ch. 8)
    if (methode === "GET" && (url === "/" || url === "/index.html")) {
        const images = await db.dernieresImages(3);
        return envoyerHTML(res, views.accueil({ utilisateur, images }));
    }

    // Mur d'images
    if (methode === "GET" && (url === "/images" || url === "/mur-images")) {
        const images = await db.toutesLesImages();
        const aimees = session.accountId ? await db.imagesAimees(session.accountId) : new Set();
        return envoyerHTML(res, views.mur({ utilisateur, images, aimees }));
    }

    // Page d'une image
    let m = url.match(/^\/page-image\/(\d+)$/);
    if (methode === "GET" && m) {
        const id = idDepuis(m[1]);
        const img = id && await db.image(id);
        if (!img) return erreurPage(res, utilisateur, 404, "Cette image n'existe pas.");
        const [commentaires, voisines] = await Promise.all([db.commentaires(id), db.voisines(id)]);
        return envoyerHTML(res, views.pageImage({ utilisateur, img, commentaires, voisines }));
    }

    // Ajout d'un commentaire, puis retour sur la page de l'image (ch. 5)
    if (methode === "POST" && url === "/image-description") {
        const form = await lireFormulaire(req);
        const id = idDepuis(form.get("imageId"));
        const texte = (form.get("comment") || "").trim();
        if (!id || !(await db.image(id))) return erreurPage(res, utilisateur, 404, "Cette image n'existe pas.");
        if (texte && texte.length <= 500) {
            await db.ajouterCommentaire(id, texte);
            console.log(`Commentaire ajouté pour l'image ${id} : ${texte}`);
        }
        return rediriger(res, `/page-image/${id}`);
    }

    // Inscription et connexion (ch. 10)
    if (url === "/signup" || url === "/signin") {
        const mode = url.slice(1);
        if (methode === "GET") {
            if (utilisateur) return rediriger(res, "/");
            return envoyerHTML(res, views.formulaireCompte({ mode, utilisateur }));
        }
        if (methode === "POST") {
            const form = await lireFormulaire(req);
            const username = (form.get("username") || "").trim();
            const password = form.get("password") || "";
            const refuser = message => envoyerHTML(res,
                views.formulaireCompte({ mode, utilisateur, erreur: message, username }), 400);

            if (mode === "signup") {
                if (!/^[\p{L}\p{N}_.-]{3,30}$/u.test(username)) {
                    return refuser("Le nom d'utilisateur doit faire de 3 à 30 caractères (lettres, chiffres, _ . -).");
                }
                if (password.length < 8) return refuser("Le mot de passe doit faire au moins 8 caractères.");
                if (await db.compteParNom(username)) return refuser("Ce nom d'utilisateur est déjà pris.");
                const { salt, hash } = await auth.nouveauMotDePasse(password);
                session.accountId = await db.creerCompte(username, salt, hash);
                session.username = username;
                return rediriger(res, "/");
            }

            const compte = await db.compteParNom(username);
            if (!compte || !(await auth.verifierMotDePasse(password, compte.salt, compte.hash))) {
                return refuser("Nom d'utilisateur ou mot de passe incorrect.");
            }
            session.accountId = compte.id;
            session.username = compte.username;
            return rediriger(res, "/");
        }
    }

    // Déconnexion
    if (methode === "GET" && url === "/logout") {
        delete session.accountId;
        delete session.username;
        return rediriger(res, "/");
    }

    // Like d'une image, réservé aux utilisateurs connectés (ch. 10)
    m = url.match(/^\/like\/(\d+)$/);
    if (methode === "GET" && m) {
        if (!session.accountId) return rediriger(res, "/signin");
        const id = idDepuis(m[1]);
        if (!id || !(await db.image(id))) return erreurPage(res, utilisateur, 404, "Cette image n'existe pas.");
        await db.aimer(session.accountId, id);
        return rediriger(res, "/images");
    }

    return erreurPage(res, utilisateur, 404, "Cette page n'existe pas.");
}

const server = http.createServer((req, res) => {
    routeur(req, res).catch(err => {
        if (res.headersSent) return res.end();
        if (err.statut === 413) return erreurPage(res, null, 413, "Requête trop volumineuse.");
        console.error(err);
        const message = err.code === "ECONNREFUSED" || err.code === "3D000" || err.code === "28P01"
            ? "Base de données inaccessible : vérifiez que PostgreSQL est lancé et que `npm run init-db` a été exécuté."
            : "Erreur interne du serveur.";
        erreurPage(res, null, 500, message);
    });
});

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Serveur en cours d'exécution sur http://localhost:${PORT}`);
        console.log(`Base : ${db.config.database} sur ${db.config.host}:${db.config.port}`);
    });
}

module.exports = server;
