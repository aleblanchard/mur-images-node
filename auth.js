// Chapitre 10 : sessions (cookie) et mots de passe.
// Améliorations de sécurité recommandées par le chapitre :
//  - identifiant de session imprévisible (crypto.randomUUID) dans un cookie HttpOnly ;
//  - mot de passe haché avec scrypt et un sel aléatoire, jamais stocké en clair.
const crypto = require("crypto");

const COOKIE = "session-id";
const sessions = new Map();   // identifiant -> { username, accountId }

function lireCookies(req) {
    const cookies = {};
    for (const morceau of (req.headers.cookie || "").split(";")) {
        const i = morceau.indexOf("=");
        if (i > 0) cookies[morceau.slice(0, i).trim()] = decodeURIComponent(morceau.slice(i + 1).trim());
    }
    return cookies;
}

// Renvoie la session du visiteur, en la créant si besoin (premier passage)
function session(req, res) {
    let id = lireCookies(req)[COOKIE];
    if (!id || !sessions.has(id)) {
        id = crypto.randomUUID();
        sessions.set(id, {});
        res.setHeader("Set-Cookie", `${COOKIE}=${id}; HttpOnly; SameSite=Lax; Path=/`);
    }
    return sessions.get(id);
}

function hacher(motDePasse, sel) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(motDePasse, sel, 64, (err, cle) => (err ? reject(err) : resolve(cle)));
    });
}

async function nouveauMotDePasse(motDePasse) {
    const salt = crypto.randomBytes(16);
    return { salt, hash: await hacher(motDePasse, salt) };
}

async function verifierMotDePasse(motDePasse, salt, hash) {
    const calcule = await hacher(motDePasse, salt);
    return calcule.length === hash.length && crypto.timingSafeEqual(calcule, hash);
}

module.exports = { session, sessions, nouveauMotDePasse, verifierMotDePasse };
